import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  ClickUpApiError,
  ClickUpClient,
} from "@/lib/task-sync/providers/clickup/clickup-client";

const LOG_SOURCE = "clickup-integration";

interface ListItem {
  id: string;
  name: string;
  taskCount: number;
  folderName: string | null;
  enabled: boolean;
}

/**
 * GET /api/integrations/clickup/spaces/[spaceId]/lists
 * Enumerate all lists in a ClickUp Space (both folderless and inside folders).
 * Annotates each list with whether it is already mirrored locally.
 */
export async function GET(
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

    const client = new ClickUpClient(account.accessToken);

    // Fetch folderless lists and folders in parallel (client appends ?archived=false)
    const [folderlessLists, folders] = await Promise.all([
      client.getFolderlessLists(spaceId),
      client.getFolders(spaceId),
    ]);

    // Collect all list IDs so we can check local enablement in one query
    const allLists: ListItem[] = [];

    // Folderless lists
    for (const list of folderlessLists) {
      allLists.push({
        id: list.id,
        name: list.name,
        taskCount: list.task_count ?? 0,
        folderName: null,
        enabled: false, // filled below
      });
    }

    // Lists inside folders
    for (const folder of folders) {
      for (const list of folder.lists ?? []) {
        allLists.push({
          id: list.id,
          name: list.name,
          taskCount: list.task_count ?? 0,
          folderName: folder.name,
          enabled: false, // filled below
        });
      }
    }

    // Check which lists are already mirrored locally
    const externalIds = allLists.map((l) => l.id);
    const localProjects = await prisma.project.findMany({
      where: {
        userId,
        externalSource: "CLICKUP",
        externalId: { in: externalIds },
        status: "active",
      },
      select: { externalId: true },
    });

    const enabledListIds = new Set(
      localProjects.map((p) => p.externalId).filter(Boolean)
    );

    const annotatedLists = allLists.map((list) => ({
      ...list,
      enabled: enabledListIds.has(list.id),
    }));

    return NextResponse.json({ lists: annotatedLists });
  } catch (error) {
    if (error instanceof ClickUpApiError && error.status === 401) {
      return NextResponse.json(
        { error: "ClickUp token rejected" },
        { status: 401 }
      );
    }
    logger.error(
      "Failed to list ClickUp lists for space",
      { error: error instanceof Error ? error.message : String(error) },
      LOG_SOURCE
    );
    return NextResponse.json(
      { error: "Failed to list ClickUp lists" },
      { status: 500 }
    );
  }
}
