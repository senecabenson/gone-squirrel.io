import { Priority, TaskStatus } from "@/types/task";

import { FieldMapper } from "../field-mapper";
import { FieldMapping } from "../types";

/**
 * ClickUpFieldMapper
 *
 * Field mappings between internal task model and ClickUp REST API representations.
 * ClickUp uses ms-epoch UTC for dates (paired with date_time booleans) and
 * integer priority encoding (1=urgent, 2=high, 3=normal, 4=low, null=none).
 *
 * Status handling is delegated to the provider — ClickUp statuses are per-list
 * custom strings, so we cannot encode them statically here. The mapper falls
 * back to TaskStatus.TODO when no transform-time context is available.
 */
export class ClickUpFieldMapper extends FieldMapper {
  constructor() {
    const mappings: FieldMapping[] = [
      {
        internalField: "status",
        externalField: "status",
        preserveLocalValue: false,
        transformToExternal: (value: unknown) => {
          const s = value as TaskStatus | null | undefined;
          if (s === TaskStatus.COMPLETED) return "complete";
          if (s === TaskStatus.IN_PROGRESS) return "in progress";
          return "to do";
        },
        transformToInternal: (value: unknown) => {
          if (!value || typeof value !== "string") return TaskStatus.TODO;
          const v = value.toLowerCase();
          if (v === "complete" || v === "completed" || v === "closed" || v === "done") {
            return TaskStatus.COMPLETED;
          }
          if (v === "in progress" || v === "in_progress" || v === "active") {
            return TaskStatus.IN_PROGRESS;
          }
          return TaskStatus.TODO;
        },
      },
      {
        internalField: "dueDate",
        externalField: "dueDate",
        preserveLocalValue: true,
        transformToExternal: (value: unknown) => {
          if (!value) return null;
          return new Date(value as string | number | Date);
        },
        transformToInternal: (value: unknown) => {
          if (!value) return null;
          if (typeof value === "string") {
            const ms = Number(value);
            return Number.isNaN(ms) ? new Date(value) : new Date(ms);
          }
          return new Date(value as number | Date);
        },
      },
      {
        internalField: "startDate",
        externalField: "startDate",
        preserveLocalValue: true,
        transformToExternal: (value: unknown) => {
          if (!value) return null;
          return new Date(value as string | number | Date);
        },
        transformToInternal: (value: unknown) => {
          if (!value) return null;
          if (typeof value === "string") {
            const ms = Number(value);
            return Number.isNaN(ms) ? new Date(value) : new Date(ms);
          }
          return new Date(value as number | Date);
        },
      },
      {
        internalField: "completedAt",
        externalField: "completedDate",
        preserveLocalValue: true,
        transformToExternal: (value: unknown) => {
          if (!value) return null;
          return new Date(value as string | number | Date);
        },
        transformToInternal: (value: unknown) => {
          if (!value) return null;
          if (typeof value === "string") {
            const ms = Number(value);
            return Number.isNaN(ms) ? new Date(value) : new Date(ms);
          }
          return new Date(value as number | Date);
        },
      },
      {
        internalField: "priority",
        externalField: "priority",
        preserveLocalValue: false,
        transformToExternal: (value: unknown) => {
          const p = value as Priority | null | undefined;
          if (p === Priority.HIGH) return "2";
          if (p === Priority.MEDIUM) return "3";
          if (p === Priority.LOW) return "4";
          return null;
        },
        transformToInternal: (value: unknown) => {
          if (value === null || value === undefined) return Priority.NONE;
          const n = typeof value === "string" ? Number(value) : (value as number);
          if (n === 1 || n === 2) return Priority.HIGH;
          if (n === 3) return Priority.MEDIUM;
          if (n === 4) return Priority.LOW;
          return Priority.NONE;
        },
      },
    ];

    super(mappings);
  }
}
