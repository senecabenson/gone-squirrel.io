import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  materialize,
  revoke,
} from "@/services/scheduling/CommitmentMaterializer";
import { parseBlockTypeMap } from "@/services/scheduling/BlockCalendarService";

const LOG_SOURCE = "CommitmentByIdAPI";

// Fields whose change requires revoking existing materialized events and
// re-materializing from scratch.
const REMATERIALIZE_FIELDS = new Set([
  "rrule",
  "emoji",
  "durationMin",
  "preferredHour",
  "active",
]);

// ── PATCH /api/commitments/[id] ───────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const { id } = await params;

    const existing = await prisma.personalCommitment.findUnique({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Allowlist: only these fields may be patched. Anything else (userId,
    // relation writes, id, …) is ignored — no mass-assignment. Mirrors the
    // explicit-destructure validation in POST /api/commitments.
    const {
      label,
      emoji,
      durationMin,
      rrule,
      preferredHour,
      timesPerWeek,
      active,
    } = body;

    const data: Record<string, unknown> = {};
    if (label !== undefined) {
      if (typeof label !== "string" || !label.trim()) {
        return NextResponse.json(
          { error: "label must be a non-empty string" },
          { status: 400 }
        );
      }
      data.label = label.trim();
    }
    if (durationMin !== undefined) {
      if (typeof durationMin !== "number" || durationMin <= 0) {
        return NextResponse.json(
          { error: "durationMin must be a positive number" },
          { status: 400 }
        );
      }
      data.durationMin = durationMin;
    }
    if (rrule !== undefined) {
      if (typeof rrule !== "string" || !rrule.trim()) {
        return NextResponse.json(
          { error: "rrule must be a non-empty string" },
          { status: 400 }
        );
      }
      data.rrule = rrule.trim();
    }
    if (preferredHour !== undefined) {
      data.preferredHour =
        typeof preferredHour === "number" ? preferredHour : null;
    }
    if (timesPerWeek !== undefined) {
      data.timesPerWeek =
        typeof timesPerWeek === "number" ? timesPerWeek : null;
    }
    if (active !== undefined) {
      if (typeof active !== "boolean") {
        return NextResponse.json(
          { error: "active must be a boolean" },
          { status: 400 }
        );
      }
      data.active = active;
    }

    // If the emoji is being changed, validate it is still protected.
    if (emoji !== undefined) {
      if (typeof emoji !== "string" || !emoji.trim()) {
        return NextResponse.json(
          { error: "emoji must be a non-empty string" },
          { status: 400 }
        );
      }
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
      data.emoji = emoji.trim();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "no updatable fields provided" },
        { status: 400 }
      );
    }

    const needsRematerialize = Object.keys(data).some((k) =>
      REMATERIALIZE_FIELDS.has(k)
    );

    if (needsRematerialize) {
      await revoke(id);
    }

    const updated = await prisma.personalCommitment.update({
      where: { id, userId },
      data,
    });

    let materializeResult = null;
    if (needsRematerialize) {
      materializeResult = await materialize(userId);
    }

    return NextResponse.json({ commitment: updated, materialize: materializeResult });
  } catch (error) {
    logger.error(
      "Failed to update commitment",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to update commitment" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/commitments/[id] ─────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const { id } = await params;

    const existing = await prisma.personalCommitment.findUnique({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    await revoke(id);
    await prisma.personalCommitment.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error(
      "Failed to delete commitment",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to delete commitment" },
      { status: 500 }
    );
  }
}
