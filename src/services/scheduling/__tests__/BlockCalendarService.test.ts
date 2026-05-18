import { CalendarEvent } from "@prisma/client";

import {
  parseBlockTypeMap,
  stringifyBlockTypeMap,
  matchBlockRule,
  eligibleWindowsForEnergy,
  selectSlotsInEligibleBlocks,
  selectSlotsWithPolicy,
  BlockCalendarService,
  DEFAULT_BLOCK_TYPE_MAP,
  EVENING_CUTOFF_HOUR,
  type BlockTypeRule,
  type DayBlock,
} from "../BlockCalendarService";
import { CalendarService } from "../CalendarService";
import type { TimeSlot } from "@/types/scheduling";

const RULES: BlockTypeRule[] = DEFAULT_BLOCK_TYPE_MAP;

describe("parseBlockTypeMap / stringifyBlockTypeMap", () => {
  it('returns the default seeded map for "[]" (unconfigured)', () => {
    const rules = parseBlockTypeMap("[]");
    expect(rules).toEqual(DEFAULT_BLOCK_TYPE_MAP);
  });

  it("round-trips a custom map", () => {
    const custom: BlockTypeRule[] = [
      { emoji: "🧠", label: "Deep Work", eligibility: "high", daytimeOnly: true },
    ];
    expect(parseBlockTypeMap(stringifyBlockTypeMap(custom))).toEqual(custom);
  });

  it("falls back to default on malformed JSON", () => {
    expect(parseBlockTypeMap("not json")).toEqual(DEFAULT_BLOCK_TYPE_MAP);
  });
});

describe("matchBlockRule", () => {
  it("matches an emoji-prefixed summary with a space", () => {
    expect(matchBlockRule("🧠 Deep Work", RULES)?.eligibility).toBe("high");
  });

  it("matches without a space after the emoji", () => {
    expect(matchBlockRule("🧠Deep Work", RULES)?.eligibility).toBe("high");
  });

  it("matches despite a skin-tone modifier (💪🏽 Movement)", () => {
    expect(matchBlockRule("💪🏽 Movement", RULES)?.eligibility).toBe(
      "protected"
    );
  });

  it("matches despite a variation selector (☀️ Morning)", () => {
    expect(matchBlockRule("☀️ Morning", RULES)?.eligibility).toBe("protected");
  });

  it("falls back to case-insensitive label substring", () => {
    expect(matchBlockRule("  deep work block", RULES)?.eligibility).toBe(
      "high"
    );
  });

  it("returns null for an unrecognized summary", () => {
    expect(matchBlockRule("Random meeting", RULES)).toBeNull();
  });
});

describe("eligibleWindowsForEnergy", () => {
  const deep = (s: string, e: string): DayBlock => ({
    start: new Date(s),
    end: new Date(e),
    eligibility: "high",
    rule: RULES.find((r) => r.eligibility === "high")!,
    rawTitle: "🧠 Deep Work",
  });
  const light = (s: string, e: string): DayBlock => ({
    start: new Date(s),
    end: new Date(e),
    eligibility: "low",
    rule: RULES.find((r) => r.eligibility === "low")!,
    rawTitle: "🪶 Light Work",
  });
  const protectedBlock = (s: string, e: string): DayBlock => ({
    start: new Date(s),
    end: new Date(e),
    eligibility: "protected",
    rule: null,
    rawTitle: "👶🏽 Daddy Duty",
  });

  const blocks: DayBlock[] = [
    deep("2026-05-18T16:00:00Z", "2026-05-18T19:00:00Z"),
    light("2026-05-18T19:30:00Z", "2026-05-18T21:00:00Z"),
    protectedBlock("2026-05-18T13:00:00Z", "2026-05-18T16:00:00Z"),
  ];

  it("high-energy task → only Deep Work windows", () => {
    const w = eligibleWindowsForEnergy(blocks, "high");
    expect(w).toEqual([
      { start: new Date("2026-05-18T16:00:00Z"), end: new Date("2026-05-18T19:00:00Z") },
    ]);
  });

  it("low-energy task → only Light Work windows", () => {
    const w = eligibleWindowsForEnergy(blocks, "low");
    expect(w).toEqual([
      { start: new Date("2026-05-18T19:30:00Z"), end: new Date("2026-05-18T21:00:00Z") },
    ]);
  });

  it("medium-energy task → Light Work windows (never Deep)", () => {
    const w = eligibleWindowsForEnergy(blocks, "medium");
    expect(w).toEqual([
      { start: new Date("2026-05-18T19:30:00Z"), end: new Date("2026-05-18T21:00:00Z") },
    ]);
  });

  it("null energyLevel → defaults to Light Work, never Deep", () => {
    const w = eligibleWindowsForEnergy(blocks, null);
    expect(w).toEqual([
      { start: new Date("2026-05-18T19:30:00Z"), end: new Date("2026-05-18T21:00:00Z") },
    ]);
  });

  it("never returns a protected window", () => {
    const all = [
      ...eligibleWindowsForEnergy(blocks, "high"),
      ...eligibleWindowsForEnergy(blocks, "low"),
    ];
    expect(
      all.some(
        (w) => w.start.getTime() === new Date("2026-05-18T13:00:00Z").getTime()
      )
    ).toBe(false);
  });
});

