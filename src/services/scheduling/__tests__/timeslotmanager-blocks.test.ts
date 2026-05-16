import { AutoScheduleSettings, CalendarEvent, Task } from "@prisma/client";

jest.mock("@/lib/prisma", () => ({
  prisma: { task: { findMany: jest.fn().mockResolvedValue([]) } },
}));
jest.mock("@/store/settings", () => ({
  useSettingsStore: { getState: () => ({ user: { timeZone: "UTC" } }) },
}));

import { TimeSlotManagerImpl } from "../TimeSlotManager";
import { CalendarService } from "../CalendarService";
import type { TimeSlot } from "@/types/scheduling";

const BLOCK_FEED = "task-blocks-feed";

const settings = {
  workDays: "[0,1,2,3,4,5,6]",
  workHourStart: 0,
  workHourEnd: 24,
  selectedCalendars: "[]",
  bufferMinutes: 0,
  highEnergyStart: null,
  highEnergyEnd: null,
  mediumEnergyStart: null,
  mediumEnergyEnd: null,
  lowEnergyStart: null,
  lowEnergyEnd: null,
  groupByProject: false,
  taskBlocksFeedId: BLOCK_FEED,
  blockTypeMap: "[]",
  noEligibleBlockPolicy: "schedule_nothing",
  skipReflowBlockType: "light",
} as unknown as AutoScheduleSettings;

const blockEvent = (over: Partial<CalendarEvent>): CalendarEvent =>
  ({
    id: "b",
    feedId: BLOCK_FEED,
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

function makeCalendarService(blocks: CalendarEvent[]): CalendarService {
  return {
    findConflicts: jest.fn().mockResolvedValue([]),
    findBatchConflicts: jest.fn(
      async (slots: { slot: TimeSlot; taskId: string }[]) =>
        slots.map((s) => ({ slot: s.slot, taskId: s.taskId, conflicts: [] }))
    ),
    getEvents: jest.fn(
      async (_s: Date, _e: Date, calendarIds: string[]) =>
        calendarIds.includes(BLOCK_FEED) ? blocks : []
    ),
  } as unknown as CalendarService;
}

const task = {
  id: "t1",
  userId: "u1",
  title: "Deep work task",
  duration: 60,
  energyLevel: "high",
  priority: "medium",
  startDate: null,
  dueDate: null,
  isAutoScheduled: true,
} as unknown as Task;

describe("TimeSlotManagerImpl block-aware filtering", () => {
  it("returns only slots fully inside the 🧠 Deep Work block for a high-energy task", async () => {
    const mgr = new TimeSlotManagerImpl(
      settings,
      makeCalendarService([blockEvent({})])
    );
    const slots = await mgr.findAvailableSlots(
      task,
      new Date("2026-05-18T00:00:00Z"),
      new Date("2026-05-19T00:00:00Z"),
      "u1"
    );
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      expect(s.start.getTime()).toBeGreaterThanOrEqual(
        new Date("2026-05-18T16:00:00Z").getTime()
      );
      expect(s.end.getTime()).toBeLessThanOrEqual(
        new Date("2026-05-18T19:00:00Z").getTime()
      );
    }
  });

  it("returns nothing when the only block that day is protected", async () => {
    const mgr = new TimeSlotManagerImpl(
      settings,
      makeCalendarService([blockEvent({ title: "👶🏽 Daddy Duty" })])
    );
    const slots = await mgr.findAvailableSlots(
      task,
      new Date("2026-05-18T00:00:00Z"),
      new Date("2026-05-19T00:00:00Z"),
      "u1"
    );
    expect(slots).toHaveLength(0);
  });

  it("noEligibleBlockPolicy=fallback_work_hours: protected-only day falls back to work hours", async () => {
    const mgr = new TimeSlotManagerImpl(
      {
        ...settings,
        noEligibleBlockPolicy: "fallback_work_hours",
      } as AutoScheduleSettings,
      makeCalendarService([blockEvent({ title: "👶🏽 Daddy Duty" })])
    );
    const slots = await mgr.findAvailableSlots(
      task,
      new Date("2026-05-18T00:00:00Z"),
      new Date("2026-05-19T00:00:00Z"),
      "u1"
    );
    // Daddy Duty is 16:00–19:00; fallback keeps work-hour slots outside it.
    expect(slots.length).toBeGreaterThan(0);
    expect(
      slots.some(
        (s) =>
          s.start.getTime() >= new Date("2026-05-18T16:00:00Z").getTime() &&
          s.start.getTime() < new Date("2026-05-18T19:00:00Z").getTime()
      )
    ).toBe(false); // never inside the protected block
  });

  it("is backward compatible: taskBlocksFeedId=null disables filtering", async () => {
    const mgr = new TimeSlotManagerImpl(
      { ...settings, taskBlocksFeedId: null } as AutoScheduleSettings,
      makeCalendarService([blockEvent({})])
    );
    const slots = await mgr.findAvailableSlots(
      task,
      new Date("2026-05-18T00:00:00Z"),
      new Date("2026-05-19T00:00:00Z"),
      "u1"
    );
    // Without block filtering, slots exist outside 16:00–19:00.
    expect(
      slots.some(
        (s) => s.start.getTime() < new Date("2026-05-18T16:00:00Z").getTime()
      )
    ).toBe(true);
  });
});
