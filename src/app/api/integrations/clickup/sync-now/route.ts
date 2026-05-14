import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { TaskSyncManager } from "@/lib/task-sync/task-sync-manager";

const LOG_SOURCE = "clickup-integration";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request, LOG_SOURCE);
    if ("response" in auth) {
      return auth.response;
    }

    const userId = auth.userId;

    const taskProvider = await prisma.taskProvider.findFirst({
      where: { userId, type: "CLICKUP" },
      select: { id: true, enabled: true, syncEnabled: true },
    });

    if (!taskProvider) {
      return NextResponse.json(
        { error: "ClickUp account not connected" },
        { status: 400 }
      );
    }

    const mappings = await prisma.taskListMapping.findMany({
      where: { providerId: taskProvider.id, syncEnabled: true },
      include: { provider: true },
    });

    const syncManager = new TaskSyncManager();
    const results = [] as Array<{ mappingId: string; ok: boolean; error?: string }>;

    for (const mapping of mappings) {
      try {
        await syncManager.syncTaskList(mapping);
        results.push({ mappingId: mapping.id, ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          "ClickUp sync-now mapping failed",
          { mappingId: mapping.id, error: message },
          LOG_SOURCE
        );
        results.push({ mappingId: mapping.id, ok: false, error: message });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    logger.error(
      "Failed to trigger ClickUp sync",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to trigger ClickUp sync" },
      { status: 500 }
    );
  }
}