describe("selectSlotsInEligibleBlocks", () => {
  const slot = (s: string, e: string): TimeSlot => ({
    start: new Date(s),
    end: new Date(e),
    score: 0,
    conflicts: [],
    energyLevel: null,
    isWithinWorkHours: true,
    hasBufferTime: false,
  });
  const block = (
    s: string,
    e: string,
    eligibility: DayBlock["eligibility"]
  ): DayBlock => ({
    start: new Date(s),
    end: new Date(e),
    eligibility,
    rule: null,
    rawTitle: "",
  });

  const deep = block("2026-05-18T16:00:00Z", "2026-05-18T19:00:00Z", "high");
  const light = block("2026-05-18T13:00:00Z", "2026-05-18T15:00:00Z", "low");
  const daddy = block(
    "2026-05-18T19:00:00Z",
    "2026-05-18T21:00:00Z",
    "protected"
  );

  it("keeps a high-energy slot fully inside a Deep Work block", () => {
    const slots = [slot("2026-05-18T16:30:00Z", "2026-05-18T17:30:00Z")];
    const kept = selectSlotsInEligibleBlocks(slots, [deep, light, daddy], "high");
    expect(kept).toHaveLength(1);
  });

  it("drops a slot that spills past the eligible block boundary (containment, not overlap)", () => {
    const slots = [slot("2026-05-18T18:30:00Z", "2026-05-18T19:30:00Z")]; // crosses 19:00 into Daddy Duty
    expect(
      selectSlotsInEligibleBlocks(slots, [deep, light, daddy], "high")
    ).toHaveLength(0);
  });

  it("drops a slot inside an eligible block but overlapping a protected block", () => {
    const overlapDeep = block(
      "2026-05-18T16:00:00Z",
      "2026-05-18T20:00:00Z",
      "high"
    );
    const lunch = block(
      "2026-05-18T17:00:00Z",
      "2026-05-18T18:00:00Z",
      "protected"
    );
    const slots = [slot("2026-05-18T17:15:00Z", "2026-05-18T17:45:00Z")];
    expect(
      selectSlotsInEligibleBlocks(slots, [overlapDeep, lunch], "high")
    ).toHaveLength(0);
  });

  it("matches energy: low task fits Light, not Deep", () => {
    const inLight = [slot("2026-05-18T13:30:00Z", "2026-05-18T14:30:00Z")];
    const inDeep = [slot("2026-05-18T16:30:00Z", "2026-05-18T17:30:00Z")];
    expect(
      selectSlotsInEligibleBlocks(inLight, [deep, light], "low")
    ).toHaveLength(1);
    expect(
      selectSlotsInEligibleBlocks(inDeep, [deep, light], "low")
    ).toHaveLength(0);
  });

  it("returns nothing when there is no energy-matched block", () => {
    const slots = [slot("2026-05-18T13:30:00Z", "2026-05-18T14:30:00Z")];
    expect(
      selectSlotsInEligibleBlocks(slots, [light, daddy], "high")
    ).toHaveLength(0);
  });
});

describe("selectSlotsWithPolicy", () => {
  const slot = (s: string, e: string): TimeSlot => ({
    start: new Date(s),
    end: new Date(e),
    score: 0,
    conflicts: [],
    energyLevel: null,
    isWithinWorkHours: true,
    hasBufferTime: false,
  });
  const mk = (
    s: string,
    e: string,
    eligibility: DayBlock["eligibility"]
  ): DayBlock => ({
    start: new Date(s),
    end: new Date(e),
    eligibility,
    rule: null,
    rawTitle: "",
  });
  // UTC-day key (TimeSlotManager injects a tz-aware one)
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);

  // Day 1 has a Deep block; Day 2 is protected-only.
  const d1Deep = mk("2026-05-18T16:00:00Z", "2026-05-18T19:00:00Z", "high");
  const d2Protected = mk(
    "2026-05-19T13:00:00Z",
    "2026-05-19T17:00:00Z",
    "protected"
  );
  const blocks = [d1Deep, d2Protected];

  const d1Slot = slot("2026-05-18T16:30:00Z", "2026-05-18T17:30:00Z");
  const d2Slot = slot("2026-05-19T09:00:00Z", "2026-05-19T10:00:00Z");
  const d2SlotOverProtected = slot(
    "2026-05-19T14:00:00Z",
    "2026-05-19T15:00:00Z"
  );

  it("schedule_nothing: drops slots on a day with no eligible block", () => {
    const kept = selectSlotsWithPolicy(
      [d1Slot, d2Slot],
      blocks,
      "high",
      "schedule_nothing",
      dayKey
    );
    expect(kept).toEqual([d1Slot]);
  });

  it("fallback_work_hours: keeps slots on a no-eligible-block day", () => {
    const kept = selectSlotsWithPolicy(
      [d1Slot, d2Slot],
      blocks,
      "high",
      "fallback_work_hours",
      dayKey
    );
    expect(kept).toEqual([d1Slot, d2Slot]);
  });

  it("fallback_work_hours: still rejects slots overlapping a protected block", () => {
    const kept = selectSlotsWithPolicy(
      [d2SlotOverProtected],
      blocks,
      "high",
      "fallback_work_hours",
      dayKey
    );
    expect(kept).toHaveLength(0);
  });

  it("fallback_work_hours: a day WITH an eligible block still enforces containment", () => {
    const spill = slot("2026-05-18T18:30:00Z", "2026-05-18T19:30:00Z");
    const kept = selectSlotsWithPolicy(
      [spill],
      blocks,
      "high",
      "fallback_work_hours",
      dayKey
    );
    expect(kept).toHaveLength(0);
  });
});

