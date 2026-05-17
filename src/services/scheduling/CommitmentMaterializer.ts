import { RRule } from "rrule";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  getCommitmentCalendarContext,
  insertCommitmentGoogleEvent,
  deleteCommitmentGoogleEvent,
} from "@/services/google-task-sync";

import { EVENING_CUTOFF_HOUR } from "./BlockCalendarService";

const LOG_SOURCE = "CommitmentMaterializer";

/** Earliest local hour a commitment may be auto-placed. */
export const DAY_START_HOUR = 6;
const STEP_MS = 15 * 60 * 1000;

export interface Interval {
  start: Date;
  end: Date;
}

/**
 * Expand an RFC5545 RRULE between [from, to] (inclusive), anchored at dtstart.
 * Pure + deterministic — the testable core of recurrence handling.
 */
export function expandOccurrences(
  rruleStr: string,
  dtstart: Date,
  from: Date,
  to: Date
): Date[] {
  const options = RRule.parseString(rruleStr);
  options.dtstart = dtstart;
  const rule = new RRule(options);
  return rule.between(from, to, true);
}

function overlaps(a: Interval, b: Interval): boolean {
  return (
    a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
  );
}

/**
 * Choose a slot of `durationMin` on `day` (UTC-midnight local-day key).
 * Tries `preferredHour` first, then scans the daytime window
 * [DAY_START_HOUR, EVENING_CUTOFF_HOUR) for the first gap not overlapping
 * `busy`. Returns null if none fits. `timeZone` is accepted for parity with
 * the rest of the scheduler; arithmetic is on the day key (v1).
 */
