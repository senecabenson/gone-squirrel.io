/**
 * One-off seed: connect ClickUp PAT, mirror Personal Space's smallest list,
 * run initial sync. Usage:
 *   tsx scripts/seed-clickup.ts                # auto-pick smallest list in Personal
 *   tsx scripts/seed-clickup.ts <listId>       # force a specific ClickUp list
 *
 * Reads CLICKUP_API_TOKEN from .env. Picks the single User row in DB.
 */
import { prisma } from "../src/lib/prisma";
import { TaskSyncManager } from "../src/lib/task-sync/task-sync-manager";

const PERSONAL_SPACE_ID = "90172707922";
const TOKEN = process.env.CLICKUP_API_TOKEN;
const FORCED_LIST_ID = process.argv[2];

async function clickUp<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    headers: { Authorization: TOKEN as string },
  });
  if (!res.ok) {
    throw new Error(`ClickUp ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

(async () => {
  if (!TOKEN) {
    console.error("CLICKUP_API_TOKEN missing from env");
    process.exit(1);
  }

  // 1. Pick the user (single-tenant assumption)
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  if (users.length !== 1) {
    console.error(`Expected 1 user, found ${users.length}. Pass userId via env.`);
    process.exit(1);
  }
  const user = users[0];
  console.log(`User: ${user.email} (${user.id})`);

  // 2. Upsert ConnectedAccount + TaskProvider
  const FAR_FUTURE = new Date("9999-12-31T00:00:00Z");
  const account = await prisma.connectedAccount.upsert({
    where: {
      userId_provider_email: {
        userId: user.id,
        provider: "CLICKUP",
        email: user.email ?? "clickup-pat",
      },
    },
    create: {
      provider: "CLICKUP",
      email: user.email ?? "clickup-pat",
      accessToken: TOKEN,
      expiresAt: FAR_FUTURE,
      userId: user.id,
    },
    update: { accessToken: TOKEN, expiresAt: FAR_FUTURE },
  });
  console.log(`ConnectedAccount: ${account.id}`);

  const provider = await prisma.taskProvider.upsert({
    where: { userId_type: { userId: user.id, type: "CLICKUP" } },
    create: {
      userId: user.id,
      type: "CLICKUP",
      name: "ClickUp",
      enabled: true,
      syncEnabled: true,
      accountId: account.id,
    },
    update: { accountId: account.id, enabled: true, syncEnabled: true },
  });
  console.log(`TaskProvider: ${provider.id}`);

  // 3. Pick a list — either forced or smallest folderless list in Personal
  type Space = { id: string; name: string; color: string | null };
  type List = { id: string; name: string; task_count: number; folder?: { id: string; name: string } };

  const space = await clickUp<Space>(`/space/${PERSONAL_SPACE_ID}`);
  console.log(`Space: ${space.name} (${space.id})`);

  let chosenList: List;
  if (FORCED_LIST_ID) {
    chosenList = await clickUp<List>(`/list/${FORCED_LIST_ID}`);
    console.log(`Using forced list: ${chosenList.name} (tasks: ${chosenList.task_count})`);
  } else {
    const { lists } = await clickUp<{ lists: List[] }>(
      `/space/${PERSONAL_SPACE_ID}/list?archived=false`
    );
    if (lists.length === 0) {
      console.error("No folderless lists in Personal space. Pass listId explicitly.");
      process.exit(1);
    }
    chosenList = lists.reduce((min, l) => (l.task_count < min.task_count ? l : min), lists[0]);
    console.log(`Auto-picked smallest list: ${chosenList.name} (tasks: ${chosenList.task_count})`);
  }

  // 4. Create local Workspace + Project + TaskListMapping
  const workspace = await prisma.workspace.upsert({
    where: {
      userId_externalId_externalSource: {
        userId: user.id,
        externalId: space.id,
        externalSource: "CLICKUP",
      },
    },
    create: {
      userId: user.id,
      name: space.name,
      color: space.color,
      externalId: space.id,
      externalSource: "CLICKUP",
      status: "active",
    },
    update: { name: space.name, color: space.color, status: "active" },
  });
  console.log(`Workspace: ${workspace.id}`);

  // Project has no unique constraint on externalId — find-or-create
  let project = await prisma.project.findFirst({
    where: {
      userId: user.id,
      externalId: chosenList.id,
      externalSource: "CLICKUP",
    },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        userId: user.id,
        name: chosenList.name,
        workspaceId: workspace.id,
        externalId: chosenList.id,
        externalSource: "CLICKUP",
        status: "active",
      },
    });
  } else {
    project = await prisma.project.update({
      where: { id: project.id },
      data: { name: chosenList.name, workspaceId: workspace.id, status: "active" },
    });
  }
  console.log(`Project: ${project.id}`);

  const mapping = await prisma.taskListMapping.upsert({
    where: { providerId_externalListId: { providerId: provider.id, externalListId: chosenList.id } },
    create: {
      providerId: provider.id,
      projectId: project.id,
      externalListId: chosenList.id,
      externalListName: chosenList.name,
      direction: "bidirectional",
      syncEnabled: true,
      isDefault: false,
      isAutoScheduled: false,
    },
    update: { externalListName: chosenList.name, syncEnabled: true },
  });
  console.log(`TaskListMapping: ${mapping.id}`);

  // 5. Run sync
  console.log("\n--- Running sync ---");
  const manager = new TaskSyncManager();
  const mappingWithProvider = await prisma.taskListMapping.findUnique({
    where: { id: mapping.id },
    include: { provider: true },
  });
  if (!mappingWithProvider) throw new Error("mapping lookup failed");
  const result = await manager.syncTaskList(mappingWithProvider);
  console.log("Sync result:", JSON.stringify(result, null, 2));

  // 6. Report
  const taskCount = await prisma.task.count({ where: { projectId: project.id } });
  console.log(`\nLocal tasks under project: ${taskCount}`);
  const tagCount = await prisma.tag.count({ where: { workspaceId: workspace.id } });
  console.log(`Local tags in workspace: ${tagCount}`);

  await prisma.$disconnect();
})().catch(async (err) => {
  console.error("\nFATAL:", err);
  await prisma.$disconnect();
  process.exit(1);
});
