import {
  expandOccurrences,
  pickSlot,
} from "../CommitmentMaterializer";

describe("expandOccurrences", () => {
  it("expands FREQ=WEEKLY;BYDAY=TU,TH over a 14-day horizon", () => {
    // 2026-05-18 is a Monday → first TU=05-19, TH=05-21, 05-26, 05-28
    const from = new Date("2026-05-18T00:00:00Z");
    const to = new Date("2026-06-01T00:00:00Z");
    const dates = expandOccurrences(
      "FREQ=WEEKLY;BYDAY=TU,TH",
      from,
      from,
      to
    );
    const ymd = dates.map((d) => d.toISOString().slice(0, 10));
    expect(ymd).toEqual(["2026-05-19", "2026-05-21", "2026-05-26", "2026-05-28"]);
  });

  it("returns nothing when the window precedes the first occurrence", () => {
    const dtstart = new Date("2026-06-01T00:00:00Z");
    const dates = expandOccurrences(
      "FREQ=WEEKLY;BYDAY=MO",
      dtstart,
      new Date("2026-05-01T00:00:00Z"),
      new Date("2026-05-15T00:00:00Z")
    );
    expect(dates).toHaveLength(0);
  });
});

describe("pickSlot", () => {
  const day = new Date("2026-05-19T00:00:00Z"); // UTC tz in tests

  it("places at preferredHour when that window is free", () => {
    const slot = pickSlot(day, 60, 16, [], "UTC");
    expect(slot).toEqual({
      start: new Date("2026-05-19T16:00:00Z"),
      end: new Date("2026-05-19T17:00:00Z"),
    });
  });

  it("falls back to the first free daytime window when preferredHour is busy", () => {
    const busy = [
      { start: new Date("2026-05-19T16:00:00Z"), end: new Date("2026-05-19T17:00:00Z") },
    ];
    const slot = pickSlot(day, 60, 16, busy, "UTC");
    expect(slot).not.toBeNull();
    // preferredHour busy → earliest free daytime slot, not overlapping busy
    const b = busy[0];
    expect(
      slot!.start.getTime() < b.end.getTime() &&
        b.start.getTime() < slot!.end.getTime()
    ).toBe(false);
  });

  it("returns null when the whole daytime window is busy", () => {
    const busy = [
      { start: new Date("2026-05-19T00:00:00Z"), end: new Date("2026-05-20T00:00:00Z") },
    ];
    expect(pickSlot(day, 60, null, busy, "UTC")).toBeNull();
  });

  it("with no preferredHour picks the earliest free daytime slot", () => {
    const slot = pickSlot(day, 30, null, [], "UTC");
    expect(slot).not.toBeNull();
    expect(slot!.end.getTime() - slot!.start.getTime()).toBe(30 * 60 * 1000);
  });
});
