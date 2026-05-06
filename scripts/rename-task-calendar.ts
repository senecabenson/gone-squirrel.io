import { getGoogleCalendarClient } from "../src/lib/google-calendar";
import { prisma } from "../src/lib/prisma";

const userId = process.argv[2];
const newName = process.argv[3] ?? "GoneSquirrel Tasks";
if (!userId) {
  console.error("usage: tsx scripts/rename-task-calendar.ts <userId> [newName]");
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
  const before = await client.calendars.get({ calendarId: integration.taskCalendarId });
  console.log("before:", before.data.summary);
  const after = await client.calendars.patch({
    calendarId: integration.taskCalendarId,
    requestBody: { summary: newName },
  });
  console.log("after:", after.data.summary);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
