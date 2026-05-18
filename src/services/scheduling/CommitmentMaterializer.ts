import { addDays, startOfDay, startOfISOWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
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

/**
 * True if a thrown GCal error is an OAuth/credential failure (expired or
 * revoked refresh token, 401). These must NOT be swallowed at warn level:
 * the user's commitment calendar silently stops materializing until they
 * reconnect Google. Surface at error level with an actionable message so
 * monitoring/operators see it (UAT: a mid-session invalid_grant degraded
 * the whole feature with only a buried warn).
 */
function isGoogleAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: number | string }).code;
  return (
    /invalid_grant|invalid_token|unauthorized|invalid credentials/i.test(msg) ||
    code === 401 ||
    code === "401"
  );
}

/** Log a swallowed GCal failure — error+actionable for auth, warn otherwise. */
function logGcalFailure(
  context: string,
  meta: Record<string, unknown>,
  err: unknown
): void {
  if (isGoogleAuthError(err)) {
    logger.error(
      `Google auth invalid (${context}) — commitment calendar sync is ` +
        `DEGRADED until the user reconnects their Google account. ` +
        `Occurrences are left unmaterialized, not silently dropped.`,
      { ...meta, error: String(err) },
      LOG_SOURCE
    );
  } else {
    logger.warn(context, { ...meta, error: String(err) }, LOG_SOURCE);
  }
}

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

/** Max days any single materialize/horizon request may span (DoS backstop). */
export const MAX_HORIZON_DAYS = 90;

const ALLOWED_FREQ = new Set<number>([
  RRule.DAILY,
  RRule.WEEKLY,
  RRule.MONTHLY,
]);

/**
 * Validate a user-supplied RFC5545 RRULE before it is persisted/expanded.
 * Returns an error message, or null if acceptable. Bounds the expansion so a
 * crafted rule (`FREQ=SECONDLY`, huge `COUNT`, far `UNTIL`) can't fan out into
 * thousands of GCal calls / a multi-MB response.
 */
export function validateRrule(rrule: string): string | null {
  let opts: { freq?: number; count?: number | null; interval?: number };
  try {
    opts = RRule.parseString(rrule) as typeof opts;
  } catch {
    return "Invalid recurrence rule";
  }
  if (opts.freq == null || !ALLOWED_FREQ.has(opts.freq)) {
    return "Recurrence FREQ must be DAILY, WEEKLY, or MONTHLY";
  }
  if (opts.count != null && opts.count > 366) {
    return "Recurrence COUNT must be 366 or fewer";
  }
  if (opts.interval != null && opts.interval > 52) {
    return "Recurrence INTERVAL must be 52 or fewer";
  }
  return null;
}

function overlaps(a: Interval, b: Interval): boolean {
  return (
    a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
  );
}

/**
 * UTC instant of wall-clock `hour:00` on the calendar date carried by the
 * UTC-midnight day key `day`, resolved in `timeZone`. Same date-fns-tz
 * authority as {@link isoWeekBounds} — DST-correct.
 */
function zonedHourOnDayKey(day: Date, hour: number, timeZone: string): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = day.getUTCFullYear();
  const m = pad(day.getUTCMonth() + 1);
  const d = pad(day.getUTCDate());
  // Interpret "<date>T<hour>:00:00" as wall-clock in timeZone → UTC instant.
  return fromZonedTime(`${y}-${m}-${d}T${pad(hour)}:00:00`, timeZone);
}

/**
 * Choose a slot of `durationMin` on `day` (UTC-midnight local-day key).
 * Tries `preferredHour` first, then scans the daytime window
 * [DAY_START_HOUR, EVENING_CUTOFF_HOUR) for the first gap not overlapping
 * `busy`. Returns null if none fits. The window and `preferredHour` are
 * wall-clock hours in `timeZone` (not UTC), so non-UTC users get slots on
 * the correct local hour and day.
 */
