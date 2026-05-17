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

    const body = await request.json();
    const updates = body as Record<string, unknown>;

    // If the emoji is being changed, validate it is still protected.
    if ("emoji" in updates) {
      const newEmoji = updates.emoji;
      if (typeof newEmoji !== "string" || !newEmoji.trim()) {
        return NextResponse.json({ error: "emoji must be a non-empty string" }, { status: 400 });
      }
      const settings = await prisma.autoScheduleSettings.findUnique({
        where: { userId },
      });
      const rules = parseBlockTypeMap(settings?.blockTypeMap ?? "[]");
      const rule = rules.find((r) => r.emoji === newEmoji);
      if (!rule || rule.eligibility !== "protected") {
        return NextResponse.json(
          {
            error:
              "emoji must correspond to a protected block type in your AutoScheduleSettings",
          },
          { status: 400 }
        );
      }
    }

    const needsRematerialize = Object.keys(updates).some((k) =>
      REMATERIALIZE_FIELDS.has(k)
    );

    if (needsRematerialize) {
      await revoke(id);
    }

    const updated = await prisma.personalCommitment.update({
      where: { id, userId },
      data: updates,
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
