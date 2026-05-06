import { getGoogleCalendarClient } from "../src/lib/google-calendar";
import { prisma } from "../src/lib/prisma";

const userId = process.argv[2];
const mode = process.argv[3] ?? "list";
if (!userId || !["list", "delete"].includes(mode)) {
  console.error(
    "usage: tsx scripts/audit-task-events.ts <userId> <list|delete>"
  );
  process.exit(1);
}
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
  const client = await getGoogleCalendarClient(account.id, userId);

  // Collect all event IDs that DB tasks reference
  const tracked = new Set(
    (
      await prisma.task.findMany({
        where: { userId, googleEventId: { not: null } },
        select: { googleEventId: true },
      })
    ).map((t) => t.googleEventId!)
  );

  // Page through ALL events on dedicated calendar
  const orphans: { id: string; summary?: string | null; start?: string | null }[] = [];
  let pageToken: string | undefined;
  let total = 0;
  do {
    const r = await client.events.list({
      calendarId: integration.taskCalendarId,
      maxResults: 250,
      singleEvents: true,
      showDeleted: false,
      pageToken,
    });
    for (const ev of r.data.items ?? []) {
      total++;
      if (!ev.id) continue;
      if (!tracked.has(ev.id)) {
        orphans.push({
          id: ev.id,
          summary: ev.summary,
          start: ev.start?.dateTime ?? ev.start?.date,
        });
      }
    }
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);

  console.log(`scanned ${total} events; found ${orphans.length} orphans`);
  for (const o of orphans) {
    console.log(`${o.id} | ${o.start} | ${o.summary}`);
  }

  if (mode === "delete" && orphans.length > 0) {
    console.log("\ndeleting orphans...");
    for (const o of orphans) {
      try {
        await client.events.delete({
          calendarId: integration.taskCalendarId,
          eventId: o.id,
        });
        console.log(`deleted ${o.id}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`FAILED ${o.id}: ${msg}`);
      }
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
