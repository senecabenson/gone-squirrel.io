import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const LOG_SOURCE = "clickup-integration";

/**
 * DELETE /api/integrations/clickup/disconnect
 * Remove ClickUp TaskProvider + ConnectedAccount and archive all mirrored Workspaces.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    // Archive all CLICKUP Workspaces (and their child Projects) — don't hard-delete
    const clickupWorkspaces = await prisma.workspace.findMany({
      where: {
        userId,
        externalSource: "CLICKUP",
      },
      select: { id: true },
    });

    const workspaceIds = clickupWorkspaces.map((w) => w.id);

    if (workspaceIds.length > 0) {
      // Archive child Projects first
      await prisma.project.updateMany({
        where: {
          userId,
          workspaceId: { in: workspaceIds },
        },
        data: { status: "archived" },
      });

      // Archive the Workspaces themselves
      await prisma.workspace.updateMany({
        where: {
          id: { in: workspaceIds },
          userId,
        },
        data: { status: "archived" },
      });
    }

    // Delete TaskProvider (cascades to TaskListMapping rows)
    await prisma.taskProvider.deleteMany({
      where: { userId, type: "CLICKUP" },
    });

    // Delete ConnectedAccount
    await prisma.connectedAccount.deleteMany({
      where: { userId, provider: "CLICKUP" },
    });

    logger.info(
      "ClickUp account disconnected",
      { userId, archivedWorkspaces: workspaceIds.length },
      LOG_SOURCE
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error(
      "Failed to disconnect ClickUp account",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to disconnect ClickUp account" },
      { status: 500 }
    );
  }
}
