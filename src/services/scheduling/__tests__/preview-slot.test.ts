import { SchedulingService } from "../SchedulingService";

describe("SchedulingService.previewSlot", () => {
  test("returns a slot without persisting to DB", async () => {
    const svc = new SchedulingService();
    const fakeSlot = {
      start: new Date("2026-05-12T10:30:00-07:00"),
      end: new Date("2026-05-12T11:00:00-07:00"),
    };
    // @ts-expect-error — accessing private method for testing
    svc.findSlotForTask = jest.fn().mockResolvedValue(fakeSlot);
    const task = {
      id: "t1",
      userId: "u1",
      title: "X",
      duration: 30,
      chunkMin: 15,
      chunkMax: 60,
      energyLevel: "high" as const,
      startDate: null,
      dueDate: null,
      isAutoScheduled: false,
    };
    const slot = await svc.previewSlot(
      task as Parameters<typeof svc.previewSlot>[0],
      "u1",
    );
    expect(slot).toEqual(fakeSlot);
  });

  test("returns null when no slot found", async () => {
    const svc = new SchedulingService();
    // @ts-expect-error — accessing private method for testing
    svc.findSlotForTask = jest.fn().mockResolvedValue(null);
    const task = {
      id: "t1",
      userId: "u1",
      title: "X",
      duration: 30,
      chunkMin: 15,
      chunkMax: 60,
      energyLevel: "high" as const,
      startDate: null,
      dueDate: null,
      isAutoScheduled: false,
    };
    const slot = await svc.previewSlot(
      task as Parameters<typeof svc.previewSlot>[0],
      "u1",
    );
    expect(slot).toBeNull();
  });
});