describe("BlockCalendarService.getBlocks", () => {
  const ev = (over: Partial<CalendarEvent>): CalendarEvent =>
    ({
      id: "e",
      feedId: "f",
      externalEventId: null,
      title: "🧠 Deep Work",
      description: null,
      start: new Date("2026-05-18T16:00:00Z"),
      end: new Date("2026-05-18T19:00:00Z"),
      location: null,
      isRecurring: false,
      recurrenceRule: null,
      allDay: false,
      status: null,
      transparency: "opaque",
      sequence: null,
      created: null,
      lastModified: null,
      organizer: null,
      ...over,
    }) as CalendarEvent;

  function makeService(events: CalendarEvent[]) {
    const calls: { calendarIds: string[]; userId: string }[] = [];
    const calendarService: CalendarService = {
      findConflicts: jest.fn(),
      findBatchConflicts: jest.fn(),
      getEvents: jest.fn(
        async (_s: Date, _e: Date, calendarIds: string[], userId: string) => {
          calls.push({ calendarIds, userId });
          return events;
        }
      ),
    } as unknown as CalendarService;
    return { service: new BlockCalendarService(calendarService), calls };
  }

  it("classifies recognized titles by rule eligibility", async () => {
    const { service } = makeService([
      ev({ title: "🧠 Deep Work" }),
      ev({ title: "🪶 Light Work" }),
    ]);
    const blocks = await service.getBlocks(
      new Date("2026-05-18T00:00:00Z"),
      new Date("2026-05-19T00:00:00Z"),
      "feed1",
      DEFAULT_BLOCK_TYPE_MAP,
      "UTC",
      EVENING_CUTOFF_HOUR,
      "user1"
    );
    expect(blocks.map((b) => b.eligibility)).toEqual(["high", "low"]);
  });

  it("treats an unrecognized title as protected (fail-safe)", async () => {
    const { service } = makeService([ev({ title: "Sprint planning" })]);
    const [b] = await service.getBlocks(
      new Date("2026-05-18T00:00:00Z"),
      new Date("2026-05-19T00:00:00Z"),
      "feed1",
      DEFAULT_BLOCK_TYPE_MAP,
      "UTC",
      EVENING_CUTOFF_HOUR,
      "user1"
    );
    expect(b.eligibility).toBe("protected");
    expect(b.rule).toBeNull();
  });

  it("ignores all-day events", async () => {
    const { service } = makeService([ev({ allDay: true })]);
    const blocks = await service.getBlocks(
      new Date("2026-05-18T00:00:00Z"),
      new Date("2026-05-19T00:00:00Z"),
      "feed1",
      DEFAULT_BLOCK_TYPE_MAP,
      "UTC",
      EVENING_CUTOFF_HOUR,
      "user1"
    );
    expect(blocks).toHaveLength(0);
  });

  it("demotes a daytime-only work block at/after the evening cutoff to protected", async () => {
    // 19:30 local UTC Light Work — past EVENING_CUTOFF_HOUR (19)
    const { service } = makeService([
      ev({
        title: "🪶 Light Work",
        start: new Date("2026-05-18T19:30:00Z"),
        end: new Date("2026-05-18T20:30:00Z"),
      }),
    ]);
    const [b] = await service.getBlocks(
      new Date("2026-05-18T00:00:00Z"),
      new Date("2026-05-19T00:00:00Z"),
      "feed1",
      DEFAULT_BLOCK_TYPE_MAP,
      "UTC",
      EVENING_CUTOFF_HOUR,
      "user1"
    );
    expect(b.eligibility).toBe("protected");
  });

  it("queries only the Task Blocks feed for the given user", async () => {
    const { service, calls } = makeService([ev({})]);
    await service.getBlocks(
      new Date("2026-05-18T00:00:00Z"),
      new Date("2026-05-19T00:00:00Z"),
      "feedXYZ",
      DEFAULT_BLOCK_TYPE_MAP,
      "UTC",
      EVENING_CUTOFF_HOUR,
      "userABC"
    );
    expect(calls).toEqual([{ calendarIds: ["feedXYZ"], userId: "userABC" }]);
  });
});
