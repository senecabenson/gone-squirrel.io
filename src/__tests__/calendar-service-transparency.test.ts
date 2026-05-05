import { CalendarEvent } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CalendarServiceImpl } from "@/services/scheduling/CalendarServiceImpl";
import { TimeSlot } from "@/types/scheduling";

const makeSlot = (): TimeSlot => ({
  start: new Date("2026-05-10T10:00:00Z"),
  end: new Date("2026-05-10T11:00:00Z"),
  score: 0,
  conflicts: [],
  energyLevel: null,
  isWithinWorkHours: true,
  hasBufferTime: true,
});

jest.mock("@/lib/prisma", () => ({
  prisma: {
    calendarEvent: {
      findMany: jest.fn(),
    },
    task: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

const findMany = prisma.calendarEvent.findMany as jest.MockedFunction<
  typeof prisma.calendarEvent.findMany
>;

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({
    id: "event-1",
    feedId: "feed-1",
    externalEventId: "ext-1",
    title: "Test Event",
    description: null,
    start: new Date("2026-05-10T10:00:00Z"),
    end: new Date("2026-05-10T11:00:00Z"),
    location: null,
    isRecurring: false,
    recurrenceRule: null,
    allDay: false,
    status: "confirmed",
    transparency: "opaque",
    sequence: 0,
    created: null,
    lastModified: null,
    organizer: null,
    attendees: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isMaster: false,
    masterEventId: null,
    recurringEventId: null,
    ...overrides,
  }) as CalendarEvent;

describe("CalendarServiceImpl — transparency filter", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("excludes transparent events from the conflict scan query", async () => {
    findMany.mockResolvedValue([]);
    const service = new CalendarServiceImpl();

    await service.findConflicts(
      makeSlot(),
      ["feed-1"],
      "user-1"
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    const call = findMany.mock.calls[0][0];
    expect(call?.where?.NOT).toEqual({ transparency: "transparent" });
  });

  it("treats opaque events as conflicts", async () => {
    findMany.mockResolvedValue([
      makeEvent({ id: "busy", transparency: "opaque" }),
    ]);
    const service = new CalendarServiceImpl();

    const conflicts = await service.findConflicts(
      makeSlot(),
      ["feed-1"],
      "user-1"
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].source.id).toBe("busy");
  });

  it("treats null transparency (legacy rows) as conflicts", async () => {
    findMany.mockResolvedValue([
      makeEvent({ id: "legacy", transparency: null }),
    ]);
    const service = new CalendarServiceImpl();

    const conflicts = await service.findConflicts(
      makeSlot(),
      ["feed-1"],
      "user-1"
    );

    expect(conflicts).toHaveLength(1);
  });

  it("returns no conflicts when DB returns only opaque overlap (sanity)", async () => {
    findMany.mockResolvedValue([]);
    const service = new CalendarServiceImpl();

    const conflicts = await service.findConflicts(
      makeSlot(),
      ["feed-1"],
      "user-1"
    );

    expect(conflicts).toHaveLength(0);
  });
});
