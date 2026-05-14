import { SlotScorer } from "@/services/scheduling/SlotScorer";
import { AutoScheduleSettings } from "@prisma/client";
import { TimeSlot } from "@/types/scheduling";
import { Task } from "@prisma/client";

// Minimal AutoScheduleSettings fixture — only fields used by SlotScorer
const makeSettings = (
  overrides: Partial<AutoScheduleSettings> = {}
): AutoScheduleSettings => ({
  id: "test-id",
  userId: "user-1",
  workDays: "[1,2,3,4,5]",
  workHourStart: 9,
  workHourEnd: 17,
  selectedCalendars: "[]",
  bufferMinutes: 15,
  highEnergyStart: 9,
  highEnergyEnd: 12,
  mediumEnergyStart: 12,
  mediumEnergyEnd: 15,
  lowEnergyStart: 15,
  lowEnergyEnd: 17,
  groupByProject: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Minimal Task fixture
const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  title: "Test Task",
  description: null,
  status: "TODO",
  dueDate: null,
  startDate: null,
  duration: 60,
  priority: "MEDIUM",
  energyLevel: "high",
  preferredTime: null,
  isAutoScheduled: false,
  scheduleLocked: false,
  scheduledStart: null,
  scheduledEnd: null,
  scheduleScore: null,
  lastScheduled: null,
  postponedUntil: null,
  isRecurring: false,
  recurrenceRule: null,
  lastCompletedDate: null,
  completedAt: null,
  externalTaskId: null,
  source: null,
  lastSyncedAt: null,
  externalListId: null,
  externalCreatedAt: null,
  externalUpdatedAt: null,
  syncStatus: null,
  syncError: null,
  syncHash: null,
  skipSync: false,
  googleEventId: null,
  chunkMin: 15,
  chunkMax: 60,
  userId: "user-1",
  projectId: null,
  parentTaskId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Minimal TimeSlot fixture
const makeSlot = (start: Date): TimeSlot => ({
  start,
  end: new Date(start.getTime() + 60 * 60 * 1000),
  score: 0, // Will be calculated by scoreSlot
  conflicts: [],
  energyLevel: null, // Will be calculated
  isWithinWorkHours: true,
  hasBufferTime: true,
});

describe("SlotScorer timezone awareness", () => {
  /**
   * Regression test for Bug 2:
   * SlotScorer.scoreEnergyLevelMatch used slot.start.getHours() (UTC).
   * For UTC-7 users, 9 AM local = 16:00 UTC → scored as wrong energy level.
   *
   * Fix: pass timeZone to SlotScorer; use toZonedTime(slot.start, timeZone).getHours()
   */
  it("scores energy level using local time, not UTC", () => {
    // 2026-05-01 16:00 UTC = 09:00 America/Los_Angeles (PDT = UTC-7)
    // highEnergyStart=9, highEnergyEnd=12 → local 9 AM should be "high"
    const utcNineAmPDT = new Date("2026-05-01T16:00:00Z");
    const slot = makeSlot(utcNineAmPDT);
    const task = makeTask({ energyLevel: "high" });
    const settings = makeSettings();

    // With the fix: SlotScorer accepts timeZone as third constructor argument
    const scorer = new SlotScorer(settings, new Map(), "America/Los_Angeles");
    const result = scorer.scoreSlot(slot, task);

    // Local hour = 9 → highEnergy window → exact match with task energyLevel "high" → score 1.0
    expect(result.factors.energyLevelMatch).toBe(1.0);
  });

  it("scores energy level correctly in UTC when no timezone provided", () => {
    // 09:00 UTC → should match highEnergy window (9-12) in UTC
    const utcNineAm = new Date("2026-05-01T09:00:00Z");
    const slot = makeSlot(utcNineAm);
    const task = makeTask({ energyLevel: "high" });
    const settings = makeSettings();

    // Default timezone = "UTC" — existing behavior should still work
    const scorer = new SlotScorer(settings, new Map(), "UTC");
    const result = scorer.scoreSlot(slot, task);

    expect(result.factors.energyLevelMatch).toBe(1.0);
  });

  it("scores time preference using local time, not UTC", () => {
    // 2026-05-01 16:00 UTC = 09:00 America/Los_Angeles → "morning" (5-12)
    const utcNineAmPDT = new Date("2026-05-01T16:00:00Z");
    const slot = makeSlot(utcNineAmPDT);
    const task = makeTask({ preferredTime: "morning" });
    const settings = makeSettings();

    const scorer = new SlotScorer(settings, new Map(), "America/Los_Angeles");
    const result = scorer.scoreSlot(slot, task);

    // Local hour = 9 → "morning" range [5,12) → should score 1.0
    expect(result.factors.timePreference).toBe(1.0);
  });
});
