/**
 * Phase C e2e self-cleaning helper.
 *
 * The skip path writes a temporary `gs:reflow:` work block onto the REAL
 * Task Blocks Google Calendar (+ a mirror CalendarEvent). It is NOT tracked
 * by a CommitmentEvent, so DELETE /api/commitments/[id] (revoke) does not
 * remove it. This script deletes every `gs:reflow:` event for the user from
 * Google AND its mirror row, plus any DB-only `gs:e2e-seed` eligible blocks
 * the spec seeded. Idempotent — safe to run repeatedly.
 *
 * Run: npx tsx scripts/e2e-reflow-cleanup.ts <userId>
 */
import { prisma } from "../src/lib/prisma";
import {
  getCommitmentCalendarContext,
  deleteCommitmentGoogleEvent,
} from "../src/services/google-task-sync";

async function main() {
  const userId = process.argv[2];
  if (!userId) throw new Error("usage: e2e-reflow-cleanup.ts <userId>");

  const ctx = await getCommitmentCalendarContext(userId);
  if (!ctx) {
    // Without a resolved feed, every delete below would be UNSCOPED and would
    // match gs:reflow:/gs:e2e-seed rows across ALL feeds and ALL users in the
    // shared dev DB. Never run an unscoped delete — fail loudly instead.
    console.error(
      "e2e-reflow-cleanup: getCommitmentCalendarContext returned null — " +
        "refusing to run an unscoped delete. Resolve the Task Blocks feed " +
        "(taskBlocksFeedId / Google account) and retry."
    );
    process.exit(1);
  }

  // 1. gs:reflow temp blocks — real GCal + mirror (scoped to the feed).
  const reflowMirrors = await prisma.calendarEvent.findMany({
    where: {
      feedId: ctx.feedId,
      description: { startsWith: "gs:reflow:" },
    },
  });
  let gcalDeleted = 0;
  for (const m of reflowMirrors) {
    if (m.externalEventId) {
      await deleteCommitmentGoogleEvent(
        ctx.client,
        ctx.googleCalendarId,
        m.externalEventId
      );
      gcalDeleted++;
    }
    await prisma.calendarEvent.delete({ where: { id: m.id } });
  }

  // 2. DB-only seeded eligible blocks (never written to Google).
  const seeded = await prisma.calendarEvent.deleteMany({
    where: {
      feedId: ctx.feedId,
      description: "gs:e2e-seed",
    },
  });

  console.log(
    JSON.stringify({
      reflowMirrors: reflowMirrors.length,
      gcalDeleted,
      seededDeleted: seeded.count,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
