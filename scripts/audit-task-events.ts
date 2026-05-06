import { getGoogleCalendarClient } from "../src/lib/google-calendar";
import { prisma } from "../src/lib/prisma";

type Mode = "list" | "delete" | "backfill";

const userId = process.argv[2];
const mode = (process.argv[3] ?? "list") as Mode;
if (!userId || !["list", "delete", "backfill"].includes(mode)) {
  console.error(
    "usage: tsx scripts/audit-task-events.ts <userId> <list|delete|backfill>"
  );
  process.exit(1);
}

type Ev = {
  id: string;
  summary?: string | null;
  start?: string | null;
  taggedTaskId?: string;
};

(async () => {
  const account = await prisma.connectedAccount.findFirst({
    where: { userId, provider: "GOOGLE" },
  });
  const integration = await prisma.integrationSettings.findUnique({
    where: { userId },
  });
  if (!account || !integration?.taskCalendarId) {
    console.error("no account or no taskCalendarId");
    process.exit(1);
  }
  const calendarId = integration.taskCalendarId;
  const client = await getGoogleCalendarClient(account.id, userId);

  // Map tracked googleEventId → taskId for inference.
  const dbTasks = await prisma.task.findMany({
    where: { userId, googleEventId: { not: null } },
    select: { id: true, googleEventId: true },
  });
  const eventToTaskId = new Map(
    dbTasks.map((t) => [t.googleEventId!, t.id])
  );
  const tracked = new Set(eventToTaskId.keys());

  const events: Ev[] = [];
  let pageToken: string | undefined;
  do {
    const r = await client.events.list({
      calendarId,
      maxResults: 250,
      singleEvents: true,
      showDeleted: false,
      pageToken,
    });
    for (const ev of r.data.items ?? []) {
      if (!ev.id) continue;
      events.push({
        id: ev.id,
        summary: ev.summary,
        start: ev.start?.dateTime ?? ev.start?.date,
        taggedTaskId: ev.extendedProperties?.private?.taskId,
      });
    }
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);

  const orphans = events.filter((e) => !tracked.has(e.id));
  console.log(
    `scanned ${events.length} events; ${orphans.length} not tracked by any DB task`
  );
  for (const o of orphans) {
    console.log(
      `${o.id} | ${o.start} | tag=${o.taggedTaskId ?? "—"} | ${o.summary}`
    );
  }

  if (mode === "list") return;

  if (mode === "delete") {
    if (orphans.length === 0) return;
    console.log("\ndeleting orphans...");
    for (const o of orphans) {
      try {
        await client.events.delete({ calendarId, eventId: o.id });
        console.log(`deleted ${o.id}`);
      } catch (e: unknown) {
        console.log(
          `FAILED ${o.id}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    return;
  }

  // backfill: tag every event with private.taskId; dedupe per-task.
  console.log("\nbackfill — tagging events with private.taskId");
  let tagged = 0;
  let skipped = 0;
  for (const ev of events) {
    if (ev.taggedTaskId) {
      skipped++;
      continue;
    }
    const inferred = eventToTaskId.get(ev.id);
    if (!inferred) continue;
    try {
      await client.events.patch({
        calendarId,
        eventId: ev.id,
        requestBody: {
          extendedProperties: { private: { taskId: inferred } },
        },
      });
      ev.taggedTaskId = inferred;
      tagged++;
    } catch (e: unknown) {
      console.log(
        `FAILED tag ${ev.id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  console.log(`tagged ${tagged}; already tagged ${skipped}`);

  // Dedupe: per task, keep DB-tracked event; delete other tagged events.
  const byTask = new Map<string, Ev[]>();
  for (const ev of events) {
    if (!ev.taggedTaskId) continue;
    const arr = byTask.get(ev.taggedTaskId) ?? [];
    arr.push(ev);
    byTask.set(ev.taggedTaskId, arr);
  }
  let deletedDupes = 0;
  for (const [taskId, group] of byTask) {
    if (group.length <= 1) continue;
    const tracked = await prisma.task.findUnique({
      where: { id: taskId },
      select: { googleEventId: true },
    });
    const keep = tracked?.googleEventId;
    for (const ev of group) {
      if (ev.id === keep) continue;
      try {
        await client.events.delete({ calendarId, eventId: ev.id });
        console.log(`dedupe ${taskId}: deleted ${ev.id}`);
        deletedDupes++;
      } catch (e: unknown) {
        console.log(
          `FAILED delete ${ev.id}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  }
  console.log(`deduped ${deletedDupes}`);

  // Final orphan sweep: delete events with no taskId tag AND no DB tracker.
  let deletedTrueOrphans = 0;
  for (const ev of events) {
    if (ev.taggedTaskId) continue;
    if (tracked.has(ev.id)) continue; // tracked-but-untagged shouldn't happen post-tag pass
    try {
      await client.events.delete({ calendarId, eventId: ev.id });
      console.log(`true-orphan deleted ${ev.id}`);
      deletedTrueOrphans++;
    } catch (e: unknown) {
      console.log(
        `FAILED delete ${ev.id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  console.log(`deleted ${deletedTrueOrphans} true orphans`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
