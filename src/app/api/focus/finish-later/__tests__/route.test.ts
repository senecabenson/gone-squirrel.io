import { POST } from "../route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/api-auth", () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ userId: "u1" }),
}));

const mockScheduleChunk = jest.fn().mockResolvedValue({ start: new Date(), end: new Date() });

jest.mock("@/services/scheduling/SchedulingService", () => ({
  SchedulingService: jest.fn().mockImplementation(() => ({
    scheduleChunk: mockScheduleChunk,
  })),
}));

jest.mock("@/services/google-task-sync", () => ({
  syncChunksToGoogle: jest.fn().mockResolvedValue(undefined),
}));

let mockCreated: Array<{ id: string; taskId: string; durationMin: number; scheduledStart: Date | null; scheduledEnd: Date | null }> = [];

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findUnique: jest.fn() },
    taskChunk: { findMany: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (cb: unknown) => {
      // cb is callback-style
      if (typeof cb === "function") {
        return (cb as (tx: unknown) => unknown)({
          taskChunk: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockImplementation(({ data }: { data: { taskId: string; durationMin: number; chunkIndex: number } }) => {
              const row = { id: `c-${data.chunkIndex}`, taskId: data.taskId, durationMin: data.durationMin, scheduledStart: null, scheduledEnd: null };
              mockCreated.push(row);
              return Promise.resolve(row);
            }),
          },
        });
      }
      return Promise.resolve(null);
    }),
  },
}));

import { prisma } from "@/lib/prisma";

beforeEach(() => {
  mockCreated = [];
  jest.clearAllMocks();
  (prisma.taskChunk.findMany as jest.Mock).mockImplementation(() => Promise.resolve(mockCreated));
});

describe("POST /api/focus/finish-later", () => {
  test("re-chunks remaining time, schedules each, returns chunks", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      id: "t1", userId: "u1", chunkMin: 15, chunkMax: 60,
    });
    const req = new NextRequest("http://localhost/api/focus/finish-later", {
      method: "POST",
      body: JSON.stringify({ taskId: "t1", remainingMin: 45 }),
    });
    const res = await POST(req);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(Array.isArray(body.chunks)).toBe(true);
    expect(mockScheduleChunk).toHaveBeenCalled();
  });

  test("404 when task not owned", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: "t1", userId: "other", chunkMin: 15, chunkMax: 60 });
    const req = new NextRequest("http://localhost/api/focus/finish-later", {
      method: "POST",
      body: JSON.stringify({ taskId: "t1", remainingMin: 45 }),
    });
    expect((await POST(req))!.status).toBe(404);
  });

  test("400 on invalid input", async () => {
    const req = new NextRequest("http://localhost/api/focus/finish-later", {
      method: "POST",
      body: JSON.stringify({ taskId: "t1", remainingMin: 0 }),
    });
    expect((await POST(req))!.status).toBe(400);
  });
});
