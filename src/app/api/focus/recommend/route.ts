import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { generateChunks } from "@/lib/now-mode/chunks";
import { pickMismatchReasoning, pickReasoning } from "@/lib/now-mode/reasoning";
import { scoreTasks } from "@/lib/now-mode/score";
import { prisma } from "@/lib/prisma";

const LOG_SOURCE = "focus-recommend";

const VALID_ENERGY = new Set(["low", "medium", "high"]);
const VALID_DURATIONS = new Set([15, 30, 45, 60, 90]);

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, LOG_SOURCE);
  if ("response" in auth) {
    return auth.response;
  }
  const { userId } = auth;

  let body: { energy: unknown; durationMin: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  if (
    !body ||
    !VALID_ENERGY.has(body.energy as string) ||
    !VALID_DURATIONS.has(body.durationMin as number)
  ) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const energy = body.energy as "low" | "medium" | "high";
  const durationMin = body.durationMin as number;

  const [userSettings, tasks, lastCompleted] = await Promise.all([
    prisma.userSettings.findUnique({
      where: { userId },
      select: { timeZone: true },
    }),
    prisma.task.findMany({
      where: { userId, status: "todo" },
      select: {
        id: true,
        title: true,
        energyLevel: true,
        duration: true,
        chunkMin: true,
        chunkMax: true,
        dueDate: true,
        projectId: true,
        createdAt: true,
        status: true,
      },
    }),
    prisma.task.findFirst({
      where: { userId, status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { projectId: true, completedAt: true },
    }),
  ]);

  const within24h = lastCompleted?.completedAt
    ? Date.now() - lastCompleted.completedAt.getTime() < 24 * 60 * 60 * 1000
    : false;

  const now = new Date();

  const result = scoreTasks({
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      energyLevel: t.energyLevel as "low" | "medium" | "high" | null,
      timeEstimate: t.duration ?? 30,
      chunkMin: t.chunkMin,
      chunkMax: t.chunkMax,
      dueDate: t.dueDate,
      projectId: t.projectId,
      createdAt: t.createdAt,
      lastFocusedAt: null,
      status: t.status,
    })),
    energy,
    durationMin,
    now,
    userTimeZone: userSettings?.timeZone ?? "UTC",
    lastCompletedProjectId: within24h ? (lastCompleted?.projectId ?? null) : null,
  });

  if (!result) {
    return NextResponse.json({ error: "no tasks" }, { status: 404 });
  }

  // Materialize chunks if missing for the recommended task
  let chunkRows = await prisma.taskChunk.findMany({
    where: { taskId: result.task.id, status: { not: "completed" } },
    orderBy: { chunkIndex: "asc" },
  });

  if (chunkRows.length === 0) {
    const sizes = generateChunks(
      result.task.timeEstimate,
      result.task.chunkMin,
      result.task.chunkMax,
    );
    chunkRows = await prisma.$transaction(
      sizes.map((min, i) =>
        prisma.taskChunk.upsert({
          where: { taskId_chunkIndex: { taskId: result.task.id, chunkIndex: i + 1 } },
          update: {},
          create: {
            taskId: result.task.id,
            chunkIndex: i + 1,
            totalChunks: sizes.length,
            durationMin: min,
          },
        }),
      ),
    );
  }

  const recommendedChunk = chunkRows[result.chunkIndex - 1] ?? chunkRows[0];

  const reasoning = result.matchedExactly
    ? pickReasoning({
        taskTitle: result.task.title,
        energy,
        durationMin,
        chunkDurationMin: result.chunkDurationMin,
        dueDate: result.task.dueDate,
        now,
      })
    : pickMismatchReasoning({
        taskTitle: result.task.title,
        requestedMin: durationMin,
        actualMin: result.chunkDurationMin,
      });

  return NextResponse.json({
    task: {
      id: result.task.id,
      title: result.task.title,
      projectId: result.task.projectId,
    },
    chunk: {
      id: recommendedChunk.id,
      index: result.chunkIndex,
      total: result.totalChunks,
      durationMin: result.chunkDurationMin,
    },
    matchedExactly: result.matchedExactly,
    reasoning,
    score: result.score,
    components: result.components,
  });
}
