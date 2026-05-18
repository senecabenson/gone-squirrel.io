/** One-off diagnostic: why does getCommitmentCalendarContext behave as it does
 * for a user, and is the Google token alive? Read-only. */
import { prisma } from "../src/lib/prisma";
import { getCommitmentCalendarContext } from "../src/services/google-task-sync";

async function main() {
  const userId = process.argv[2];
  if (!userId) throw new Error("usage: uat-probe-ctx.ts <userId>");

  const acct = await prisma.connectedAccount.findFirst({
    where: { userId, provider: "GOOGLE" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const settings = await prisma.autoScheduleSettings.findUnique({
    where: { userId },
    select: { taskBlocksFeedId: true },
  });
  const feed = settings?.taskBlocksFeedId
    ? await prisma.calendarFeed.findUnique({
        where: { id: settings.taskBlocksFeedId },
        select: { id: true, url: true, name: true },
      })
    : null;

  const ctx = await getCommitmentCalendarContext(userId);

  let liveCall: string;
  try {
    if (ctx) {
      const r = await ctx.client.events.list({
        calendarId: ctx.googleCalendarId,
        maxResults: 1,
      });
      liveCall = `OK (items=${r.data.items?.length ?? 0})`;
    } else {
      liveCall = "skipped (ctx null)";
    }
  } catch (e) {
    liveCall = `THREW: ${e instanceof Error ? e.message : String(e)}`;
  }

  console.log(
    JSON.stringify(
      {
        hasGoogleAccount: !!acct,
        taskBlocksFeedId: settings?.taskBlocksFeedId ?? null,
        feedRow: feed,
        ctxResolved: !!ctx,
        ctxFeedId: ctx?.feedId ?? null,
        ctxCalendarId: ctx?.googleCalendarId ?? null,
        liveGcalCall: liveCall,
      },
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
