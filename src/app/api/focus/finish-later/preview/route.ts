import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { SchedulingService } from "@/services/scheduling/SchedulingService";

const LOG_SOURCE = "focus-finish-later-preview";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, LOG_SOURCE);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.taskId !== "string" ||
    typeof body.remainingMin !== "number" ||
    body.remainingMin <= 0
  ) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: body.taskId } });
  if (!task || task.userId !== auth.userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const service = new SchedulingService();
  const slot = await service.previewSlot(
    { ...task, duration: body.remainingMin },
    auth.userId,
  );

  if (!slot) {
    return NextResponse.json({ error: "no slot available" }, { status: 422 });
  }

  return NextResponse.json({
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    reasoning: `${slot.start.toLocaleString()} · ${body.remainingMin} min`,
  });
}
