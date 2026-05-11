import { SchedulingService } from "../SchedulingService";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findUnique: jest.fn() },
    taskChunk: { update: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SchedulingService.scheduleChunk", () => {
  test("persists scheduledStart/End on TaskChunk row when slot found", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      id: "t1", duration: 90, chunkMin: 15, chunkMax: 60, energyLevel: "high",
      startDate: null, dueDate: null, isAutoScheduled: false, userId: "u1",
    });
    const svc = new SchedulingService();
    const slot = { start: new Date("2026-05-12T17:30:00Z"), end: new Date("2026-05-12T18:30:00Z") };
    svc.previewSlot = jest.fn().mockResolvedValue(slot) as never;
    const result = await svc.scheduleChunk({ id: "c1", taskId: "t1", durationMin: 60 }, "u1");
    expect(result).toEqual(slot);
    expect(prisma.taskChunk.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { scheduledStart: slot.start, scheduledEnd: slot.end },
    });
  });

  test("returns null and does not update when task missing", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);
    const svc = new SchedulingService();
    const result = await svc.scheduleChunk({ id: "c1", taskId: "missing", durationMin: 60 }, "u1");
    expect(result).toBeNull();
    expect(prisma.taskChunk.update).not.toHaveBeenCalled();
  });

  test("returns null when no slot available", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      id: "t1", duration: 90, chunkMin: 15, chunkMax: 60, energyLevel: "high",
      startDate: null, dueDate: null, isAutoScheduled: false, userId: "u1",
    });
    const svc = new SchedulingService();
    svc.previewSlot = jest.fn().mockResolvedValue(null) as never;
    const result = await svc.scheduleChunk({ id: "c1", taskId: "t1", durationMin: 60 }, "u1");
    expect(result).toBeNull();
    expect(prisma.taskChunk.update).not.toHaveBeenCalled();
  });
});
