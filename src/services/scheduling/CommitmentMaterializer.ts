import { RRule } from "rrule";

import { EVENING_CUTOFF_HOUR } from "./BlockCalendarService";

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
