/**
 * One-off UAT cleanup: delete every CalendarEvent on the user's Task Blocks
 * feed whose title contains a marker (default "UAT") from the REAL Google
 * Calendar AND its DB mirror row. Used when a commitment DELETE/revoke left
 * orphaned commitment-mirror events behind. Scoped to the resolved feed —
 * refuses to run unscoped. Idempotent.
 *
 * Run: npx tsx scripts/uat-orphan-cleanup.ts <userId> [marker]
 */
import { prisma } from "../src/lib/prisma";
import {
  getCommitmentCalendarContext,
  deleteCommitmentGoogleEvent,
} from "../src/services/google-task-sync";

async function main() {
  const userId = process.argv[2];
  const marker = process.argv[3] ?? "UAT";
  if (!userId) throw new Error("usage: uat-orphan-cleanup.ts <userId> [marker]");

  const ctx = await getCommitmentCalendarContext(userId);
  if (!ctx) {
    console.error(
      "uat-orphan-cleanup: no calendar context — refusing unscoped delete. " +
        "Wire taskBlocksFeedId first."
    );
    process.exit(1);
  }

  const mirrors = await prisma.calendarEvent.findMany({
    where: { feedId: ctx.feedId, title: { contains: marker } },
  });
  let gcalDeleted = 0;
  const failed: string[] = [];
  for (const m of mirrors) {
    if (m.externalEventId) {
      try {
        await deleteCommitmentGoogleEvent(
          ctx.client,
          ctx.googleCalendarId,
          m.externalEventId
        );
        gcalDeleted++;
      } catch (e) {
        failed.push(`${m.externalEventId}: ${String(e)}`);
      }
    }
    await prisma.calendarEvent.delete({ where: { id: m.id } });
  }

  console.log(
    JSON.stringify({ matched: mirrors.length, gcalDeleted, rowsDeleted: mirrors.length, failed })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
