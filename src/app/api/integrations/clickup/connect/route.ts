import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  ClickUpApiError,
  ClickUpClient,
} from "@/lib/task-sync/providers/clickup/clickup-client";
import type { ClickUpTeam } from "@/lib/task-sync/providers/clickup/types";

const LOG_SOURCE = "clickup-integration";

const connectBodySchema = z.object({
  token: z.string().min(1),
});

/**
 * POST /api/integrations/clickup/connect
 * Validate a ClickUp Personal API Token, store credentials, and return the user's ClickUp teams.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    // Parse + validate body
    const body: unknown = await request.json();
    const parsed = connectBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid token field" },
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    // Validate token by calling ClickUp API
    let teams: ClickUpTeam[];
    try {
      const client = new ClickUpClient(token);
      teams = await client.getTeams();
    } catch (err) {
      if (err instanceof ClickUpApiError && err.status === 401) {
        logger.warn(
          "Invalid ClickUp token provided",
          { userId },
          LOG_SOURCE
        );
        return NextResponse.json(
          { error: "Invalid ClickUp token" },
          { status: 400 }
        );
      }
      throw err;
    }

    // Fetch the GS user's email to use as the ConnectedAccount.email sentinel
    const gsUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const accountEmail = gsUser?.email ?? "clickup-pat";

    // Upsert ConnectedAccount — PATs don't expire; use year 9999 as sentinel
    const connectedAccount = await prisma.connectedAccount.upsert({
      where: {
        userId_provider_email: {
          userId,
          provider: "CLICKUP",
          email: accountEmail,
        },
      },
      create: {
        provider: "CLICKUP",
        email: accountEmail,
        accessToken: token,
        refreshToken: null,
        expiresAt: new Date("9999-12-31T23:59:59.999Z"),
        userId,
      },
      update: {
        accessToken: token,
        refreshToken: null,
        expiresAt: new Date("9999-12-31T23:59:59.999Z"),
      },
    });

    // Upsert TaskProvider
    await prisma.taskProvider.upsert({
      where: {
        userId_type: {
          userId,
          type: "CLICKUP",
        },
      },
      create: {
        userId,
        type: "CLICKUP",
        name: "ClickUp",
        enabled: true,
        syncEnabled: true,
        accountId: connectedAccount.id,
      },
      update: {
        enabled: true,
        syncEnabled: true,
        accountId: connectedAccount.id,
        error: null,
      },
    });

    logger.info(
      "ClickUp account connected",
      { userId, teamCount: teams.length },
      LOG_SOURCE
    );

    return NextResponse.json({ ok: true, teams });
  } catch (error) {
    logger.error(
      "Failed to connect ClickUp account",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to connect ClickUp account" },
      { status: 500 }
    );
  }
}
