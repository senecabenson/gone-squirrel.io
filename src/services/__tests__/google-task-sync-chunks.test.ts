import { pushChunk } from "../google-task-sync";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    taskChunk: { update: jest.fn() },
    task: { findUnique: jest.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

const mockEvents = {
  list: jest.fn(),
  insert: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

const mockClient = { events: mockEvents } as unknown as Parameters<typeof pushChunk>[2];

describe("pushChunk", () => {
  beforeEach(() => {
    Object.values(mockEvents).forEach((fn) => (fn as jest.Mock).mockReset());
    (prisma.task.findUnique as jest.Mock).mockReset();
    (prisma.taskChunk.update as jest.Mock).mockReset();
    mockEvents.list.mockResolvedValue({ data: { items: [] } });
    mockEvents.insert.mockResolvedValue({ data: { id: "new-evt-id" } });
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({ title: "Q3 contracts" });
  });

  test("inserts new event with extendedProperties chunkId + taskId when scheduled + no eventId", async () => {
    await pushChunk(
      {
        id: "c1", taskId: "t1", chunkIndex: 2, totalChunks: 4, durationMin: 30,
        scheduledStart: new Date("2026-05-12T10:30:00Z"),
        scheduledEnd: new Date("2026-05-12T11:00:00Z"),
        googleEventId: null, status: "todo",
      },
      "calendar-id",
      mockClient,
      "UTC",
    );
    expect(mockEvents.insert).toHaveBeenCalled();
    const insertCall = mockEvents.insert.mock.calls[0][0];
    expect(insertCall.requestBody.extendedProperties.private).toMatchObject({
      taskId: "t1",
      chunkId: "c1",
    });
    expect(insertCall.requestBody.colorId).toBe("8");
  });

  test("patches event when scheduled + has eventId", async () => {
    mockEvents.patch.mockResolvedValue({ data: {} });
    await pushChunk(
      {
        id: "c1", taskId: "t1", chunkIndex: 1, totalChunks: 2, durationMin: 30,
        scheduledStart: new Date("2026-05-12T10:30:00Z"),
        scheduledEnd: new Date("2026-05-12T11:00:00Z"),
        googleEventId: "evt-existing", status: "todo",
      },
      "calendar-id",
      mockClient,
      "UTC",
    );
    expect(mockEvents.patch).toHaveBeenCalledWith(expect.objectContaining({
      calendarId: "calendar-id",
      eventId: "evt-existing",
    }));
    expect(mockEvents.insert).not.toHaveBeenCalled();
  });

  test("deletes when chunk has eventId but no schedule", async () => {
    mockEvents.delete.mockResolvedValue({});
    await pushChunk(
      {
        id: "c1", taskId: "t1", chunkIndex: 1, totalChunks: 2, durationMin: 30,
        scheduledStart: null, scheduledEnd: null,
        googleEventId: "evt-existing", status: "todo",
      },
      "calendar-id",
      mockClient,
      "UTC",
    );
    expect(mockEvents.delete).toHaveBeenCalledWith({ calendarId: "calendar-id", eventId: "evt-existing" });
    expect(prisma.taskChunk.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { googleEventId: null },
    });
  });

  test("adopts existing event found by privateExtendedProperty chunkId", async () => {
    mockEvents.list.mockResolvedValue({ data: { items: [{ id: "evt-adopted" }] } });
    await pushChunk(
      {
        id: "c1", taskId: "t1", chunkIndex: 1, totalChunks: 2, durationMin: 30,
        scheduledStart: new Date("2026-05-12T10:30:00Z"),
        scheduledEnd: new Date("2026-05-12T11:00:00Z"),
        googleEventId: null, status: "todo",
      },
      "calendar-id",
      mockClient,
      "UTC",
    );
    expect(mockEvents.insert).not.toHaveBeenCalled();
    expect(prisma.taskChunk.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { googleEventId: "evt-adopted" },
    });
  });

  test("patches with strikethrough + green color when completed + has eventId", async () => {
    mockEvents.patch.mockResolvedValue({ data: {} });
    await pushChunk(
      {
        id: "c1", taskId: "t1", chunkIndex: 1, totalChunks: 2, durationMin: 30,
        scheduledStart: new Date("2026-05-12T10:30:00Z"),
        scheduledEnd: new Date("2026-05-12T11:00:00Z"),
        googleEventId: "evt-existing", status: "completed",
      },
      "calendar-id",
      mockClient,
      "UTC",
    );
    expect(mockEvents.patch).toHaveBeenCalled();
    const patchCall = mockEvents.patch.mock.calls[0][0];
    expect(patchCall.requestBody.colorId).toBe("2");
    // Strikethrough check: U+0336 combining char present in summary
    expect(patchCall.requestBody.summary).toMatch(/̶/);
  });
});
