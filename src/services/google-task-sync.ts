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

interface UserCalendarContext {
  client: GCalClient;
  calendarId: string;
  timeZone: string;
}

async function getUserCalendarContext(
  userId: string
): Promise<UserCalendarContext | null> {
  const accountId = await getPrimaryGoogleAccountId(userId);
  if (!accountId) {
    logger.info(
      "Skipping GCal operation: no connected Google account",
      { userId },
      LOG_SOURCE
    );
    return null;
  }
  const timeZone = await getUserTimeZone(userId);
  const calendarId = await getOrCreateTaskCalendar(userId, accountId, timeZone);
  const client = await getGoogleCalendarClient(accountId, userId);
  return { client, calendarId, timeZone };
}

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
  const ctx = await getUserCalendarContext(userId);
  if (!ctx) return;

  const { client, calendarId, timeZone } = ctx;

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      OR: [{ isAutoScheduled: true }, { googleEventId: { not: null } }],
    },
  });

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

  const allChunks = await prisma.taskChunk.findMany({
    where: { task: { userId } },
    select: {
      id: true,
      taskId: true,
      chunkIndex: true,
      totalChunks: true,
      durationMin: true,
      scheduledStart: true,
      scheduledEnd: true,
      googleEventId: true,
      status: true,
    },
  });
  for (const chunk of allChunks) {
    try {
      await pushChunk(chunk, calendarId, client, timeZone);
    } catch (err: unknown) {
      logger.error(
        "Failed to push chunk to Google Calendar",
        {
          chunkId: chunk.id,
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

const CHUNK_COMPLETED_COLOR_ID = "2"; // sage green — chunks use green for done
const CHUNK_SCHEDULED_COLOR_ID = "8"; // graphite/gray — chunks use gray when scheduled

interface TaskChunkSyncInput {
  id: string;
  taskId: string;
  chunkIndex: number;
  totalChunks: number;
  durationMin: number;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  googleEventId: string | null;
  status: string;
}

export async function pushChunk(
  chunk: TaskChunkSyncInput,
  calendarId: string,
  client: GCalClient,
  timeZone: string
): Promise<void> {
  const hasSchedule = chunk.scheduledStart != null && chunk.scheduledEnd != null;
  const isCompleted = chunk.status === "completed";

  const parent = await prisma.task.findUnique({
    where: { id: chunk.taskId },
    select: { title: true },
  });
  if (!parent) return;

  const baseSummary = `${parent.title} · chunk ${chunk.chunkIndex}/${chunk.totalChunks}`;

  // Completed + has event: strike title + recolor sage green.
  if (isCompleted && chunk.googleEventId) {
    try {
      await client.events.patch({
        calendarId,
        eventId: chunk.googleEventId,
        requestBody: {
          summary: strikethrough(baseSummary),
          colorId: CHUNK_COMPLETED_COLOR_ID,
        },
      });
    } catch (err: unknown) {
      const status = (err as { code?: number }).code;
      if (status === 404 || status === 410) {
        await prisma.taskChunk.update({
          where: { id: chunk.id },
          data: { googleEventId: null },
        });
        return;
      }
      throw err;
    }
    return;
  }

  // No schedule + has event: delete the event.
  if (!hasSchedule) {
    if (chunk.googleEventId) {
      await client.events
        .delete({ calendarId, eventId: chunk.googleEventId })
        .catch(() => {});
      await prisma.taskChunk.update({
        where: { id: chunk.id },
        data: { googleEventId: null },
      });
    }
    return;
  }

  // Has schedule: prepare start/end objects.
  const start = { dateTime: chunk.scheduledStart!.toISOString(), timeZone };
  const end = { dateTime: chunk.scheduledEnd!.toISOString(), timeZone };

  // Has schedule + existing event: patch it.
  if (chunk.googleEventId) {
    try {
      await client.events.patch({
        calendarId,
        eventId: chunk.googleEventId,
        requestBody: { summary: baseSummary, start, end },
      });
      return;
    } catch (err: unknown) {
      const status = (err as { code?: number }).code;
      if (status !== 404 && status !== 410) throw err;
      // Event gone — fall through to look-before-insert.
      await prisma.taskChunk.update({
        where: { id: chunk.id },
        data: { googleEventId: null },
      });
    }
  }

  // Look-before-insert: avoid duplicates on retries.
  try {
    const existing = await client.events.list({
      calendarId,
      privateExtendedProperty: [`chunkId=${chunk.id}`],
      showDeleted: false,
      singleEvents: true,
      maxResults: 1,
    });
    const adopt = existing.data.items?.[0];
    if (adopt?.id) {
      await prisma.taskChunk.update({
        where: { id: chunk.id },
        data: { googleEventId: adopt.id },
      });
      return;
    }
  } catch (err: unknown) {
    logger.warn(
      "chunk look-before-insert events.list failed; proceeding to insert",
      {
        chunkId: chunk.id,
        error: err instanceof Error ? err.message : String(err),
      },
      LOG_SOURCE
    );
  }

  // Insert fresh event tagged with taskId + chunkId.
  const created = await client.events.insert({
    calendarId,
    requestBody: {
      summary: baseSummary,
      start,
      end,
      colorId: CHUNK_SCHEDULED_COLOR_ID,
      extendedProperties: {
        private: { taskId: chunk.taskId, chunkId: chunk.id },
      },
    },
  });
  const eventId = created.data.id;
  if (!eventId) {
    logger.warn(
      "Google insert returned no event id for chunk",
      { chunkId: chunk.id },
      LOG_SOURCE
    );
    return;
  }
  await prisma.taskChunk.update({
    where: { id: chunk.id },
    data: { googleEventId: eventId },
  });
}

/**
 * Delete GCal events for a set of chunks (e.g. when a parent task is closed
 * early). Nulls out `googleEventId` on each chunk after deletion.
 * Used by /api/focus/complete-parent.
 */
export async function deleteChunkEvents(
  chunks: Array<{ id: string; googleEventId: string | null }>,
  userId: string
): Promise<void> {
  if (chunks.length === 0) return;
  const ctx = await getUserCalendarContext(userId);
  if (!ctx) return;
  for (const c of chunks) {
    if (!c.googleEventId) continue;
    await ctx.client.events
      .delete({ calendarId: ctx.calendarId, eventId: c.googleEventId })
      .catch(() => {});
    await prisma.taskChunk.update({
      where: { id: c.id },
      data: { googleEventId: null },
    });
  }
}

export async function syncChunksToGoogle(
  userId: string,
  chunkIds: string[]
): Promise<void> {
  if (chunkIds.length === 0) return;
  const ctx = await getUserCalendarContext(userId);
  if (!ctx) return;
  const { client, calendarId, timeZone } = ctx;

  const chunks = await prisma.taskChunk.findMany({
    where: { id: { in: chunkIds } },
    select: {
      id: true, taskId: true, chunkIndex: true, totalChunks: true,
      durationMin: true, scheduledStart: true, scheduledEnd: true,
      googleEventId: true, status: true,
    },
  });

  for (const chunk of chunks) {
    try {
      await pushChunk(chunk, calendarId, client, timeZone);
    } catch (err) {
      logger.error(
        "Failed to push chunk to GCal",
        {
          userId,
          chunkId: chunk.id,
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
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.userId !== userId) return;

  const ctx = await getUserCalendarContext(userId);
  if (!ctx) return;

  const { client, calendarId, timeZone } = ctx;

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
