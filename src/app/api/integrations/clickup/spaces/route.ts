import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { clickUpFetch } from "../_clickup-http";

const LOG_SOURCE = "clickup-integration";

interface ClickUpSpace {
  id: string;
  name: string;
  color: string | null;
  private: boolean;
  statuses: unknown[];
  multiple_assignees: boolean;
  features: Record<string, unknown>;
}

interface ClickUpSpacesResponse {
  spaces: ClickUpSpace[];
}

interface ClickUpTeam {
  id: string;
  name: string;
}

interface ClickUpTeamsResponse {
  teams: ClickUpTeam[];
}

/**
 * GET /api/integrations/clickup/spaces
 * List all ClickUp Spaces for the user's first Team, annotated with local enablement status.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    // Retrieve stored token
    const account = await prisma.connectedAccount.findFirst({
      where: { userId, provider: "CLICKUP" },
      select: { accessToken: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "ClickUp account not connected" },
        { status: 400 }
      );
    }

    const token = account.accessToken;

    // Get first team ID
    const teamsData = await clickUpFetch<ClickUpTeamsResponse>(token, "/team");
    const firstTeam = teamsData.teams[0];

    if (!firstTeam) {
      return NextResponse.json(
        { error: "No ClickUp teams found" },
        { status: 400 }
      );
    }

    // Fetch spaces for that team
    const spacesData = await clickUpFetch<ClickUpSpacesResponse>(
      token,
      `/team/${firstTeam.id}/space?archived=false`
    );

    // Fetch local workspaces for this user to determine enablement
    const localWorkspaces = await prisma.workspace.findMany({
      where: {
        userId,
        externalSource: "CLICKUP",
        status: "active",
      },
      select: { externalId: true },
    });

    const enabledSpaceIds = new Set(
      localWorkspaces.map((w) => w.externalId).filter(Boolean)
    );

    const spaces = spacesData.spaces.map((space) => ({
      id: space.id,
      name: space.name,
      color: space.color ?? null,
      enabled: enabledSpaceIds.has(space.id),
    }));

    return NextResponse.json({ spaces });
  } catch (error) {
    logger.error(
      "Failed to list ClickUp spaces",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to list ClickUp spaces" },
      { status: 500 }
    );
  }
}
