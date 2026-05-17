import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  moveOccurrence,
  CommitmentMoveConflictError,
} from "@/services/scheduling/CommitmentAdjuster";
import { scheduleAllTasksForUser } from "@/services/scheduling/TaskSchedulingService";

const LOG_SOURCE = "CommitmentMoveAPI";

// ── POST /api/commitments/[id]/move ──────────────────────────────────────────
//
// Body: { occurrenceId: string, newStart: ISO8601 }.
// Validate-first relocate (duration preserved). A conflict throws
// CommitmentMoveConflictError → 409 and the recompute is skipped (the
// occurrence was never mutated). On success the work scheduler re-runs so
// displaced work reflows.

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
    const newStart =
      typeof body.newStart === "string" ? new Date(body.newStart) : null;
    if (!newStart || Number.isNaN(newStart.getTime())) {
      return NextResponse.json(
        { error: "newStart must be a valid ISO date string" },
        { status: 400 }
      );
    }

    const occ = await prisma.commitmentEvent.findUnique({
      where: { id: occurrenceId },
    });
    if (!occ || occ.commitmentId !== id) {
      return NextResponse.json(
        { error: "Occurrence not found for this commitment" },
        { status: 404 }
      );
    }

    let result;
    try {
      result = await moveOccurrence(occurrenceId, newStart);
    } catch (err) {
      if (err instanceof CommitmentMoveConflictError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: 409 }
        );
      }
      throw err;
    }

    const plan = await scheduleAllTasksForUser(userId);

    return NextResponse.json({
      moved: true,
      start: result.start,
      end: result.end,
      plan,
    });
  } catch (error) {
    logger.error(
      "Failed to move commitment occurrence",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to move commitment occurrence" },
      { status: 500 }
    );
  }
}
