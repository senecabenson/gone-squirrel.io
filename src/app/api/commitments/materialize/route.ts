import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { materialize } from "@/services/scheduling/CommitmentMaterializer";

const LOG_SOURCE = "CommitmentsMaterializeAPI";

// ── POST /api/commitments/materialize ────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    let horizonDays: number | undefined;
    try {
      const body = await request.json();
      if (typeof body?.horizonDays === "number" && body.horizonDays > 0) {
        horizonDays = body.horizonDays;
      }
    } catch {
      // Empty or non-JSON body is fine — horizonDays stays undefined.
    }

    const result = await materialize(userId, horizonDays);

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      "Failed to materialize commitments",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to materialize commitments" },
      { status: 500 }
    );
  }
}
