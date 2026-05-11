import { SchedulingService } from "../SchedulingService";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findUnique: jest.fn(), findMany: jest.fn() },
    taskChunk: { findMany: jest.fn(), update: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

describe("SchedulingService chunk awareness", () => {
  beforeEach(() => jest.clearAllMocks());

  test("scheduleChunk uses shared TimeSlotManager when provided", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      duration: 90,
      chunkMin: 15,
      chunkMax: 60,
      energyLevel: "high",
      startDate: null,
      dueDate: null,
      isAutoScheduled: false,
      userId: "u1",
    });
    const svc = new SchedulingService();
    const slot = {
      start: new Date("2026-05-12T17:30:00Z"),
      end: new Date("2026-05-12T18:30:00Z"),
      score: 1,
    };
    const fakeManager = {
      findAvailableSlots: jest.fn().mockResolvedValue([slot]),
      addScheduledTaskConflict: jest.fn().mockResolvedValue(undefined),
    };

    // Spy on previewSlot to confirm we DID NOT fall through to it.
    const previewSpy = jest.fn();
    svc.previewSlot = previewSpy as never;

    const result = await svc.scheduleChunk(
      { id: "c1", taskId: "t1", durationMin: 60 },
      "u1",
      fakeManager as never
    );

    expect(result).not.toBeNull();
    expect(previewSpy).not.toHaveBeenCalled();
    expect(fakeManager.findAvailableSlots).toHaveBeenCalled();
    expect(fakeManager.addScheduledTaskConflict).toHaveBeenCalled();
    expect(prisma.taskChunk.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: {
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
      },
    });
  });

  test("scheduleChunk falls through to previewSlot when no manager provided", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      duration: 90,
      chunkMin: 15,
      chunkMax: 60,
      energyLevel: "high",
      startDate: null,
      dueDate: null,
      isAutoScheduled: false,
      userId: "u1",
    });
    const svc = new SchedulingService();
    const slot = {
      start: new Date("2026-05-12T17:30:00Z"),
      end: new Date("2026-05-12T18:30:00Z"),
    };
    svc.previewSlot = jest.fn().mockResolvedValue(slot) as never;
    const result = await svc.scheduleChunk(
      { id: "c1", taskId: "t1", durationMin: 60 },
      "u1"
    );
    expect(result).toEqual(slot);
    expect(svc.previewSlot).toHaveBeenCalled();
    expect(prisma.taskChunk.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { scheduledStart: slot.start, scheduledEnd: slot.end },
    });
  });

  test("scheduleMultipleTasks dispatches per-chunk for tasks with todo chunks", async () => {
    const task = {
      id: "t1",
      title: "Chunked task",
      duration: 90,
      chunkMin: 15,
      chunkMax: 60,
      energyLevel: "high",
      startDate: null,
      dueDate: null,
      isAutoScheduled: false,
      userId: "u1",
      scheduleLocked: false,
    };

    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    (prisma.taskChunk.findMany as jest.Mock).mockResolvedValue([
      { id: "c1", taskId: "t1", chunkIndex: 0, durationMin: 45, status: "todo" },
      { id: "c2", taskId: "t1", chunkIndex: 1, durationMin: 45, status: "todo" },
    ]);

    const svc = new SchedulingService();
    const scheduleChunkSpy = jest
      .fn()
      .mockResolvedValue({ start: new Date(), end: new Date() });
    svc.scheduleChunk = scheduleChunkSpy as never;

    // Stub getTimeSlotManager + the legacy path so we don't touch real settings.
    // @ts-expect-error — replacing private method for test
    svc.getTimeSlotManager = jest.fn().mockReturnValue({
      findAvailableSlots: jest.fn().mockResolvedValue([]),
      addScheduledTaskConflict: jest.fn(),
    });

    await svc.scheduleMultipleTasks([task as never], "u1");

    expect(scheduleChunkSpy).toHaveBeenCalledTimes(2);
    expect(scheduleChunkSpy.mock.calls[0][0]).toEqual({
      id: "c1",
      taskId: "t1",
      durationMin: 45,
    });
    expect(scheduleChunkSpy.mock.calls[1][0]).toEqual({
      id: "c2",
      taskId: "t1",
      durationMin: 45,
    });
    // Both calls share the same TimeSlotManager
    expect(scheduleChunkSpy.mock.calls[0][2]).toBe(
      scheduleChunkSpy.mock.calls[1][2]
    );
  });

  test("scheduleMultipleTasks falls back to whole-task scheduling when no chunks", async () => {
    const task = {
      id: "t1",
      title: "Unchunked task",
      duration: 30,
      chunkMin: 15,
      chunkMax: 60,
      energyLevel: "high",
      startDate: null,
      dueDate: null,
      isAutoScheduled: false,
      userId: "u1",
      scheduleLocked: false,
    };

    (prisma.task.findMany as jest.Mock).mockResolvedValue([task]);
    (prisma.taskChunk.findMany as jest.Mock).mockResolvedValue([]);

    const svc = new SchedulingService();
    const scheduleChunkSpy = jest.fn();
    svc.scheduleChunk = scheduleChunkSpy as never;

    // @ts-expect-error — replacing private method for test
    svc.getTimeSlotManager = jest.fn().mockReturnValue({
      findAvailableSlots: jest.fn().mockResolvedValue([]),
      addScheduledTaskConflict: jest.fn(),
    });
    // @ts-expect-error — replacing private method for test
    svc.scheduleTask = jest.fn().mockResolvedValue(task);

    await svc.scheduleMultipleTasks([task as never], "u1");

    expect(scheduleChunkSpy).not.toHaveBeenCalled();
    // @ts-expect-error — accessing mock on private method
    expect(svc.scheduleTask).toHaveBeenCalled();
  });
});