export function pickSlot(
  day: Date,
  durationMin: number,
  preferredHour: number | null,
  busy: Interval[],
  timeZone: string
): Interval | null {
  const durMs = durationMin * 60 * 1000;
  const dayStart = zonedHourOnDayKey(day, DAY_START_HOUR, timeZone);
  const windowEnd = zonedHourOnDayKey(day, EVENING_CUTOFF_HOUR, timeZone);

  const candidates: number[] = [];
  if (preferredHour != null) {
    candidates.push(zonedHourOnDayKey(day, preferredHour, timeZone).getTime());
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
 * UTC instant of (local midnight of `now`'s local day in `timeZone`) +
 * `horizonDays` LOCAL calendar days. Calendar-days, not horizonDays*24h:
 * a span crossing a DST tail is off by ±1 occurrence under UTC-exact ms
 * math (fall-back day = 25h, spring-forward = 23h). Same date-fns-tz
 * authority as {@link isoWeekBounds}.
 */
export function horizonEnd(
  now: Date,
  horizonDays: number,
  timeZone: string
): Date {
  const localStart = startOfDay(toZonedTime(now, timeZone));
  return fromZonedTime(addDays(localStart, horizonDays), timeZone);
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

  // Backstop clamp — never expand past MAX_HORIZON_DAYS even if a caller
  // (route, internal) passes an absurd value.
  const clampedHorizon = Math.min(
    Math.max(1, Math.floor(horizonDays)),
    MAX_HORIZON_DAYS
  );
  const now = new Date();
  const from = utcMidnight(now);
  // Horizon end = clampedHorizon CALENDAR days in the user's tz (not
  // clampedHorizon*24h of UTC) — DST-correct, no ±1 occurrence at a DST
  // tail. `from` stays UTC-midnight: per-occurrence keying is unchanged,
  // only the horizon boundary is tz-aware.
  const to = horizonEnd(now, clampedHorizon, ctx.timeZone);

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
    // Anchor recurrence phase to when the commitment was created — NOT the
    // rolling `from` (today). A rolling dtstart re-derives the phase every
    // run, flipping every-other-week (INTERVAL>1) rules and dropping/adding
    // phantom occurrences across runs.
    const occurrences = expandOccurrences(c.rrule, c.createdAt, from, to);

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

      // Phase C skip guard: an explicitly cancelled occurrence is a
      // per-occurrence skip. NEVER resurrect it — the skip route triggers a
      // recompute (this fn), and resurrecting here would silently undo the
      // skip. It stays cancelled until the user un-skips (which clears or
      // reactivates the row from the rrule).
      if (existing && existing.status === "cancelled") {
        continue;
      }

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
        logGcalFailure(
          "Commitment GCal insert threw; leaving planned for retry",
          { commitmentId: c.id, commitmentEventId },
          err
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

  // Backstop sweep (UAT orphan): the loop above can only reach a mirror via a
  // non-null CommitmentEvent.googleEventId. If a CE's googleEventId is null —
  // the move-recovery window (moveOccurrence nulls it before the GCal delete),
  // a partial materialize, or any desync — its tagged mirror is left behind
  // on the real calendar forever. Every commitment mirror is tagged
  // `gsCommitment:<commitmentEventId>` (materialize step c + moveOccurrence),
  // so sweep the feed by tag for ALL of this commitment's events (including
  // cancelled ones) and delete any survivor. Reflow temp blocks use a
  // different prefix (`gs:reflow:`) and are intentionally untouched here.
  if (ctx) {
    const allEvents = await prisma.commitmentEvent.findMany({
      where: { commitmentId },
    });
    const tags = allEvents.map((e) => `gsCommitment:${e.id}`);
    if (tags.length > 0) {
      const orphans = await prisma.calendarEvent.findMany({
        where: { feedId: ctx.feedId, description: { in: tags } },
      });
      for (const m of orphans) {
        if (m.externalEventId) {
          await deleteCommitmentGoogleEvent(
            ctx.client,
            ctx.googleCalendarId,
            m.externalEventId
          );
        }
        await prisma.calendarEvent.delete({ where: { id: m.id } });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Phase C — single-occurrence makeup (used by CommitmentAdjuster.skip)
// ---------------------------------------------------------------------------

/**
 * UTC instants bounding the ISO week (Mon 00:00 local → next Mon 00:00 local,
 * exclusive) that contains `date`, resolved in `timeZone`. Uses the same
 * date-fns-tz authority as the rest of the scheduler — DST-correct (a week
 * spanning a DST change is NOT 7×24h of UTC).
 */
export function isoWeekBounds(
  date: Date,
  timeZone: string
): { start: Date; end: Date } {
  const local = toZonedTime(date, timeZone);
  const localMon = startOfISOWeek(local);
  const localNextMon = addDays(localMon, 7);
  return {
    start: fromZonedTime(localMon, timeZone),
    end: fromZonedTime(localNextMon, timeZone),
  };
}

/**
 * Find a makeup slot for ONE commitment within a single ISO week and
 * materialize it (planned → GCal → mirror + materialized), reusing the exact
 * busy-set / `pickSlot` / 3-step contract as `materialize`. Deterministic:
 * first energy/daytime-valid slot wins, scanning days in week order. Never
 * evicts existing calendar/commitment/task time and never re-makes-up a
 * makeup (caller invokes this exactly once per skip).
 *
 * `excludeDateKey` = the skipped occurrence's day (never reused). Days that
 * already hold an active CommitmentEvent for THIS commitment are skipped too
 * (avoids the `@@unique([commitmentId,scheduledDate])` collision and
 * double-booking the same habit on one day). No slot anywhere → "conflict".
 */
export async function makeupOccurrence(
  commitmentId: string,
  isoWeek: { start: Date; end: Date },
  excludeDateKey: Date
): Promise<
  { status: "materialized"; start: Date; end: Date } | { status: "conflict" }
> {
  const commitment = await prisma.personalCommitment.findUnique({
    where: { id: commitmentId },
  });
  if (!commitment) return { status: "conflict" };

  const ctx = await getCommitmentCalendarContext(commitment.userId);
  if (!ctx) return { status: "conflict" };

  const from = isoWeek.start;
  const to = isoWeek.end;

  // Busy Interval[] — identical 3 sources as materialize, scoped to the week.
  const busy: Interval[] = [];

  const calEvents = await prisma.calendarEvent.findMany({
    where: {
      feedId: ctx.feedId,
      AND: [{ start: { lt: to } }, { end: { gt: from } }],
    },
  });
  for (const e of calEvents) busy.push({ start: e.start, end: e.end });

  const userCommitments = await prisma.personalCommitment.findMany({
    where: { userId: commitment.userId, active: true },
  });
  const commitmentIds = userCommitments.map((c) => c.id);
  if (!commitmentIds.includes(commitmentId)) commitmentIds.push(commitmentId);

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
      userId: commitment.userId,
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

  const occupiedDays = new Set<number>(
    existingEvents
      .filter((e) => e.commitmentId === commitmentId)
      .map((e) => utcMidnight(e.scheduledDate).getTime())
  );

  // Skip-respect guard (mirrors the cancelled guard in materialize): a day
  // holding a CANCELLED occurrence of THIS commitment was explicitly skipped
  // by the user. Never make-up onto it — the upsert would flip it
  // cancelled→planned→materialized and silently resurrect the skip.
  const cancelledForThis = await prisma.commitmentEvent.findMany({
    where: {
      commitmentId,
      status: "cancelled",
      scheduledDate: { gte: from, lt: to },
    },
  });
  for (const e of cancelledForThis) {
    occupiedDays.add(utcMidnight(e.scheduledDate).getTime());
  }

  const excludeKey = utcMidnight(excludeDateKey).getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (
    let day = utcMidnight(from);
    day.getTime() < to.getTime();
    day = new Date(day.getTime() + DAY_MS)
  ) {
    const key = day.getTime();
    if (key === excludeKey) continue;
    if (occupiedDays.has(key)) continue;

    const slot = pickSlot(
      day,
      commitment.durationMin,
      commitment.preferredHour ?? null,
      busy,
      ctx.timeZone
    );
    if (!slot) continue;

    const scheduledDate = day;

    // (a) Reserve planned.
    const ce = await prisma.commitmentEvent.upsert({
      where: {
        commitmentId_scheduledDate: { commitmentId, scheduledDate },
      },
      create: {
        commitmentId,
        scheduledDate,
        start: slot.start,
        end: slot.end,
        status: "planned",
      },
      update: { start: slot.start, end: slot.end, status: "planned" },
    });
    const commitmentEventId = ce.id;
    const summary = `${commitment.emoji} ${commitment.label}`;

    // (b) GCal insert OUTSIDE the tx. Failure → conflict (planned row left
    // for a future materialize retry; nothing evicted).
    let eventId: string | null = null;
    try {
      eventId = await insertCommitmentGoogleEvent(
        ctx.client,
        ctx.googleCalendarId,
        {
          summary,
          start: { dateTime: slot.start.toISOString(), timeZone: ctx.timeZone },
          end: { dateTime: slot.end.toISOString(), timeZone: ctx.timeZone },
          description: `gsCommitment:${commitmentEventId}`,
          tag: `gsCommitment:${commitmentEventId}`,
        }
      );
    } catch (err) {
      logGcalFailure(
        "Makeup GCal insert threw; reverting row to conflict",
        { commitmentId, commitmentEventId },
        err
      );
      // Release the slot: a left-behind "planned" row would otherwise enter
      // every future busy-set and silently block other commitments.
      await prisma.commitmentEvent.update({
        where: { id: commitmentEventId },
        data: { status: "conflict" },
      });
      return { status: "conflict" };
    }
    if (!eventId) {
      logger.warn(
        "Makeup GCal insert returned null; reverting row to conflict",
        { commitmentId, commitmentEventId },
        LOG_SOURCE
      );
      await prisma.commitmentEvent.update({
        where: { id: commitmentEventId },
        data: { status: "conflict" },
      });
      return { status: "conflict" };
    }

    // (c) Mirror + promote in ONE transaction.
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

    return { status: "materialized", start: slot.start, end: slot.end };
  }

  return { status: "conflict" };
}