export function pickSlot(
  day: Date,
  durationMin: number,
  preferredHour: number | null,
  busy: Interval[],
  _timeZone: string
): Interval | null {
  void _timeZone; // reserved for tz-aware placement (v2); kept for API parity
  const durMs = durationMin * 60 * 1000;
  const dayStart = new Date(day);
  dayStart.setUTCHours(DAY_START_HOUR, 0, 0, 0);
  const windowEnd = new Date(day);
  windowEnd.setUTCHours(EVENING_CUTOFF_HOUR, 0, 0, 0);

  const candidates: number[] = [];
  if (preferredHour != null) {
    const pref = new Date(day);
    pref.setUTCHours(preferredHour, 0, 0, 0);
    candidates.push(pref.getTime());
  }
  for (let t = dayStart.getTime(); t < windowEnd.getTime(); t += STEP_MS) {
    candidates.push(t);
  }

  for (const startMs of candidates) {
    const start = new Date(startMs);
    const end = new Date(startMs + durMs);
    if (start < dayStart || end > windowEnd) continue;
    const slot = { start, end };
    if (busy.some((b) => overlaps(slot, b))) continue;
    return slot;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Impure materializer (writes GCal + CalendarEvent mirror + CommitmentEvent)
// ---------------------------------------------------------------------------

export interface MaterializeResult {
  created: number;
  materialized: number;
  conflicts: number;
  skipped: number;
}

function utcMidnight(d: Date): Date {
  const m = new Date(d);
  m.setUTCHours(0, 0, 0, 0);
  return m;
}

/**
 * Materialize all active PersonalCommitments for `userId` over the next
 * `horizonDays`. Idempotent: an occurrence already materialized at the same
 * slot is left untouched (no GCal insert, no new mirror row). Never evicts
 * existing calendar/commitment/task time — a missing slot becomes a
 * "conflict" CommitmentEvent. Must never throw (called by the work scheduler).
 */
export async function materialize(
  userId: string,
  horizonDays = 14
): Promise<MaterializeResult> {
  const result: MaterializeResult = {
    created: 0,
    materialized: 0,
    conflicts: 0,
    skipped: 0,
  };

  const ctx = await getCommitmentCalendarContext(userId);
  if (!ctx) return result;

  const commitments = await prisma.personalCommitment.findMany({
    where: { userId, active: true },
  });
  if (commitments.length === 0) return result;

  const from = utcMidnight(new Date());
  const to = new Date(from.getTime() + horizonDays * 24 * 60 * 60 * 1000);

  const commitmentIds = commitments.map((c) => c.id);

  // Build the busy Interval[] ONCE.
  const busy: Interval[] = [];

  const calEvents = await prisma.calendarEvent.findMany({
    where: {
      feedId: ctx.feedId,
      AND: [{ start: { lt: to } }, { end: { gt: from } }],
    },
  });
  for (const e of calEvents) busy.push({ start: e.start, end: e.end });

  const existingEvents = await prisma.commitmentEvent.findMany({
    where: {
      commitmentId: { in: commitmentIds },
      status: { in: ["planned", "materialized"] },
      scheduledDate: { gte: from, lt: to },
    },
  });
  for (const e of existingEvents) busy.push({ start: e.start, end: e.end });

  const userTasks = await prisma.task.findMany({
    where: {
      userId,
      scheduledStart: { not: null },
      scheduledEnd: { not: null },
      AND: [{ scheduledStart: { lt: to } }, { scheduledEnd: { gt: from } }],
    },
  });
  for (const t of userTasks) {
    if (t.scheduledStart && t.scheduledEnd) {
      busy.push({ start: t.scheduledStart, end: t.scheduledEnd });
    }
  }

  for (const c of commitments) {
    const occurrences = expandOccurrences(c.rrule, from, from, to);

    for (const occ of occurrences) {
      const scheduledDate = utcMidnight(occ);

      const existing = await prisma.commitmentEvent.findUnique({
        where: {
          commitmentId_scheduledDate: {
            commitmentId: c.id,
            scheduledDate,
          },
        },
      });

      // Idempotency guard: an occurrence already materialized with a GCal
      // event is left fully untouched — no re-pick, no GCal insert, no new
      // mirror row. Its slot was already reserved in `busy` from the
      // existing-events query, so a second run is a pure no-op for it.
      if (
        existing &&
        existing.status === "materialized" &&
        existing.googleEventId
      ) {
        result.materialized++;
        continue;
      }

      const slot = pickSlot(
        scheduledDate,
        c.durationMin,
        c.preferredHour ?? null,
        busy,
        ctx.timeZone
      );

      if (!slot) {
        await prisma.commitmentEvent.upsert({
          where: {
            commitmentId_scheduledDate: {
              commitmentId: c.id,
              scheduledDate,
            },
          },
          create: {
            commitmentId: c.id,
            scheduledDate,
            start: existing?.start ?? scheduledDate,
            end: existing?.end ?? scheduledDate,
            status: "conflict",
          },
          update: { status: "conflict" },
        });
        result.conflicts++;
        continue;
      }

      // (a) Reserve the slot as a planned CommitmentEvent.
      const ce = await prisma.commitmentEvent.upsert({
        where: {
          commitmentId_scheduledDate: {
            commitmentId: c.id,
            scheduledDate,
          },
        },
        create: {
          commitmentId: c.id,
          scheduledDate,
          start: slot.start,
          end: slot.end,
          status: "planned",
        },
        update: {
          start: slot.start,
          end: slot.end,
          status: "planned",
        },
      });
      const commitmentEventId = ce.id;
      const summary = `${c.emoji} ${c.label}`;

      // (b) GCal insert — OUTSIDE the prisma tx (Google SDK can't join it).
      let eventId: string | null = null;
      try {
        eventId = await insertCommitmentGoogleEvent(
          ctx.client,
          ctx.googleCalendarId,
          {
            summary,
            start: {
              dateTime: slot.start.toISOString(),
              timeZone: ctx.timeZone,
            },
            end: {
              dateTime: slot.end.toISOString(),
              timeZone: ctx.timeZone,
            },
            description: `gsCommitment:${commitmentEventId}`,
            tag: `gsCommitment:${commitmentEventId}`,
          }
        );
      } catch (err) {
        logger.warn(
          "Commitment GCal insert threw; leaving planned for retry",
          { commitmentId: c.id, commitmentEventId, error: String(err) },
          LOG_SOURCE
        );
        result.skipped++;
        continue;
      }
      if (!eventId) {
        logger.warn(
          "Commitment GCal insert returned null; leaving planned for retry",
          { commitmentId: c.id, commitmentEventId },
          LOG_SOURCE
        );
        result.skipped++;
        continue;
      }

      // (c) Mirror + promote to materialized in ONE transaction.
      await prisma.$transaction(async (tx) => {
        await tx.calendarEvent.create({
          data: {
            feedId: ctx.feedId,
            title: summary,
            description: `gsCommitment:${commitmentEventId}`,
            start: slot.start,
            end: slot.end,
            externalEventId: eventId,
            transparency: "opaque",
          },
        });
        await tx.commitmentEvent.update({
          where: { id: commitmentEventId },
          data: { status: "materialized", googleEventId: eventId },
        });
      });

      // (d) Count + reserve the slot for the rest of THIS run.
      result.created++;
      result.materialized++;
      busy.push({ start: slot.start, end: slot.end });
    }

    await prisma.personalCommitment.update({
      where: { id: c.id },
      data: { lastMaterializedThrough: to },
    });
  }

  return result;
}

/**
 * Revoke all materialized occurrences of a commitment: delete the GCal events
 * and their mirrored CalendarEvents, mark CommitmentEvents cancelled.
 * Per-occurrence and fully idempotent (a second call is a no-op).
 */
export async function revoke(commitmentId: string): Promise<void> {
  const commitment = await prisma.personalCommitment.findUnique({
    where: { id: commitmentId },
  });
  if (!commitment) return;

  const ctx = await getCommitmentCalendarContext(commitment.userId);

  const events = await prisma.commitmentEvent.findMany({
    where: { commitmentId, status: { not: "cancelled" } },
  });

  for (const ev of events) {
    if (ctx && ev.googleEventId) {
      await deleteCommitmentGoogleEvent(
        ctx.client,
        ctx.googleCalendarId,
        ev.googleEventId
      );
      await prisma.calendarEvent.deleteMany({
        where: { feedId: ctx.feedId, externalEventId: ev.googleEventId },
      });
    }
    await prisma.commitmentEvent.update({
      where: { id: ev.id },
      data: { status: "cancelled" },
    });
  }
}
