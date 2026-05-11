import { NextRequest } from "next/server";

// Mock the auth helper using the project's standard pattern
jest.mock("@/lib/auth/api-auth", () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ userId: "u1" }),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    taskChunk: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    userSettings: {
      findUnique: jest.fn().mockResolvedValue({ timeZone: "America/Los_Angeles" }),
    },
    $transaction: jest.fn().mockImplementation((arr: unknown) => {
      if (Array.isArray(arr)) return Promise.all(arr);
      return (arr as (tx: unknown) => unknown)({
        taskChunk: {
          create: jest
            .fn()
            .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
              id: "newc",
              ...data,
            })),
        },
      });
    }),
  },
}));

import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth/api-auth";
import { POST } from "../route";

describe("POST /api/focus/recommend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authenticateRequest as jest.Mock).mockResolvedValue({ userId: "u1" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prisma as any;
    (p.task.findFirst as jest.Mock).mockResolvedValue(null);
    (p.taskChunk.findMany as jest.Mock).mockResolvedValue([]);
    (p.userSettings.findUnique as jest.Mock).mockResolvedValue({
      timeZone: "America/Los_Angeles",
    });
  });

  test("returns 200 with recommendation shape for valid input", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prisma as any;
    (p.task.findMany as jest.Mock).mockResolvedValue([
      {
        id: "t1",
        title: "Review contracts",
        energyLevel: "high",
        duration: 30,
        chunkMin: 15,
        chunkMax: 60,
        dueDate: null,
        projectId: null,
        createdAt: new Date("2026-05-01"),
        lastFocusedAt: null,
        status: "todo",
      },
    ]);

    (p.$transaction as jest.Mock).mockResolvedValue([
      {
        id: "c1",
        taskId: "t1",
        chunkIndex: 1,
        totalChunks: 1,
        durationMin: 30,
        status: "todo",
      },
    ]);

    const req = new NextRequest("http://localhost/api/focus/recommend", {
      method: "POST",
      body: JSON.stringify({ energy: "high", durationMin: 30 }),
    });

    const res = await POST(req);
    expect(res!.status).toBe(200);

    const body = await res!.json();
    expect(body.task.id).toBe("t1");
    expect(body.chunk.durationMin).toBe(30);
    expect(body.chunk.id).toBe("c1");
    expect(body.matchedExactly).toBe(true);
    expect(typeof body.reasoning).toBe("string");
  });

  test("returns 400 on invalid input", async () => {
    const req = new NextRequest("http://localhost/api/focus/recommend", {
      method: "POST",
      body: JSON.stringify({ energy: "invalid", durationMin: 30 }),
    });

    const res = await POST(req);
    expect(res!.status).toBe(400);
  });

  test("returns 401 when not authenticated", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValueOnce({
      response: new Response("Unauthorized", { status: 401 }),
    });

    const req = new NextRequest("http://localhost/api/focus/recommend", {
      method: "POST",
      body: JSON.stringify({ energy: "high", durationMin: 30 }),
    });

    const res = await POST(req);
    expect(res!.status).toBe(401);
  });
});
