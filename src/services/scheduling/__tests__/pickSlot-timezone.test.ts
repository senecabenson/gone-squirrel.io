/**
 * Scheduling-block follow-up #14: pickSlot timezone correctness.
 *
 * v1 pickSlot did all hour math with setUTCHours, so the daytime window
 * [DAY_START_HOUR, EVENING_CUTOFF_HOUR) and preferredHour were anchored to
 * UTC. A non-UTC user got slots on the wrong wall-clock hour (and, near a
 * day boundary, the wrong day). These tests pin the window + preferredHour
 * to wall-clock hours in the supplied IANA timeZone, mirroring the
 * isoWeekBounds toZonedTime/fromZonedTime authority.
 *
 * DAY_START_HOUR = 6, EVENING_CUTOFF_HOUR = 19.
 */

import { pickSlot } from "@/services/scheduling/CommitmentMaterializer";

/** UTC-midnight day key for a calendar date (as the materializer produces). */
function dayKey(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("pickSlot timezone awareness", () => {
  it("places preferredHour at local wall-clock for a negative offset (America/Los_Angeles, PDT -7)", () => {
    // 10:00 PDT on 2026-06-15 = 17:00Z same day.
    const slot = pickSlot(
      dayKey("2026-06-15"),
      60,
      10,
      [],
      "America/Los_Angeles"
    );
    expect(slot?.start.toISOString()).toBe("2026-06-15T17:00:00.000Z");
    expect(slot?.end.toISOString()).toBe("2026-06-15T18:00:00.000Z");
  });

  it("scans the daytime window from local 06:00, not 06:00 UTC (America/Los_Angeles)", () => {
    // No preferredHour → first candidate is DAY_START_HOUR (06:00) local.
    // 06:00 PDT on 2026-06-15 = 13:00Z.
    const slot = pickSlot(dayKey("2026-06-15"), 30, null, [], "America/Los_Angeles");
    expect(slot?.start.toISOString()).toBe("2026-06-15T13:00:00.000Z");
  });

  it("places preferredHour correctly for a positive half-hour offset (Asia/Kolkata +5:30)", () => {
    // 10:00 IST on 2026-06-15 = 04:30Z same day.
    const slot = pickSlot(dayKey("2026-06-15"), 60, 10, [], "Asia/Kolkata");
    expect(slot?.start.toISOString()).toBe("2026-06-15T04:30:00.000Z");
  });

  it("stays wall-clock correct across a spring-forward DST date (America/Los_Angeles 2026-03-08)", () => {
    // DST gap is 02:00→03:00 local; the 08:00 preferred hour is post-transition
    // (PDT, UTC-7), so 08:00 local on 2026-03-08 = 15:00Z (NOT the -8 PST
    // 16:00Z a UTC-naive impl would imply for that calendar date).
    const slot = pickSlot(
      dayKey("2026-03-08"),
      60,
      8,
      [],
      "America/Los_Angeles"
    );
    expect(slot?.start.toISOString()).toBe("2026-03-08T15:00:00.000Z");
  });

  it("still works for UTC (identity)", () => {
    const slot = pickSlot(dayKey("2026-06-15"), 60, 9, [], "UTC");
    expect(slot?.start.toISOString()).toBe("2026-06-15T09:00:00.000Z");
  });
});
