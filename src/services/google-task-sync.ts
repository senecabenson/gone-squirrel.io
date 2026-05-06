import { Task } from "@prisma/client";

import { getGoogleCalendarClient } from "@/lib/google-calendar";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const LOG_SOURCE = "google-task-sync";
const TASK_CALENDAR_NAME = "GoneSquirrel Tasks";
const COMPLETED_COLOR_ID = "8"; // graphite/gray in Google Calendar
const STRIKE_COMBINING = "̶"; // long stroke overlay

function strikethrough(title: string): string {
  return Array.from(title).join(STRIKE_COMBINING) + STRIKE_COMBINING;
}

async function getPrimaryGoogleAccountId(
  userId: string
): Promise<string | null> {
  const account = await prisma.connectedAccount.findFirst({
    where: { userId, provider: "GOOGLE" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return account?.id ?? null;
}

async function getUserTimeZone(userId: string): Promise<string> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { timeZone: true },
  });
  return settings?.timeZone ?? "UTC";
}

async function getOrCreateTaskCalendar(
  userId: string,
  accountId: string,
  timeZone: string
): Promise<string> {
  const integration = await prisma.integrationSettings.findUnique({
    where: { userId },
    select: { taskCalendarId: true },
  });
  let calendarId = integration?.taskCalendarId ?? null;
  const calendar = await getGoogleCalendarClient(accountId, userId);

  if (calendarId) {
    try {
      await calendar.calendarList.get({ calendarId });
      return calendarId;
    } catch (err: unknown) {
      const status = (err as { code?: number }).code;
      if (status !== 404 && status !== 410) throw err;
      logger.info(
        "Task calendar gone in GCal; recreating",
        { userId, calendarId },
        LOG_SOURCE
      );
      calendarId = null;
      await prisma.integrationSettings.update({
        where: { userId },
        data: { taskCalendarId: null },
      });
      await prisma.task.updateMany({
        where: { userId, googleEventId: { not: null } },
        data: { googleEventId: null },
      });
    }
  }

  const created = await calendar.calendars.insert({
    requestBody: { summary: TASK_CALENDAR_NAME, timeZone },
  });
  calendarId = created.data.id ?? null;
  if (!calendarId) {
    throw new Error("Google Calendar create returned no id");
  }
  await prisma.integrationSettings.upsert({
    where: { userId },
    update: { taskCalendarId: calendarId },
    create: { userId, taskCalendarId: calendarId },
  });
  return calendarId;
}

type GCalClient = Awaited<ReturnType<typeof getGoogleCalendarClient>>;

async function pushOne(
  task: Task,
  calendarId: string,
  client: GCalClient,
  timeZone: string
): Promise<void> {
  const isCompleted = task.status === "completed";
  const hasSchedule =
    task.scheduledStart != null && task.scheduledEnd != null;

  // Completed task with mirrored event: strike + recolor, leave times alone.
  if (isCompleted && task.googleEventId) {
    try {
      await client.events.patch({
        calendarId,
        eventId: task.googleEventId,
        requestBody: {
          summary: strikethrough(task.title),
          colorId: COMPLETED_COLOR_ID,
        },
      });
    } catch (err: unknown) {
      const status = (err as { code?: number }).code;
      if (status === 404 || status === 410) {
        await prisma.task.update({
          where: { id: task.id },
          data: { googleEventId: null },
        });
        return;
      }
      throw err;
    }
    return;
  }

  // Unscheduled (and not completed) but has mirrored event → delete it.
  if (!hasSchedule && task.googleEventId) {
    try {
      await client.events.delete({
        calendarId,
        eventId: task.googleEventId,
      });
    } catch (err: unknown) {
      const status = (err as { code?: number }).code;
      if (status !== 404 && status !== 410) throw err;
    }
    await prisma.task.update({
      where: { id: task.id },
      data: { googleEventId: null },
    });
    return;
  }

  if (!hasSchedule) return;

  const start = {
    dateTime: task.scheduledStart!.toISOString(),
    timeZone,
  };
  const end = {
    dateTime: task.scheduledEnd!.toISOString(),
    timeZone,
  };

  // Update existing mirrored event.
  if (task.googleEventId) {
    try {
      await client.events.patch({
        calendarId,
        eventId: task.googleEventId,
        requestBody: {
          summary: task.title,
          start,
          end,
          colorId: null,
        },
      });
      return;
    } catch (err: unknown) {
      const status = (err as { code?: number }).code;
      if (status !== 404 && status !== 410) throw err;
      // Event missing — fall through to insert.
      await prisma.task.update({
        where: { id: task.id },
        data: { googleEventId: null },
      });
    }
  }

  // Look-before-insert: an event tagged with this taskId may already exist
  // (concurrent insert, crashed retry that succeeded in GCal but failed to
  // persist googleEventId). Adopt it instead of creating a duplicate.
  try {
    const existing = await client.events.list({
      calendarId,
      privateExtendedProperty: [`taskId=${task.id}`],
      showDeleted: false,
      singleEvents: true,
      maxResults: 5,
    });
    const adopt = (existing.data.items ?? []).find((e) => !!e.id);
    if (adopt?.id) {
      await prisma.task.update({
        where: { id: task.id },
        data: { googleEventId: adopt.id },
      });
      await client.events.patch({
        calendarId,
        eventId: adopt.id,
        requestBody: {
          summary: isCompleted ? strikethrough(task.title) : task.title,
          start,
          end,
          colorId: isCompleted ? COMPLETED_COLOR_ID : null,
        },
      });
      return;
    }
  } catch (err: unknown) {
    logger.warn(
      "look-before-insert events.list failed; proceeding to insert",
      {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      },
      LOG_SOURCE
    );
  }

  // Insert fresh event tagged with taskId so future syncs can find it.
  const created = await client.events.insert({
    calendarId,
    requestBody: {
      summary: isCompleted ? strikethrough(task.title) : task.title,
      description: task.description ?? undefined,
      start,
      end,
      colorId: isCompleted ? COMPLETED_COLOR_ID : undefined,
      extendedProperties: { private: { taskId: task.id } },
    },
  });
  const eventId = created.data.id;
  if (!eventId) {
    logger.warn(
      "Google insert returned no event id",
      { taskId: task.id },
      LOG_SOURCE
    );
    return;
  }
  await prisma.task.update({
    where: { id: task.id },
    data: { googleEventId: eventId },
  });
}

