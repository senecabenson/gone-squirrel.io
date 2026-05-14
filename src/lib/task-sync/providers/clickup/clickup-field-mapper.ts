/**
 * ClickUp ↔ GoneSquirrel field mapper
 *
 * Pure functions only — no side effects, no Prisma calls.
 * All date operations convert between JS Date and ClickUp ms-epoch strings/numbers.
 */

import { EnergyLevel, Priority, TaskStatus, TimePreference } from "@/types/task";
import type { Task } from "@/types/task";

import type { ExternalTask } from "../task-provider.interface";
import type { PartialTaskWithSync } from "../../types";
import type {
  ClickUpCustomField,
  ClickUpStatus,
  ClickUpStatusMap,
  ClickUpTag,
  ClickUpTask,
  ClickUpTaskCreateBody,
} from "./types";

// ---------------------------------------------------------------------------
// Priority mapping
// ---------------------------------------------------------------------------

/**
 * Maps a GoneSquirrel Priority to ClickUp priority integer.
 * ClickUp: 1=Urgent, 2=High, 3=Normal, 4=Low, null=none
 * GS has no URGENT — HIGH maps to 2 (High), not 1.
 */
export function priorityToClickUp(
  p: Priority | null | undefined
): 1 | 2 | 3 | 4 | null {
  if (!p) return null;
  switch (p) {
    case Priority.HIGH:
      return 2;
    case Priority.MEDIUM:
      return 3;
    case Priority.LOW:
      return 4;
    case Priority.NONE:
    default:
      return null;
  }
}

/**
 * Maps a ClickUp priority integer to GoneSquirrel Priority enum.
 * 1=Urgent → HIGH (no URGENT in GS), 2=High → HIGH, 3=Normal → MEDIUM, 4=Low → LOW
 */
export function priorityFromClickUp(
  p: number | null | undefined
): Priority {
  if (p === null || p === undefined) return Priority.NONE;
  switch (p) {
    case 1: // Urgent — map down to HIGH (closest GS equivalent)
    case 2:
      return Priority.HIGH;
    case 3:
      return Priority.MEDIUM;
    case 4:
      return Priority.LOW;
    default:
      return Priority.NONE;
  }
}

// ---------------------------------------------------------------------------
// Date mapping
// ---------------------------------------------------------------------------

/**
 * Converts a JS Date to a ClickUp date payload.
 * Returns null if date is null/undefined.
 * Strips time when H, M, S are all zero (treat as date-only).
 */
export function dateToClickUp(
  d: Date | null | undefined
): { ms: number; hasTime: boolean } | null {
  if (!d) return null;
  // Use UTC time components so date-only Dates (canonicalized to UTC midnight
  // on pull) round-trip cleanly. Local-time getters would misclassify them.
  const hasTime =
    d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
  return { ms: d.getTime(), hasTime };
}

/**
 * Converts a ClickUp ms-epoch value and hasTime flag back to a JS Date.
 * Returns null if ms is null/undefined/empty.
 */
