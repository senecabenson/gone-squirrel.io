/**
 * Scheduling-block follow-up #18: materialize horizon must be `horizonDays`
 * CALENDAR days in the user's timeZone, not horizonDays * 86_400_000 ms of
 * UTC. A horizon whose span crosses a DST tail is otherwise off by ±1
 * occurrence (the fall-back day is 25h, spring-forward 23h).
 *
 * `horizonEnd(now, horizonDays, timeZone)` → UTC instant of
 * (local midnight of now's local day) + horizonDays local calendar days.
 */

import { horizonEnd } from "@/services/scheduling/CommitmentMaterializer";

describe("horizonEnd — calendar-days-in-tz", () => {
  it("UTC: N days is exactly N*24h from local midnight", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    expect(horizonEnd(now, 14, "UTC").toISOString()).toBe(
      "2026-06-15T00:00:00.000Z"
    );
  });

  it("America/Los_Angeles: spans the Nov fall-back → one extra UTC hour vs naive ms math", () => {
    // now local = 2026-10-25 05:00 PDT → local midnight 2026-10-25T07:00Z.
    const now = new Date("2026-10-25T12:00:00Z");
    const end = horizonEnd(now, 10, "America/Los_Angeles");

    // +10 LOCAL days lands on 2026-11-04 00:00 PST (UTC-8, post fall-back)
    // = 2026-11-04T08:00:00Z.
    expect(end.toISOString()).toBe("2026-11-04T08:00:00.000Z");

    // Naive UTC-exact arithmetic (local midnight + 10*86_400_000) would give
    // 2026-11-04T07:00:00Z — one hour short because it ignores the 25h
    // fall-back day. The tz-aware result must be 1h later.
    const localMidnightUtc = new Date("2026-10-25T07:00:00Z").getTime();
    const naive = localMidnightUtc + 10 * 24 * 60 * 60 * 1000;
    expect(end.getTime() - naive).toBe(60 * 60 * 1000);
  });

  it("America/Los_Angeles: spring-forward span → one hour short vs naive ms math", () => {
    // now local = 2026-03-01 → DST spring-forward is 2026-03-08 (23h day).
    const now = new Date("2026-03-01T12:00:00Z");
    const end = horizonEnd(now, 14, "America/Los_Angeles");
    // local midnight 2026-03-01 = 08:00Z (PST -8); +14 local days =
    // 2026-03-15 00:00 PDT (-7) = 2026-03-15T07:00:00Z.
    expect(end.toISOString()).toBe("2026-03-15T07:00:00.000Z");

    const localMidnightUtc = new Date("2026-03-01T08:00:00Z").getTime();
    const naive = localMidnightUtc + 14 * 24 * 60 * 60 * 1000;
    expect(end.getTime() - naive).toBe(-60 * 60 * 1000);
  });
});
