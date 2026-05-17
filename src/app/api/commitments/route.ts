import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { materialize } from "@/services/scheduling/CommitmentMaterializer";
import { parseBlockTypeMap } from "@/services/scheduling/BlockCalendarService";

const LOG_SOURCE = "CommitmentsAPI";

// ── GET /api/commitments ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const now = new Date();
    const horizonEnd = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000); // 3 weeks

    const commitments = await prisma.personalCommitment.findMany({
      where: { userId },
      include: {
        events: {
          where: {
            status: { not: "cancelled" },
            start: { gte: now, lte: horizonEnd },
          },
          orderBy: { start: "asc" },
          take: 3,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ commitments });
  } catch (error) {
    logger.error(
      "Failed to list commitments",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to list commitments" },
      { status: 500 }
    );
  }
}

// ── POST /api/commitments ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const body = await request.json();
    const { label, emoji, durationMin, rrule, preferredHour, timesPerWeek, active } =
      body as Record<string, unknown>;

    // Basic field validation
    if (
      typeof label !== "string" ||
      !label.trim() ||
      typeof emoji !== "string" ||
      !emoji.trim() ||
      typeof durationMin !== "number" ||
      durationMin <= 0 ||
      typeof rrule !== "string" ||
      !rrule.trim()
    ) {
      return NextResponse.json(
        { error: "label, emoji, durationMin, and rrule are required" },
        { status: 400 }
      );
    }

    // Validate that the emoji belongs to a PROTECTED block rule.
    const settings = await prisma.autoScheduleSettings.findUnique({
      where: { userId },
    });
    const rules = parseBlockTypeMap(settings?.blockTypeMap ?? "[]");
    const rule = rules.find((r) => r.emoji === emoji);
    if (!rule || rule.eligibility !== "protected") {
      return NextResponse.json(
        {
          error:
            "emoji must correspond to a protected block type in your AutoScheduleSettings",
        },
        { status: 400 }
      );
    }

    const commitment = await prisma.personalCommitment.create({
      data: {
        userId,
        label: label.trim(),
        emoji: emoji.trim(),
        durationMin,
        rrule: rrule.trim(),
        preferredHour:
          typeof preferredHour === "number" ? preferredHour : null,
        timesPerWeek:
          typeof timesPerWeek === "number" ? timesPerWeek : null,
        active: typeof active === "boolean" ? active : true,
      },
    });

    const materializeResult = await materialize(userId);

    return NextResponse.json(
      { commitment, materialize: materializeResult },
      { status: 201 }
    );
  } catch (error) {
    logger.error(
      "Failed to create commitment",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to create commitment" },
      { status: 500 }
    );
  }
}
