/** Read-only: assert a specific GCal event id is gone from the user's Task
 * Blocks calendar (proves the revoke backstop deleted the REAL event, not
 * just the DB mirror). Also reports residual UAT DB rows. */
import { prisma } from "../src/lib/prisma";
import { getCommitmentCalendarContext } from "../src/services/google-task-sync";

async function main() {
  const userId = process.argv[2];
  const eventId = process.argv[3];
  if (!userId || !eventId)
    throw new Error("usage: uat-verify-gcal-gone.ts <userId> <eventId>");

  const ctx = await getCommitmentCalendarContext(userId);
  let gcalState: string;
  if (!ctx) {
    gcalState = "NO_CTX";
  } else {
    try {
      const r = await ctx.client.events.get({
        calendarId: ctx.googleCalendarId,
        eventId,
      });
      // Google returns status:"cancelled" for deleted events even on get.
      gcalState = `PRESENT (status=${r.data.status ?? "?"})`;
    } catch (e) {
      const code = (e as { code?: number }).code;
      gcalState = code === 404 || code === 410 ? "GONE_404" : `ERR ${String(e)}`;
    }
  }

  const uatCommits = await prisma.personalCommitment.count({
    where: { label: { contains: "UAT" } },
  });
  const uatMirrors = await prisma.calendarEvent.count({
    where: {
      feedId: "619f2c29-f3b4-47c1-ae2f-cf64874fe70e",
      title: { contains: "UAT" },
    },
  });
  const real = await prisma.personalCommitment.count({
    where: { userId, label: { not: { contains: "UAT" } } },
  });

  console.log(
    JSON.stringify(
      { eventId, gcalState, uatCommitsLeft: uatCommits, uatMirrorsLeft: uatMirrors, realIntact: real },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
