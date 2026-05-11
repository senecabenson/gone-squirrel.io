import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth/api-auth";
import { deleteChunkEvents } from "@/services/google-task-sync";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, "focus-complete-parent");
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body?.taskId) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: body.taskId } });
    if (!task || task.userId !== auth.userId) return null;

    const remainingChunks = await tx.taskChunk.findMany({
      where: { taskId: task.id, status: { not: "completed" } },
      select: { id: true, googleEventId: true },
    });

    await tx.taskChunk.updateMany({
      where: { taskId: task.id, status: { not: "completed" } },
      data: { status: "completed", completedAt: new Date() },
    });

    await tx.task.update({
      where: { id: task.id },
      data: { status: "completed", completedAt: new Date() },
    });

    return { task, remainingChunks };
  });

  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });

  // GCal cleanup — best effort, non-blocking for the response.
  await deleteChunkEvents(result.remainingChunks, auth.userId).catch(() => {});

  return NextResponse.json({
    closedChunks: result.remainingChunks.map((c) => c.id),
  });
}
