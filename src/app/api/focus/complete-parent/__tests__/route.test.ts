import { POST } from "../route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/api-auth", () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ userId: "u1" }),
}));

jest.mock("@/services/google-task-sync", () => ({
  deleteChunkEvents: jest.fn().mockResolvedValue(undefined),
}));

const txMock = {
  task: { findUnique: jest.fn(), update: jest.fn() },
  taskChunk: { findMany: jest.fn(), updateMany: jest.fn() },
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn().mockImplementation((cb: unknown) => (cb as (tx: unknown) => unknown)(txMock)),
  },
}));

import { deleteChunkEvents } from "@/services/google-task-sync";

beforeEach(() => {
  jest.clearAllMocks();
  txMock.task.findUnique.mockReset();
  txMock.task.update.mockReset();
  txMock.taskChunk.findMany.mockReset();
  txMock.taskChunk.updateMany.mockReset();
});

describe("POST /api/focus/complete-parent", () => {
  test("closes parent + all remaining chunks + delegates GCal cleanup", async () => {
    txMock.task.findUnique.mockResolvedValue({ id: "t1", userId: "u1" });
    txMock.taskChunk.findMany.mockResolvedValue([
      { id: "c2", googleEventId: "evtc2" },
      { id: "c3", googleEventId: "evtc3" },
    ]);
    txMock.taskChunk.updateMany.mockResolvedValue({ count: 2 });
    txMock.task.update.mockResolvedValue({ id: "t1", status: "completed" });

    const req = new NextRequest("http://localhost/api/focus/complete-parent", {
      method: "POST",
      body: JSON.stringify({ taskId: "t1" }),
    });
    const res = await POST(req);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.closedChunks).toEqual(["c2", "c3"]);
    expect(txMock.task.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "t1" },
      data: expect.objectContaining({ status: "completed" }),
    }));
    expect(txMock.taskChunk.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { taskId: "t1", status: { not: "completed" } },
      data: expect.objectContaining({ status: "completed" }),
    }));
    expect(deleteChunkEvents).toHaveBeenCalledWith(
      [{ id: "c2", googleEventId: "evtc2" }, { id: "c3", googleEventId: "evtc3" }],
      "u1",
    );
  });

  test("404 when task not found", async () => {
    txMock.task.findUnique.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/focus/complete-parent", {
      method: "POST",
      body: JSON.stringify({ taskId: "missing" }),
    });
    expect((await POST(req))!.status).toBe(404);
  });

  test("404 when task owned by another user", async () => {
    txMock.task.findUnique.mockResolvedValue({ id: "t1", userId: "other" });
    const req = new NextRequest("http://localhost/api/focus/complete-parent", {
      method: "POST",
      body: JSON.stringify({ taskId: "t1" }),
    });
    expect((await POST(req))!.status).toBe(404);
  });

  test("400 on invalid input", async () => {
    const req = new NextRequest("http://localhost/api/focus/complete-parent", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect((await POST(req))!.status).toBe(400);
  });
});
