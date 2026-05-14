/**
 * ClickUpProvider
 *
 * Implements TaskProviderInterface for ClickUp v2 REST API.
 *
 * Constructor accepts:
 *   - token: personal API token
 *   - taskProvider: the TaskProvider Prisma row (for settings / accountId)
 *   - prisma: PrismaClient instance (injected for custom-field persistence + tag sync)
 *
 * Per-list settings storage:
 *   TaskListMapping has no "settings" column in the current schema.
 *   Per-list data (statusMap, customFieldIds) is stored in
 *   TaskProvider.settings.lists[listId] — a nested JSON map.
 *
 * Tag color sync decision:
 *   syncTagColors is called inside mapClickUpTaskFull as a side-effect step
 *   rather than a separate orchestration pass. This keeps the sync logic
 *   self-contained: each full task pull automatically keeps colors current.
 */

import { Prisma, PrismaClient, TaskProvider as DbTaskProvider } from "@prisma/client";

import { logger } from "@/lib/logger";
import { EnergyLevel, Priority, Task, TaskStatus, TimePreference } from "@/types/task";

import type { PartialTaskWithSync } from "../../types";
import {
  ExternalTask,
  ExternalTaskList,
  SyncOptions,
  TaskChange,
  TaskProviderInterface,
  TaskToCreate,
  TaskUpdates,
} from "../task-provider.interface";
import {
  ClickUpApiError,
  ClickUpClient,
} from "./clickup-client";
import {
  buildEnergyFieldBody,
  buildPreferredTimeFieldBody,
  buildStatusMap,
  energyLevelToClickUp,
  mapClickUpTaskToExternalTask,
  mapExternalTaskToInternal,
  mapInternalToExternalCreate,
  priorityFromClickUp,
  priorityToClickUp,
  statusToClickUp,
  tagsFromClickUp,
  tagsToClickUp,
  timePreferenceToClickUp,
} from "./clickup-field-mapper";
import type {
  ClickUpList,
  ClickUpListMappingSettings,
  ClickUpStatusMap,
  ClickUpTask,
  ClickUpTaskUpdateBody,
} from "./types";

const LOG_SOURCE = "ClickUpProvider";

// ---------------------------------------------------------------------------
// Settings shape stored in TaskProvider.settings
// ---------------------------------------------------------------------------

interface ClickUpProviderSettings {
  /** Team/workspace IDs this token has access to */
  teamIds?: string[];
  /**
   * Per-list settings keyed by ClickUp list ID.
   * Stores statusMap and customFieldIds for each synced list.
   */
  lists?: Record<string, ClickUpListMappingSettings>;
}

// ---------------------------------------------------------------------------
// ClickUpProvider
// ---------------------------------------------------------------------------

export class ClickUpProvider implements TaskProviderInterface {
  private readonly client: ClickUpClient;
  private taskProvider: DbTaskProvider;
  private readonly prisma: PrismaClient;

  constructor(
    token: string,
    taskProvider: DbTaskProvider,
    prisma: PrismaClient
  ) {
    this.client = new ClickUpClient(token);
    this.taskProvider = taskProvider;
    this.prisma = prisma;
  }

  // -------------------------------------------------------------------------
  // TaskProviderInterface identity
  // -------------------------------------------------------------------------

  getType(): string {
    return "CLICKUP";
  }

  getName(): string {
    return "ClickUp";
  }

  // -------------------------------------------------------------------------
  // getTaskLists
  // -------------------------------------------------------------------------

