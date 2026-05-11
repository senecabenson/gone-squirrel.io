import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth/api-auth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRequest(req, "focus-chunk-complete");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;

  const chunk = await prisma.taskChunk.findUnique({
    where: { id },
    include: { task: { select: { userId: true } } },
  });
  if (!chunk || chunk.task.userId !== auth.userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.taskChunk.update({
    where: { id },
    data: { status: "completed", completedAt: new Date() },
  });

  const remaining = await prisma.taskChunk.findMany({
    where: { taskId: chunk.taskId, status: { not: "completed" } },
    select: { id: true, status: true },
  });

  let parentClosed = false;
  if (remaining.length === 0) {
    await prisma.task.update({
      where: { id: chunk.taskId },
      data: { status: "completed", completedAt: new Date() },
    });
    parentClosed = true;
  }

  return NextResponse.json({ chunkId: id, parentClosed });
}
