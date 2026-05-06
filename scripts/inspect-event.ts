import { getGoogleCalendarClient } from "../src/lib/google-calendar";
import { prisma } from "../src/lib/prisma";

const userId = process.argv[2];
const eventId = process.argv[3];
if (!userId || !eventId) {
  console.error("usage: tsx scripts/inspect-event.ts <userId> <eventId>");
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
    console.error("no account or taskCalendarId");
    process.exit(1);
  }
  const client = await getGoogleCalendarClient(account.id, userId);
  const r = await client.events.get({
    calendarId: integration.taskCalendarId,
    eventId,
  });
  console.log("summary:", JSON.stringify(r.data.summary));
  console.log("colorId:", r.data.colorId);
  console.log("status:", r.data.status);
  console.log("start:", r.data.start?.dateTime);
  console.log("end:", r.data.end?.dateTime);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
