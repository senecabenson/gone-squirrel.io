import {
  createAllDayDate,
  newDateFromYMD,
  normalizeAllDayDate,
  roundDateUp,
} from "../date-utils";

describe("roundDateUp", () => {
  test("should round up to next 30 minutes by default", () => {
    // 8:01 should round to 8:30
    const date1 = newDateFromYMD(2024, 1, 1);
    date1.setHours(8, 1);
    expect(roundDateUp(date1).getMinutes()).toBe(30);
    expect(roundDateUp(date1).getHours()).toBe(8);

    // 8:31 should round to 9:00
    const date2 = newDateFromYMD(2024, 1, 1);
    date2.setHours(8, 31);
    expect(roundDateUp(date2).getMinutes()).toBe(0);
    expect(roundDateUp(date2).getHours()).toBe(9);

    // 8:59 should round to 9:00
    const date3 = newDateFromYMD(2024, 1, 1);
    date3.setHours(8, 59);
    expect(roundDateUp(date3).getMinutes()).toBe(0);
    expect(roundDateUp(date3).getHours()).toBe(9);
  });

  test("should round up to specified minutes", () => {
    // Test rounding to 15 minutes
    const date = newDateFromYMD(2024, 1, 1);
    date.setHours(8, 1);

    const rounded = roundDateUp(date, 15);
    expect(rounded.getMinutes()).toBe(15);
    expect(rounded.getHours()).toBe(8);
  });

  test("should not change time if already at interval", () => {
    // Test exact 30-minute mark
    const date = newDateFromYMD(2024, 1, 1);
    date.setHours(8, 30);

    const rounded = roundDateUp(date);
    expect(rounded.getMinutes()).toBe(30);
    expect(rounded.getHours()).toBe(8);
  });

  test("should handle hour rollover", () => {
    // 23:31 should round to 00:00 next day
    const date = newDateFromYMD(2024, 1, 1);
    date.setHours(23, 31);

    const rounded = roundDateUp(date);
    expect(rounded.getMinutes()).toBe(0);
    expect(rounded.getHours()).toBe(0);
    expect(rounded.getDate()).toBe(2); // Should be next day
  });

  test("should preserve date and only modify time", () => {
    const date = newDateFromYMD(2024, 2, 29); // Leap year
    date.setHours(8, 1);

    const rounded = roundDateUp(date);
    expect(rounded.getFullYear()).toBe(2024);
    expect(rounded.getMonth()).toBe(2); // March
    expect(rounded.getDate()).toBe(29);
  });
});

describe("createAllDayDate", () => {
  test("produces UTC midnight on the target day (TZ-independent)", () => {
    const d = createAllDayDate("2026-05-10");
    expect(d.toISOString()).toBe("2026-05-10T00:00:00.000Z");
  });

  test("ignores trailing time portion in input", () => {
    const d = createAllDayDate("2026-05-10T17:30:00");
    expect(d.toISOString()).toBe("2026-05-10T00:00:00.000Z");
  });

  test("returns a Date for empty input (no throw)", () => {
    expect(createAllDayDate("")).toBeInstanceOf(Date);
  });
});

describe("normalizeAllDayDate", () => {
  test("returns local midnight on the UTC calendar day of the input", () => {
    // Canonical stored instant for Mother's Day 2026
    const stored = new Date("2026-05-10T00:00:00.000Z");
    const local = normalizeAllDayDate(stored);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(4); // May
    expect(local.getDate()).toBe(10);
    expect(local.getHours()).toBe(0);
    expect(local.getMinutes()).toBe(0);
  });

  test("round-trip: createAllDayDate then normalizeAllDayDate preserves YMD", () => {
    const canonical = createAllDayDate("2026-05-10");
    const local = normalizeAllDayDate(canonical);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(4);
    expect(local.getDate()).toBe(10);
  });
});
