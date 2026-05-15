import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  ClickUpApiError,
  ClickUpClient,
} from "@/lib/task-sync/providers/clickup/clickup-client";

const LOG_SOURCE = "clickup-integration";

/**
 * POST /api/integrations/clickup/spaces/[spaceId]/enable
 * Upsert a local Workspace mirroring the given ClickUp Space.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;
    const { spaceId } = await params;

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

    // Fetch space info from ClickUp
    const client = new ClickUpClient(account.accessToken);
    const space = await client.getSpace(spaceId);

    // Upsert local Workspace
    const workspace = await prisma.workspace.upsert({
      where: {
        userId_externalId_externalSource: {
          userId,
          externalId: spaceId,
          externalSource: "CLICKUP",
        },
      },
      create: {
        userId,
        name: space.name,
        color: space.color ?? null,
        externalId: spaceId,
        externalSource: "CLICKUP",
        status: "active",
      },
      update: {
        name: space.name,
        color: space.color ?? null,
        status: "active",
      },
    });

    logger.info(
      "ClickUp space enabled",
      { userId, spaceId, workspaceId: workspace.id },
      LOG_SOURCE
    );

    return NextResponse.json({ workspace });
  } catch (error) {
    if (error instanceof ClickUpApiError && error.status === 401) {
      return NextResponse.json(
        { error: "ClickUp token rejected" },
        { status: 401 }
      );
    }
    logger.error(
      "Failed to enable ClickUp space",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to enable ClickUp space" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/clickup/spaces/[spaceId]/enable
 * Archive the local Workspace and all its child Projects.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;
    const { spaceId } = await params;

    // Find the local Workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        userId,
        externalId: spaceId,
        externalSource: "CLICKUP",
      },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Archive child Projects first
    await prisma.project.updateMany({
      where: {
        userId,
        workspaceId: workspace.id,
      },
      data: { status: "archived" },
    });

    // Archive the Workspace
    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { status: "archived" },
    });

    logger.info(
      "ClickUp space disabled (archived)",
      { userId, spaceId, workspaceId: workspace.id },
      LOG_SOURCE
    );

    return NextResponse.json({ workspace: updated });
  } catch (error) {
    logger.error(
      "Failed to disable ClickUp space",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to disable ClickUp space" },
      { status: 500 }
    );
  }
}

