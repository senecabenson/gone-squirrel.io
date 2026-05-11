import { NextRequest } from "next/server";

import { POST } from "../route";

jest.mock("@/lib/auth/api-auth", () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ userId: "u1" }),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: { task: { findUnique: jest.fn() } },
}));

jest.mock("@/services/scheduling/SchedulingService", () => ({
  SchedulingService: jest.fn().mockImplementation(() => ({
    previewSlot: jest.fn().mockResolvedValue({
      start: new Date("2026-05-12T17:30:00.000Z"),
      end: new Date("2026-05-12T18:15:00.000Z"),
    }),
  })),
}));

import { prisma } from "@/lib/prisma";

describe("POST /api/focus/finish-later/preview", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns slot for valid task + minutes", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: "u1",
      title: "X",
      chunkMin: 15,
      chunkMax: 60,
      energyLevel: "high",
      duration: 60,
    });
    const req = new NextRequest(
      "http://localhost/api/focus/finish-later/preview",
      {
        method: "POST",
        body: JSON.stringify({ taskId: "t1", remainingMin: 45 }),
      },
    );
    const res = await POST(req);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.start).toBeTruthy();
    expect(body.end).toBeTruthy();
    expect(typeof body.reasoning).toBe("string");
  });

  test("404 when task not found or not owned", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);
    const req = new NextRequest(
      "http://localhost/api/focus/finish-later/preview",
      {
        method: "POST",
        body: JSON.stringify({ taskId: "missing", remainingMin: 45 }),
      },
    );
    expect((await POST(req))!.status).toBe(404);
  });

  test("404 when task owned by another user", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: "other",
      duration: 30,
      chunkMin: 15,
      chunkMax: 60,
      energyLevel: "high",
    });
    const req = new NextRequest(
      "http://localhost/api/focus/finish-later/preview",
      {
        method: "POST",
        body: JSON.stringify({ taskId: "t1", remainingMin: 45 }),
      },
    );
    expect((await POST(req))!.status).toBe(404);
  });

  test("400 on invalid input", async () => {
    const req = new NextRequest(
      "http://localhost/api/focus/finish-later/preview",
      {
        method: "POST",
        body: JSON.stringify({ taskId: "t1", remainingMin: -1 }),
      },
    );
    expect((await POST(req))!.status).toBe(400);
  });
});
