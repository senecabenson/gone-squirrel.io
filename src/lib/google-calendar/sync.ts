import { calendar_v3 } from "googleapis";

import { createAllDayDate, newDate, newDateFromYMD } from "@/lib/date-utils";
import { getGoogleCalendarClient } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

function processRecurrenceRule(
  recurrence: string[] | null | undefined,
  startDate?: Date
): string | undefined {
  if (!recurrence || recurrence.length === 0) return undefined;
  const rrule = recurrence.find((r) => r.startsWith("RRULE:"));
  if (!rrule) return undefined;

  if (rrule.includes("FREQ=YEARLY") && startDate) {
    const hasMonth = rrule.includes("BYMONTH=");
    const hasMonthDay = rrule.includes("BYMONTHDAY=");
    if (!hasMonth || !hasMonthDay) {
      let parts = rrule.split(";");
      parts = parts.filter(
        (part) =>
          !part.startsWith("BYMONTH=") && !part.startsWith("BYMONTHDAY=")
      );
      parts.push(`BYMONTH=${startDate.getMonth() + 1}`);
      parts.push(`BYMONTHDAY=${startDate.getDate()}`);
      return parts.join(";");
    }
  }

  return rrule;
}

async function fetchAllEvents(
  client: calendar_v3.Calendar,
  params: calendar_v3.Params$Resource$Events$List
): Promise<calendar_v3.Schema$Event[]> {
  const items: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined = undefined;
  while (true) {
    const res: { data: calendar_v3.Schema$Events } = await client.events.list({
      ...params,
      pageToken,
    });
    if (res.data.items) items.push(...res.data.items);
    pageToken = res.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }
  return items;
}

export async function syncGoogleCalendarFeed(feedId: string, userId: string) {
  const feed = await prisma.calendarFeed.findUnique({
    where: { id: feedId, userId },
    include: { account: true },
  });

  if (!feed || !feed.accountId || !feed.url) {
    throw new Error("Feed not found");
  }

  const client = await getGoogleCalendarClient(feed.accountId, userId);

  const events = await fetchAllEvents(client, {
    calendarId: feed.url,
    timeMin: newDateFromYMD(newDate().getFullYear(), 0, 1).toISOString(),
    timeMax: newDateFromYMD(newDate().getFullYear() + 1, 0, 1).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  const recurringEvents = events.filter(
    (event) =>
      event.recurringEventId && typeof event.recurringEventId === "string"
  );
  const masterEvents = new Map<string, string[]>();

  for (const event of recurringEvents) {
    const eventId = event.recurringEventId;
    if (
      eventId &&
      !masterEvents.has(eventId) &&
      typeof eventId === "string" &&
      feed.url
    ) {
      try {
        const masterEvent = await client.events.get({
          calendarId: feed.url,
          eventId,
        });
        const recurrence = masterEvent.data?.recurrence;
        if (Array.isArray(recurrence)) {
          masterEvents.set(eventId, recurrence);
        }
      } catch {
        // Skip masters we can't fetch
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.calendarEvent.deleteMany({ where: { feedId } });
  });

  await prisma.$transaction(
    async (tx) => {
      for (const event of events) {
        if (!event.start?.dateTime && !event.start?.date) continue;

        if (event.recurringEventId) {
          event.recurrence = masterEvents.get(event.recurringEventId);
        }

        const isAllDay = event.start ? !event.start.dateTime : false;

        await tx.calendarEvent.create({
          data: {
            id: event.id || undefined,
            feedId: feed.id,
            externalEventId: event.id,
            title: event.summary || "Untitled Event",
            description: event.description || "",
            start: isAllDay
              ? createAllDayDate(event.start.date || "")
              : newDate(event.start.dateTime || event.start.date || ""),
            end: isAllDay
              ? createAllDayDate(event.end?.date || "")
              : newDate(event.end?.dateTime || event.end?.date || ""),
            location: event.location,
            isRecurring: !!event.recurringEventId || !!event.recurrence,
            recurringEventId: event.recurringEventId,
            recurrenceRule: processRecurrenceRule(
              event.recurrence,
              event.start
                ? newDate(event.start?.dateTime || event.start?.date || "")
                : undefined
            ),
            allDay: isAllDay,
            status: event.status,
            transparency: event.transparency || "opaque",
            sequence: event.sequence,
            created: event.created ? newDate(event.created) : undefined,
            lastModified: event.updated ? newDate(event.updated) : undefined,
            organizer: event.organizer
              ? {
                  name: event.organizer.displayName,
                  email: event.organizer.email,
                }
              : undefined,
            attendees: event.attendees?.map(
              (a: calendar_v3.Schema$EventAttendee) => ({
                name: a.displayName,
                email: a.email,
                status: a.responseStatus,
              })
            ),
          },
        });
      }

      await tx.calendarFeed.update({
        where: { id: feedId, userId },
        data: { lastSync: newDate(), error: null },
      });
    },
    { timeout: 30000 }
  );

  return { eventCount: events.length };
}
