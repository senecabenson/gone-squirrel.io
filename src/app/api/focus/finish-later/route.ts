import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/auth/api-auth";
import { SchedulingService } from "@/services/scheduling/SchedulingService";
import { syncChunksToGoogle } from "@/services/google-task-sync";
import { generateChunks } from "@/lib/now-mode/chunks";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, "focus-finish-later");
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body?.taskId || typeof body.remainingMin !== "number" || body.remainingMin <= 0) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: body.taskId } });
  if (!task || task.userId !== auth.userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const newChunkSizes = generateChunks(body.remainingMin, task.chunkMin, task.chunkMax);

  // Replace all `todo` chunks with the new chunk plan, then re-schedule.
  const updated = await prisma.$transaction(async (tx) => {
    await tx.taskChunk.deleteMany({ where: { taskId: task.id, status: "todo" } });
    const completedCount = await tx.taskChunk.count({ where: { taskId: task.id, status: "completed" } });
    const created = await Promise.all(
      newChunkSizes.map((min, i) =>
        tx.taskChunk.create({
          data: {
            taskId: task.id,
            chunkIndex: completedCount + i + 1,
            totalChunks: completedCount + newChunkSizes.length,
            durationMin: min,
          },
        }),
      ),
    );
    return { created, totalChunks: completedCount + newChunkSizes.length };
  });

  const service = new SchedulingService();
  for (const chunk of updated.created) {
    await service.scheduleChunk({ id: chunk.id, taskId: chunk.taskId, durationMin: chunk.durationMin }, auth.userId);
  }

  // Reload chunks to get the scheduled times for the response.
  const final = await prisma.taskChunk.findMany({
    where: { id: { in: updated.created.map((c) => c.id) } },
    orderBy: { chunkIndex: "asc" },
    select: { id: true, durationMin: true, scheduledStart: true, scheduledEnd: true },
  });

  await syncChunksToGoogle(auth.userId, updated.created.map((c) => c.id));

  return NextResponse.json({ chunks: final });
}
