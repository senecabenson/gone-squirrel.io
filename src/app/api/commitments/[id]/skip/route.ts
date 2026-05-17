import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { skipOccurrence } from "@/services/scheduling/CommitmentAdjuster";
import { scheduleAllTasksForUser } from "@/services/scheduling/TaskSchedulingService";

const LOG_SOURCE = "CommitmentSkipAPI";

// ── POST /api/commitments/[id]/skip ──────────────────────────────────────────
//
// Body: { occurrenceId: string, reflow?: "work" | "free" }  (default "work").
// Cancels the occurrence, optionally drops a temp work block over the freed
// interval, attempts one same-ISO-week makeup, then re-runs the work
// scheduler — re-running scheduleAllTasksForUser IS the reflow.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const { id } = await params;

    const commitment = await prisma.personalCommitment.findUnique({
      where: { id, userId },
    });
    if (!commitment) {
      return NextResponse.json(
        { error: "Commitment not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const occurrenceId = body.occurrenceId;
    if (typeof occurrenceId !== "string" || !occurrenceId.trim()) {
      return NextResponse.json(
        { error: "occurrenceId is required" },
        { status: 400 }
      );
    }
    const reflow = body.reflow === "free" ? "free" : "work";

    const occ = await prisma.commitmentEvent.findUnique({
      where: { id: occurrenceId },
    });
    if (!occ || occ.commitmentId !== id) {
      return NextResponse.json(
        { error: "Occurrence not found for this commitment" },
        { status: 404 }
      );
    }
    if (occ.status === "cancelled") {
      return NextResponse.json(
        { error: "Occurrence already skipped", code: "already_skipped" },
        { status: 409 }
      );
    }

    const result = await skipOccurrence(occurrenceId, { reflow });
    const plan = await scheduleAllTasksForUser(userId);

    return NextResponse.json({
      skipped: true,
      reflow: result.reflow,
      makeup: result.makeup,
      plan,
    });
  } catch (error) {
    logger.error(
      "Failed to skip commitment occurrence",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to skip commitment occurrence" },
      { status: 500 }
    );
  }
}
