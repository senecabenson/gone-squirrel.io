import { POST } from "../route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/api-auth", () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ userId: "u1" }),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    taskChunk: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    task: { update: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

beforeEach(() => jest.clearAllMocks());

describe("POST /api/focus/chunks/[id]/complete", () => {
  test("marks chunk complete; parent stays open if other chunks remain", async () => {
    (prisma.taskChunk.findUnique as jest.Mock).mockResolvedValue({
      id: "c1", taskId: "t1", task: { userId: "u1" },
    });
    (prisma.taskChunk.findMany as jest.Mock).mockResolvedValue([{ id: "c2", status: "todo" }]);
    const req = new NextRequest("http://localhost/api/focus/chunks/c1/complete", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "c1" }) });
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.parentClosed).toBe(false);
    expect(body.chunkId).toBe("c1");
    expect(prisma.taskChunk.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({ status: "completed" }),
    });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  test("marks chunk complete; parent auto-closes when no remaining chunks", async () => {
    (prisma.taskChunk.findUnique as jest.Mock).mockResolvedValue({
      id: "c1", taskId: "t1", task: { userId: "u1" },
    });
    (prisma.taskChunk.findMany as jest.Mock).mockResolvedValue([]);
    const req = new NextRequest("http://localhost/api/focus/chunks/c1/complete", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "c1" }) });
    const body = await res!.json();
    expect(body.parentClosed).toBe(true);
    expect(prisma.task.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "t1" },
      data: expect.objectContaining({ status: "completed" }),
    }));
  });

  test("404 when chunk not found", async () => {
    (prisma.taskChunk.findUnique as jest.Mock).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/focus/chunks/missing/complete", { method: "POST" });
    expect((await POST(req, { params: Promise.resolve({ id: "missing" }) }))!.status).toBe(404);
  });

  test("404 when chunk owned by another user", async () => {
    (prisma.taskChunk.findUnique as jest.Mock).mockResolvedValue({
      id: "c1", taskId: "t1", task: { userId: "other" },
    });
    const req = new NextRequest("http://localhost/api/focus/chunks/c1/complete", { method: "POST" });
    expect((await POST(req, { params: Promise.resolve({ id: "c1" }) }))!.status).toBe(404);
  });
});
