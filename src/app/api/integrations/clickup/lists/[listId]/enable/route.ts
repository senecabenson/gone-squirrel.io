import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { clickUpFetch } from "../../../_clickup-http";

const LOG_SOURCE = "clickup-integration";

interface ClickUpListSpace {
  id: string;
  name: string;
}

interface ClickUpListResponse {
  id: string;
  name: string;
  task_count: number | null;
  space: ClickUpListSpace;
}

/**
 * POST /api/integrations/clickup/lists/[listId]/enable
 * Mirror a ClickUp List as a local Project. Requires the parent Space to already be enabled.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;
    const { listId } = await params;

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

    // Fetch list info from ClickUp — includes parent space
    const list = await clickUpFetch<ClickUpListResponse>(
      account.accessToken,
      `/list/${listId}`
    );

    // Find the parent Workspace (must already be enabled)
    const parentWorkspace = await prisma.workspace.findFirst({
      where: {
        userId,
        externalId: list.space.id,
        externalSource: "CLICKUP",
        status: "active",
      },
      select: { id: true },
    });

    if (!parentWorkspace) {
      return NextResponse.json(
        { error: "Enable the parent space first" },
        { status: 400 }
      );
    }

    // Find the user's CLICKUP TaskProvider
    const taskProvider = await prisma.taskProvider.findFirst({
      where: { userId, type: "CLICKUP" },
      select: { id: true },
    });

    if (!taskProvider) {
      return NextResponse.json(
        { error: "ClickUp account not connected" },
        { status: 400 }
      );
    }

    // Project has no unique index on (userId, externalId, externalSource), so we
    // do a manual find-or-create rather than prisma.upsert.
    let project = await prisma.project.findFirst({
      where: {
        userId,
        externalId: listId,
        externalSource: "CLICKUP",
      },
    });

    if (project) {
      project = await prisma.project.update({
        where: { id: project.id },
        data: {
          name: list.name,
          workspaceId: parentWorkspace.id,
          status: "active",
        },
      });
    } else {
      project = await prisma.project.create({
        data: {
          userId,
          name: list.name,
          workspaceId: parentWorkspace.id,
          externalId: listId,
          externalSource: "CLICKUP",
          status: "active",
        },
      });
    }

    // Create TaskListMapping if it doesn't exist yet
    await prisma.taskListMapping.upsert({
      where: {
        providerId_externalListId: {
          providerId: taskProvider.id,
          externalListId: listId,
        },
      },
      create: {
        providerId: taskProvider.id,
        projectId: project.id,
        externalListId: listId,
        externalListName: list.name,
        direction: "bidirectional",
        syncEnabled: true,
      },
      update: {
        externalListName: list.name,
        syncEnabled: true,
        direction: "bidirectional",
      },
    });

    logger.info(
      "ClickUp list enabled",
      { userId, listId, projectId: project.id },
      LOG_SOURCE
    );

    return NextResponse.json({ project });
  } catch (error) {
    logger.error(
      "Failed to enable ClickUp list",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to enable ClickUp list" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/clickup/lists/[listId]/enable
 * Archive a mirrored Project and disable its TaskListMapping.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;
    const { listId } = await params;

    // Find the local Project
    const project = await prisma.project.findFirst({
      where: {
        userId,
        externalId: listId,
        externalSource: "CLICKUP",
      },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Archive the Project
    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { status: "archived" },
    });

    // Disable the TaskListMapping (don't delete — preserves history)
    await prisma.taskListMapping.updateMany({
      where: { externalListId: listId },
      data: { syncEnabled: false },
    });

    logger.info(
      "ClickUp list disabled (archived)",
      { userId, listId, projectId: project.id },
      LOG_SOURCE
    );

    return NextResponse.json({ project: updated });
  } catch (error) {
    logger.error(
      "Failed to disable ClickUp list",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to disable ClickUp list" },
      { status: 500 }
    );
  }
}