export async function syncScheduledTasksToGoogle(
  userId: string
): Promise<void> {
  const accountId = await getPrimaryGoogleAccountId(userId);
  if (!accountId) {
    logger.info(
      "Skipping task→GCal push: no connected Google account",
      { userId },
      LOG_SOURCE
    );
    return;
  }

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      OR: [{ isAutoScheduled: true }, { googleEventId: { not: null } }],
    },
  });
  if (tasks.length === 0) return;

  const timeZone = await getUserTimeZone(userId);
  const calendarId = await getOrCreateTaskCalendar(
    userId,
    accountId,
    timeZone
  );
  const client = await getGoogleCalendarClient(accountId, userId);

  for (const task of tasks) {
    try {
      await pushOne(task, calendarId, client, timeZone);
    } catch (err: unknown) {
      logger.error(
        "Failed to push task to Google Calendar",
        {
          taskId: task.id,
          error: err instanceof Error ? err.message : String(err),
        },
        LOG_SOURCE
      );
    }
  }
}

export async function deleteTaskGoogleEvent(
  userId: string,
  googleEventId: string
): Promise<void> {
  const accountId = await getPrimaryGoogleAccountId(userId);
  if (!accountId) return;
  const integration = await prisma.integrationSettings.findUnique({
    where: { userId },
    select: { taskCalendarId: true },
  });
  const calendarId = integration?.taskCalendarId;
  if (!calendarId) return;
  const client = await getGoogleCalendarClient(accountId, userId);
  try {
    await client.events.delete({ calendarId, eventId: googleEventId });
  } catch (err: unknown) {
    const status = (err as { code?: number }).code;
    if (status !== 404 && status !== 410) {
      logger.error(
        "Failed to delete mirrored Google event",
        {
          userId,
          googleEventId,
          error: err instanceof Error ? err.message : String(err),
        },
        LOG_SOURCE
      );
    }
  }
}

export async function syncSingleTaskToGoogle(
  userId: string,
  taskId: string
): Promise<void> {
  const accountId = await getPrimaryGoogleAccountId(userId);
  if (!accountId) return;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.userId !== userId) return;

  const timeZone = await getUserTimeZone(userId);
  const calendarId = await getOrCreateTaskCalendar(
    userId,
    accountId,
    timeZone
  );
  const client = await getGoogleCalendarClient(accountId, userId);

  try {
    await pushOne(task, calendarId, client, timeZone);
  } catch (err: unknown) {
    logger.error(
      "Failed to push single task to Google Calendar",
      {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      },
      LOG_SOURCE
    );
  }
}