  /**
   * Returns all ClickUp Lists the token can see, flattened from all Teams →
   * Spaces → Folders → Lists and Spaces → FolderlessLists.
   *
   * ExternalTaskList mapping:
   *   id       = ClickUp list ID
   *   name     = List name
   *   path     = "Space > List" or "Space > Folder > List"
   *   parentId = Space ID (closest GS equivalent of workspace)
   *   isDefault = false (ClickUp has no default list concept)
   */
  async getTaskLists(): Promise<ExternalTaskList[]> {
    try {
      const teams = await this.client.getTeams();
      const results: ExternalTaskList[] = [];

      for (const team of teams) {
        const spaces = await this.client.getSpaces(team.id);

        for (const space of spaces) {
          // Folderless lists
          const folderlessLists = await this.client.getFolderlessLists(space.id);
          for (const list of folderlessLists) {
            results.push({
              id: list.id,
              name: list.name,
              path: `${space.name} > ${list.name}`,
              parentId: space.id,
              isDefault: false,
            });
          }

          // Folder-nested lists
          const folders = await this.client.getFolders(space.id);
          for (const folder of folders) {
            const folderLists = await this.client.getListsInFolder(folder.id);
            for (const list of folderLists) {
              results.push({
                id: list.id,
                name: list.name,
                path: `${space.name} > ${folder.name} > ${list.name}`,
                parentId: space.id,
                isDefault: false,
              });
            }
          }
        }
      }

      return results;
    } catch (error) {
      logger.error(
        "Failed to get task lists from ClickUp",
        { error: error instanceof Error ? error.message : "Unknown error" },
        LOG_SOURCE
      );
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // getTasks
  // -------------------------------------------------------------------------

  async getTasks(
    listId: string,
    options?: SyncOptions
  ): Promise<ExternalTask[]> {
    try {
      const opts: { date_updated_gt?: number; include_closed?: boolean } = {};

      if (options?.since) {
        opts.date_updated_gt = options.since.getTime();
      }
      if (options?.includeCompleted === false) {
        opts.include_closed = false;
      }

      const tasks = await this.client.getTasksInList(listId, opts);
      return tasks.map((t) => mapClickUpTaskToExternalTask(t, listId));
    } catch (error) {
      logger.error(
        "Failed to get tasks from ClickUp list",
        {
          error: error instanceof Error ? error.message : "Unknown error",
          listId,
        },
        LOG_SOURCE
      );
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // createTask
  // -------------------------------------------------------------------------

  /**
   * Creates a task in ClickUp.
   *
   * If `task.metadata` carries `energyLevel` or `preferredTime`, this method
   * calls ensureCustomFields + setCustomField after the main create. The caller
   * (TaskSyncManager) should pass these via task metadata to have them synced.
   * They are not part of the base TaskToCreate interface, so we read them from
   * metadata to remain interface-compatible.
   */
  async createTask(
    listId: string,
    task: TaskToCreate
  ): Promise<ExternalTask> {
    try {
      const statusMap = await this.getStatusMapForList(listId);
      const body = mapInternalToExternalCreate(
        {
          title: task.title,
          description: task.description,
          status: task.status ? (task.status as TaskStatus) : undefined,
          priority: task.priority as Priority | null | undefined,
          dueDate: task.dueDate,
          startDate: task.startDate,
          tags: [],
        },
        statusMap ?? undefined
      );

      const created = await this.client.createTask(listId, body);

      // Custom fields (best-effort)
      const meta = (task as TaskToCreate & { metadata?: Record<string, unknown> }).metadata;
      if (meta) {
        await this.pushCustomFields(created.id, listId, meta);
      }

      return mapClickUpTaskToExternalTask(created, listId);
    } catch (error) {
      logger.error(
        "Failed to create task in ClickUp",
        {
          error: error instanceof Error ? error.message : "Unknown error",
          listId,
          title: task.title,
        },
        LOG_SOURCE
      );
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // updateTask
  // -------------------------------------------------------------------------

  async updateTask(
    listId: string,
    taskId: string,
    updates: TaskUpdates
  ): Promise<ExternalTask> {
    try {
      const statusMap = await this.getStatusMapForList(listId);

      const body: ClickUpTaskUpdateBody = {};

      if (updates.title !== undefined) body.name = updates.title;
      if (updates.description !== undefined) {
        body.description = updates.description ?? undefined;
      }

      if (updates.priority !== undefined) {
        body.priority = priorityToClickUp(
          updates.priority as Priority | null
        );
      }

      if (updates.status !== undefined) {
        const statusStr = statusToClickUp(updates.status, statusMap ?? undefined);
        if (statusStr) {
          body.status = statusStr;
        }
        // ClickUp handles completion via status change — no separate completedDateTime field
      }

      if (updates.dueDate !== undefined) {
        const d = updates.dueDate
          ? { ms: updates.dueDate.getTime(), hasTime: updates.dueDate.getHours() !== 0 }
          : null;
        body.due_date = d?.ms ?? null;
        body.due_date_time = d?.hasTime ?? false;
      }

      if (updates.startDate !== undefined) {
        const d = updates.startDate
          ? { ms: updates.startDate.getTime(), hasTime: updates.startDate.getHours() !== 0 }
          : null;
        body.start_date = d?.ms ?? null;
        body.start_date_time = d?.hasTime ?? false;
      }

      // Assignees: passed via metadata as { add: number[], rem: number[] }
      const meta = updates.metadata;
      if (meta?.assignees && typeof meta.assignees === "object") {
        const assignees = meta.assignees as { add?: number[]; rem?: number[] };
        body.assignees = assignees;
      }

      const updated = await this.client.updateTask(taskId, body);

      // Custom fields (best-effort)
      if (meta) {
        await this.pushCustomFields(taskId, listId, meta as Record<string, unknown>);
      }

      return mapClickUpTaskToExternalTask(updated, listId);
    } catch (error) {
      logger.error(
        "Failed to update task in ClickUp",
        {
          error: error instanceof Error ? error.message : "Unknown error",
          listId,
          taskId,
        },
        LOG_SOURCE
      );
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // deleteTask
  // -------------------------------------------------------------------------

  async deleteTask(listId: string, taskId: string): Promise<void> {
    try {
      await this.client.deleteTask(taskId);
      logger.info(
        `Deleted ClickUp task ${taskId} from list ${listId}`,
        { taskId, listId },
        LOG_SOURCE
      );
    } catch (error) {
      logger.error(
        "Failed to delete task in ClickUp",
        {
          error: error instanceof Error ? error.message : "Unknown error",
          listId,
          taskId,
        },
        LOG_SOURCE
      );
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // getChanges
  // -------------------------------------------------------------------------

  /**
   * Returns tasks updated since `since` as TaskChange objects (all type=UPDATE).
   * We cannot distinguish CREATE vs UPDATE from the tasks endpoint alone —
   * the caller should treat all as potential upserts.
   */
  async getChanges(listId: string, since?: Date): Promise<TaskChange[]> {
    try {
      const opts: { date_updated_gt?: number } = {};
      if (since) {
        opts.date_updated_gt = since.getTime();
      }

      const tasks = await this.client.getTasksInList(listId, opts);
      const changes: TaskChange[] = [];

      for (const task of tasks) {
        const lastModified = task.date_updated
          ? new Date(
              typeof task.date_updated === "string"
                ? parseInt(task.date_updated, 10)
                : task.date_updated
            )
          : new Date();

        changes.push({
          id: `clickup-change-${task.id}-${lastModified.getTime()}`,
          taskId: "",
          listId,
          type: "UPDATE",
          timestamp: lastModified,
          changes: {
            externalTaskId: task.id,
            externalTask: task as unknown as Record<string, unknown>,
          },
        });
      }

      return changes;
    } catch (error) {
      logger.error(
        "Failed to get changes from ClickUp",
        {
          error: error instanceof Error ? error.message : "Unknown error",
          listId,
          since: since ? since.toISOString() : null,
        },
        LOG_SOURCE
      );
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // validateConnection
  // -------------------------------------------------------------------------

  async validateConnection(): Promise<boolean> {
    try {
      await this.client.getTeams();
      return true;
    } catch (error) {
      if (error instanceof ClickUpApiError && error.status === 401) {
        logger.warn(
          "ClickUp connection validation failed — 401 Unauthorized",
          {},
          LOG_SOURCE
        );
        return false;
      }
      logger.error(
        "ClickUp connection validation error",
        { error: error instanceof Error ? error.message : "Unknown error" },
        LOG_SOURCE
      );
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // mapToInternalTask
  // -------------------------------------------------------------------------

  /**
   * Maps an ExternalTask (from getTasks/getChanges) to a PartialTaskWithSync.
   *
   * This lightweight version works from ExternalTask shape (no color data).
   * For full mapping with custom-field and tag-color support, use mapClickUpTaskFull.
   */
  mapToInternalTask(externalTask: ExternalTask, projectId: string): PartialTaskWithSync {
    return {
      title: externalTask.title,
      description: externalTask.description ?? null,
      status: this.mapStatusFromExternal(externalTask.status),
      priority: this.mapPriorityFromExternal(externalTask.priority),
      dueDate: externalTask.dueDate ?? null,
      startDate: externalTask.startDate ?? null,
      completedAt: externalTask.completedDate ?? null,
      projectId,
      externalTaskId: externalTask.id,
      externalListId: externalTask.listId,
      source: this.getType(),
      isRecurring: false,
      recurrenceRule: null,
      isAutoScheduled: false,
      scheduleLocked: false,
      tags: [],
      project: null,
      energyLevel: null,
      preferredTime: null,
    };
  }

  /**
   * Full mapping from a raw ClickUpTask object (used internally when we have
   * the full API response with custom_fields, tag colors, etc.).
   *
   * Calls syncTagColors as a side effect to keep Tag rows current.
   */
  async mapClickUpTaskFull(
    clickUpTask: ClickUpTask,
    projectId: string,
    listId: string,
    userId: string,
    workspaceId: string | null
  ): Promise<PartialTaskWithSync> {
    const listSettings = this.getListSettings(listId);
    const statusMap = listSettings?.statusMap ?? undefined;
    const energyFieldId = listSettings?.customFieldIds?.energy;
    const preferredTimeFieldId = listSettings?.customFieldIds?.preferredTime;

    const mapped = mapExternalTaskToInternal(
      clickUpTask,
      projectId,
      statusMap,
      energyFieldId,
      preferredTimeFieldId
    );

    // Sync tag colors as side effect
    if (clickUpTask.tags && clickUpTask.tags.length > 0) {
      const tagColors = tagsFromClickUp(clickUpTask.tags);
      await this.syncTagColors(userId, workspaceId, tagColors);
    }

    return mapped;
  }

  // -------------------------------------------------------------------------
  // mapToExternalTask
  // -------------------------------------------------------------------------

  mapToExternalTask(task: Partial<Task>): TaskToCreate {
    return {
      title: task.title ?? "",
      description: task.description ?? null,
      status: task.status ?? null,
      priority: task.priority ?? null,
      dueDate: task.dueDate ?? null,
      startDate: task.startDate ?? null,
      recurrenceRule: null, // ClickUp v2 doesn't support RRULE sync
    };
  }

  // -------------------------------------------------------------------------
  // Phase 1.5 — Custom fields (ensureCustomFields)
  // -------------------------------------------------------------------------

  /**
   * Ensures the GoneSquirrel Energy and GoneSquirrel Preferred Time custom
   * fields exist on the given ClickUp list.
   *
   * Reads TaskProvider.settings.lists[listId].customFieldIds for cached IDs.
   * If missing, attempts to create them via ClickUp API (may fail on Free plan).
   * On any error, logs a warning and returns nulls (graceful degradation).
   * On success, persists the IDs back to TaskProvider.settings.
   *
   * Returns the field IDs (null if unavailable).
   */
  async ensureCustomFields(
    listId: string
  ): Promise<{ energy: string | null; preferredTime: string | null }> {
    const existing = this.getListSettings(listId)?.customFieldIds ?? {};
    let energyId: string | null = existing.energy ?? null;
    let preferredTimeId: string | null = existing.preferredTime ?? null;

    if (!energyId) {
      try {
        const result = await this.client.createCustomField(
          listId,
          buildEnergyFieldBody()
        );
        energyId = result?.id ?? null;
      } catch (err) {
        logger.warn(
          "Failed to create GoneSquirrel Energy custom field",
          { listId, error: err instanceof Error ? err.message : "Unknown" },
          LOG_SOURCE
        );
      }
    }

    if (!preferredTimeId) {
      try {
        const result = await this.client.createCustomField(
          listId,
          buildPreferredTimeFieldBody()
        );
        preferredTimeId = result?.id ?? null;
      } catch (err) {
        logger.warn(
          "Failed to create GoneSquirrel Preferred Time custom field",
          { listId, error: err instanceof Error ? err.message : "Unknown" },
          LOG_SOURCE
        );
      }
    }

    // Persist back to DB if we have new values
    if (
      (energyId && energyId !== existing.energy) ||
      (preferredTimeId && preferredTimeId !== existing.preferredTime)
    ) {
      await this.updateListSettings(listId, {
        customFieldIds: {
          ...existing,
          ...(energyId ? { energy: energyId } : {}),
          ...(preferredTimeId ? { preferredTime: preferredTimeId } : {}),
        },
      });
    }

    return { energy: energyId, preferredTime: preferredTimeId };
  }

  // -------------------------------------------------------------------------
  // Phase 1.6 — Tag color sync (syncTagColors)
  // -------------------------------------------------------------------------

  /**
   * Upserts Tag rows in local DB with ClickUp bgColor/fgColor values.
   * Keyed on [name, userId, workspaceId].
   *
   * Called as a side effect from mapClickUpTaskFull. Any DB error is caught
   * and logged — tag color sync failure should never break the main sync.
   *
   * Note: The Prisma unique constraint is `name_userId_workspaceId`.
   * When workspaceId is null, we use an empty string key to avoid issues
   * with the composite unique index.
   */
  async syncTagColors(
    userId: string,
    workspaceId: string | null,
    tags: Array<{ name: string; bgColor: string; fgColor: string }>
  ): Promise<void> {
    for (const tag of tags) {
      try {
        await this.prisma.tag.upsert({
          where: {
            name_userId_workspaceId: {
              name: tag.name,
              userId,
              workspaceId: workspaceId ?? "",
            },
          },
          create: {
            name: tag.name,
            color: tag.bgColor,
            fgColor: tag.fgColor,
            userId,
            workspaceId: workspaceId ?? null,
            externalSource: "CLICKUP",
          },
          update: {
            color: tag.bgColor,
            fgColor: tag.fgColor,
          },
        });
      } catch (err) {
        logger.warn(
          "syncTagColors: failed to upsert tag",
          {
            tagName: tag.name,
            userId,
            workspaceId: workspaceId ?? null,
            error: err instanceof Error ? err.message : "Unknown",
          },
          LOG_SOURCE
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Reads per-list settings from TaskProvider.settings.lists[listId] */
  private getListSettings(listId: string): ClickUpListMappingSettings | null {
    const providerSettings = this.parseProviderSettings();
    return providerSettings.lists?.[listId] ?? null;
  }

  /**
   * Merges and persists per-list settings back to TaskProvider.settings.
   * Updates the in-memory taskProvider to stay in sync with the DB.
   */
  private async updateListSettings(
    listId: string,
    patch: Partial<ClickUpListMappingSettings>
  ): Promise<void> {
    try {
      const providerSettings = this.parseProviderSettings();
      const current = providerSettings.lists?.[listId] ?? {};
      const updated: ClickUpProviderSettings = {
        ...providerSettings,
        lists: {
          ...(providerSettings.lists ?? {}),
          [listId]: { ...current, ...patch },
        },
      };

      const saved = await this.prisma.taskProvider.update({
        where: { id: this.taskProvider.id },
        data: { settings: updated as Prisma.InputJsonValue },
      });

      this.taskProvider = saved;
    } catch (err) {
      logger.warn(
        "Failed to persist list settings to TaskProvider",
        { listId, error: err instanceof Error ? err.message : "Unknown" },
        LOG_SOURCE
      );
    }
  }

  /**
   * Returns the ClickUpStatusMap for a list.
   * Looks up TaskProvider.settings.lists[listId].statusMap first; falls back to
   * fetching the list from ClickUp and building + persisting the map.
   */
  private async getStatusMapForList(
    listId: string
  ): Promise<ClickUpStatusMap | null> {
    const existing = this.getListSettings(listId)?.statusMap;
    if (existing) return existing;

    // Fetch from ClickUp and cache
    try {
      const list: ClickUpList = await this.client.getList(listId);
      const statuses = list.statuses ?? [];
      const statusMap = buildStatusMap(statuses);
      await this.updateListSettings(listId, { statusMap });
      return statusMap;
    } catch (err) {
      logger.warn(
        "Could not fetch ClickUp list statuses",
        { listId, error: err instanceof Error ? err.message : "Unknown" },
        LOG_SOURCE
      );
      return null;
    }
  }

  /**
   * Safely parses TaskProvider.settings JSON into typed shape.
   */
  private parseProviderSettings(): ClickUpProviderSettings {
    const s = this.taskProvider.settings;
    if (!s || typeof s !== "object" || Array.isArray(s)) return {};
    return s as ClickUpProviderSettings;
  }

  /**
   * Push energyLevel and preferredTime custom fields after a task create/update.
   * No-ops if the relevant field IDs aren't available.
   */
  private async pushCustomFields(
    taskId: string,
    listId: string,
    meta: Record<string, unknown>
  ): Promise<void> {
    if (!meta.energyLevel && !meta.preferredTime) return;

    let fieldIds: { energy: string | null; preferredTime: string | null };
    try {
      fieldIds = await this.ensureCustomFields(listId);
    } catch {
      return; // ensureCustomFields already logs
    }

    if (meta.energyLevel && fieldIds.energy) {
      const val = energyLevelToClickUp(meta.energyLevel as EnergyLevel);
      if (val) {
        try {
          await this.client.setCustomField(taskId, fieldIds.energy, val);
        } catch (err) {
          logger.warn(
            "Failed to set energy custom field",
            { taskId, error: err instanceof Error ? err.message : "Unknown" },
            LOG_SOURCE
          );
        }
      }
    }

    if (meta.preferredTime && fieldIds.preferredTime) {
      const val = timePreferenceToClickUp(meta.preferredTime as TimePreference);
      if (val) {
        try {
          await this.client.setCustomField(taskId, fieldIds.preferredTime, val);
        } catch (err) {
          logger.warn(
            "Failed to set preferredTime custom field",
            { taskId, error: err instanceof Error ? err.message : "Unknown" },
            LOG_SOURCE
          );
        }
      }
    }
  }

  /** Maps a priority string (from ExternalTask) back to GS Priority. */
  private mapPriorityFromExternal(priority: string | undefined): Priority {
    if (!priority) return Priority.NONE;
    const n = parseInt(priority, 10);
    return isNaN(n) ? Priority.NONE : priorityFromClickUp(n);
  }

  /** Maps a status string from ExternalTask back to GS TaskStatus. */
  private mapStatusFromExternal(status: string | undefined): TaskStatus {
    if (!status) return TaskStatus.TODO;
    const lower = status.toLowerCase();
    if (
      lower === "complete" ||
      lower === "done" ||
      lower === "closed" ||
      lower === "completed"
    ) {
      return TaskStatus.COMPLETED;
    }
    if (
      lower.includes("progress") ||
      lower.includes("active") ||
      lower.includes("doing") ||
      lower.includes("review") ||
      lower.includes("blocked")
    ) {
      return TaskStatus.IN_PROGRESS;
    }
    return TaskStatus.TODO;
  }

  /** Expose provider settings for use by external callers (e.g. API routes) */
  getProviderSettings(): ClickUpProviderSettings {
    return this.parseProviderSettings();
  }
}

// Keep these imports alive so they don't get tree-shaken by the type-checker
// (they're used by callers of mapClickUpTaskFull indirectly)
export { tagsToClickUp, tagsFromClickUp };
