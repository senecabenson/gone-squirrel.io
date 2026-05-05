import { getGoogleCalendarClient } from "../src/lib/google-calendar";
import { prisma } from "../src/lib/prisma";

const userId = process.argv[2];
if (!userId) {
  console.error("usage: tsx scripts/list-task-events.ts <userId>");
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
  const r = await client.events.list({
    calendarId: integration.taskCalendarId,
    maxResults: 50,
    singleEvents: true,
    orderBy: "startTime",
    timeMin: new Date(Date.now() - 86400000).toISOString(),
  });
  for (const ev of r.data.items ?? []) {
    console.log(
      [
        ev.id,
        ev.start?.dateTime ?? ev.start?.date,
        ev.end?.dateTime ?? ev.end?.date,
        ev.summary,
      ].join(" | ")
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