export function dateFromClickUp(
  ms: string | number | null | undefined,
  hasTime: boolean
): Date | null {
  if (ms === null || ms === undefined || ms === "") return null;
  const epoch = typeof ms === "string" ? parseInt(ms, 10) : ms;
  if (isNaN(epoch)) return null;
  const d = new Date(epoch);
  if (!hasTime) {
    // Zero out time components in UTC. ClickUp date-only values are sent as
    // noon UTC so they render as the same calendar day in any TZ; we
    // canonicalize to UTC midnight of that date.
    d.setUTCHours(0, 0, 0, 0);
  }
  return d;
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

/**
 * Maps a GoneSquirrel TaskStatus to a ClickUp status string using the list's
 * status map.
 *
 * Falls back to the first non-done status for todo/in_progress, first done-type
 * status for completed. Returns empty string if map is empty (caller should
 * omit the field in that case).
 */
export function statusToClickUp(
  localStatus: TaskStatus | string | null | undefined,
  listStatusMap: ClickUpStatusMap | undefined
): string {
  if (!listStatusMap) return "";

  const status = (localStatus ?? TaskStatus.TODO) as TaskStatus;

  switch (status) {
    case TaskStatus.COMPLETED: {
      if (listStatusMap.completed.length > 0) {
        return listStatusMap.completed[0];
      }
      // Fall back to first done-type status in the full list
      const doneStatus = listStatusMap.all.find(
        (s) => s.type === "closed" || s.type === "done"
      );
      return doneStatus?.status ?? "";
    }
    case TaskStatus.IN_PROGRESS: {
      if (listStatusMap.in_progress.length > 0) {
        return listStatusMap.in_progress[0];
      }
      // Fall back to first non-done status
      const activeStatus = listStatusMap.all.find(
        (s) => s.type !== "closed" && s.type !== "done"
      );
      return activeStatus?.status ?? "";
    }
    case TaskStatus.TODO:
    default: {
      if (listStatusMap.todo.length > 0) {
        return listStatusMap.todo[0];
      }
      const openStatus = listStatusMap.all.find((s) => s.type === "open");
      return openStatus?.status ?? "";
    }
  }
}

/**
 * Maps a ClickUp status object to a GoneSquirrel TaskStatus.
 * done-type → completed, in_progress/active → in_progress, everything else → todo
 */
export function statusFromClickUp(
  clickUpStatus: ClickUpStatus | undefined
): TaskStatus {
  if (!clickUpStatus) return TaskStatus.TODO;

  const type = clickUpStatus.type;
  if (type === "closed" || type === "done") {
    return TaskStatus.COMPLETED;
  }
  if (type === "in_progress" || type === "active" || type === "custom") {
    // For "custom" type, check the status name for in-progress indicators
    const name = clickUpStatus.status.toLowerCase();
    if (
      name.includes("progress") ||
      name.includes("active") ||
      name.includes("doing") ||
      name.includes("review") ||
      name.includes("blocked")
    ) {
      return TaskStatus.IN_PROGRESS;
    }
  }
  return TaskStatus.TODO;
}

/**
 * Build a ClickUpStatusMap from a raw list statuses array.
 * Used when first fetching a list to populate TaskListMapping.settings.statusMap.
 */
export function buildStatusMap(statuses: ClickUpStatus[]): ClickUpStatusMap {
  const todo: string[] = [];
  const in_progress: string[] = [];
  const completed: string[] = [];

  for (const s of statuses) {
    if (s.type === "closed" || s.type === "done") {
      completed.push(s.status);
    } else if (s.type === "in_progress" || s.type === "active") {
      in_progress.push(s.status);
    } else {
      // "open", "custom", or unknown → default to todo
      todo.push(s.status);
    }
  }

  return { todo, in_progress, completed, all: statuses };
}

// ---------------------------------------------------------------------------
// Tag mapping
// ---------------------------------------------------------------------------

/** Extracts tag names from GS Tag objects for writing to ClickUp task API. */
export function tagsToClickUp(tags: Array<{ name: string }>): string[] {
  return tags.map((t) => t.name);
}

/**
 * Converts ClickUp tag objects to GS-friendly shape with both color fields.
 * Returns objects matching the Tag row shape (name, bgColor, fgColor).
 */
export function tagsFromClickUp(
  ctags: ClickUpTag[]
): Array<{ name: string; bgColor: string; fgColor: string }> {
  return ctags.map((t) => ({
    name: t.name,
    bgColor: t.tag_bg,
    fgColor: t.tag_fg,
  }));
}

// ---------------------------------------------------------------------------
// Custom field helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the EnergyLevel value from a task's custom_fields array
 * by matching on the stored field ID.
 */
export function energyLevelFromCustomFields(
  customFields: ClickUpCustomField[] | undefined,
  fieldId: string | undefined
): EnergyLevel | null {
  if (!customFields || !fieldId) return null;
  const field = customFields.find((f) => f.id === fieldId);
  if (!field || field.value === null || field.value === undefined) return null;

  // ClickUp dropdown value may be the option name or its index
  const raw = String(field.value).toLowerCase();
  if (raw.includes("high")) return EnergyLevel.HIGH;
  if (raw.includes("medium")) return EnergyLevel.MEDIUM;
  if (raw.includes("low")) return EnergyLevel.LOW;
  return null;
}

/**
 * Extracts the TimePreference value from a task's custom_fields array
 * by matching on the stored field ID.
 */
export function timePreferenceFromCustomFields(
  customFields: ClickUpCustomField[] | undefined,
  fieldId: string | undefined
): TimePreference | null {
  if (!customFields || !fieldId) return null;
  const field = customFields.find((f) => f.id === fieldId);
  if (!field || field.value === null || field.value === undefined) return null;

  const raw = String(field.value).toLowerCase();
  if (raw.includes("morning")) return TimePreference.MORNING;
  if (raw.includes("afternoon")) return TimePreference.AFTERNOON;
  if (raw.includes("evening")) return TimePreference.EVENING;
  return null;
}

/** Converts EnergyLevel enum to the string value ClickUp expects. */
export function energyLevelToClickUp(e: EnergyLevel | null | undefined): string | null {
  if (!e) return null;
  switch (e) {
    case EnergyLevel.HIGH:
      return "High";
    case EnergyLevel.MEDIUM:
      return "Medium";
    case EnergyLevel.LOW:
      return "Low";
    default:
      return null;
  }
}

/** Converts TimePreference enum to the string value ClickUp expects. */
export function timePreferenceToClickUp(t: TimePreference | null | undefined): string | null {
  if (!t) return null;
  switch (t) {
    case TimePreference.MORNING:
      return "Morning";
    case TimePreference.AFTERNOON:
      return "Afternoon";
    case TimePreference.EVENING:
      return "Evening";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// ExternalTask / ClickUpTask mapping
// ---------------------------------------------------------------------------

/**
 * Maps a ClickUp task to the ExternalTask shape used by TaskSyncManager.
 *
 * Note: parentTaskId is NOT set here because resolving the ClickUp parent string ID
 * to a local Task.id requires a database lookup. The caller (ClickUpProvider) handles
 * that after mapping.
 */
export function mapExternalTaskToInternal(
  clickUpTask: ClickUpTask,
  projectId: string,
  listStatusMap: ClickUpStatusMap | undefined,
  energyFieldId?: string,
  preferredTimeFieldId?: string
): PartialTaskWithSync {
  const dueDate = dateFromClickUp(
    clickUpTask.due_date,
    clickUpTask.due_date_time ?? false
  );
  const startDate = dateFromClickUp(
    clickUpTask.start_date,
    clickUpTask.start_date_time ?? false
  );

  // Priority — ClickUp returns priority as an object on read
  const priorityInt =
    clickUpTask.priority != null
      ? parseInt(String(clickUpTask.priority.id ?? clickUpTask.priority), 10)
      : null;
  const priority = priorityFromClickUp(isNaN(priorityInt ?? NaN) ? null : priorityInt);

  const status = statusFromClickUp(clickUpTask.status);
  const completedAt =
    status === TaskStatus.COMPLETED && clickUpTask.date_closed
      ? dateFromClickUp(clickUpTask.date_closed, true)
      : null;

  const lastModified = clickUpTask.date_updated
    ? dateFromClickUp(clickUpTask.date_updated, true)
    : undefined;

  // GS-specific custom fields
  const energyLevel = energyLevelFromCustomFields(
    clickUpTask.custom_fields,
    energyFieldId
  );
  const preferredTime = timePreferenceFromCustomFields(
    clickUpTask.custom_fields,
    preferredTimeFieldId
  );

  return {
    title: clickUpTask.name,
    description: clickUpTask.description ?? null,
    status,
    priority,
    dueDate,
    startDate,
    completedAt,
    projectId,
    externalTaskId: clickUpTask.id,
    externalListId: clickUpTask.list?.id ?? "",
    source: "CLICKUP",
    isRecurring: false, // ClickUp v2 recurrence not exposed in API
    recurrenceRule: null,
    isAutoScheduled: false, // determined by TaskSyncManager based on mapping
    scheduleLocked: false,
    tags: [], // tags upserted separately via syncTagColors
    project: null,
    energyLevel,
    preferredTime,
    externalUpdatedAt: lastModified ?? undefined,
    externalCreatedAt: clickUpTask.date_created
      ? dateFromClickUp(clickUpTask.date_created, true) ?? undefined
      : undefined,
  };
}

/**
 * Maps a GoneSquirrel internal Task to a ClickUp task create body.
 *
 * Used for outbound task creation. Custom fields (energy, preferredTime)
 * are NOT included here — they are set via separate setCustomField calls
 * in ClickUpProvider.createTask / updateTask after the main task is created/updated.
 */
export function mapInternalToExternalCreate(
  task: Partial<Task>,
  listStatusMap: ClickUpStatusMap | undefined
): ClickUpTaskCreateBody {
  const dueDatePayload = dateToClickUp(task.dueDate ?? null);
  const startDatePayload = dateToClickUp(task.startDate ?? null);

  const body: ClickUpTaskCreateBody = {
    name: task.title ?? "Untitled",
    description: task.description ?? undefined,
    priority: priorityToClickUp(task.priority ?? null),
    due_date: dueDatePayload?.ms ?? null,
    due_date_time: dueDatePayload?.hasTime ?? false,
    start_date: startDatePayload?.ms ?? null,
    start_date_time: startDatePayload?.hasTime ?? false,
    tags: tagsToClickUp(task.tags ?? []),
    check_required_custom_fields: false,
  };

  if (task.status) {
    const statusStr = statusToClickUp(task.status, listStatusMap);
    if (statusStr) {
      body.status = statusStr;
    }
  }

  return body;
}

/**
 * Maps ClickUp task fields to an ExternalTask shape for TaskSyncManager compatibility.
 * This is the lightweight version used by getTasks() / getChanges().
 */
export function mapClickUpTaskToExternalTask(
  clickUpTask: ClickUpTask,
  listId: string
): ExternalTask {
  const dueDate = dateFromClickUp(
    clickUpTask.due_date,
    clickUpTask.due_date_time ?? false
  );
  const startDate = dateFromClickUp(
    clickUpTask.start_date,
    clickUpTask.start_date_time ?? false
  );
  const lastModified = clickUpTask.date_updated
    ? dateFromClickUp(clickUpTask.date_updated, true) ?? undefined
    : undefined;

  // Priority as a string for ExternalTask (interface expects string)
  const priorityInt =
    clickUpTask.priority != null
      ? parseInt(String(clickUpTask.priority.id ?? clickUpTask.priority), 10)
      : null;

  return {
    id: clickUpTask.id,
    title: clickUpTask.name,
    description: clickUpTask.description ?? null,
    status: clickUpTask.status?.status ?? "",
    priority: priorityInt !== null && !isNaN(priorityInt) ? String(priorityInt) : undefined,
    dueDate,
    startDate,
    listId,
    isRecurring: false,
    recurrenceRule: null,
    tags: (clickUpTask.tags ?? []).map((t) => t.name),
    lastModified,
    lastModifiedDateTime: lastModified?.toISOString(),
    url: clickUpTask.url,
    parentExternalId: clickUpTask.parent ?? null,
  };
}

/**
 * Builds the custom-field option lists for energy and preferredTime fields.
 * Used in ClickUpProvider.ensureCustomFields.
 */
export function buildEnergyFieldBody(): Record<string, unknown> {
  return {
    name: "GoneSquirrel Energy",
    type: "drop_down",
    type_config: {
      options: [
        { name: "High", orderindex: 0, color: "#f44336" },
        { name: "Medium", orderindex: 1, color: "#ff9800" },
        { name: "Low", orderindex: 2, color: "#4caf50" },
      ],
    },
  };
}

export function buildPreferredTimeFieldBody(): Record<string, unknown> {
  return {
    name: "GoneSquirrel Preferred Time",
    type: "drop_down",
    type_config: {
      options: [
        { name: "Morning", orderindex: 0, color: "#ffeb3b" },
        { name: "Afternoon", orderindex: 1, color: "#03a9f4" },
        { name: "Evening", orderindex: 2, color: "#9c27b0" },
      ],
    },
  };
}
