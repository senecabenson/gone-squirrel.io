"use client";

import {
  PiArrowsClockwiseDuotone,
  PiCheckBold,
  PiClockDuotone,
  PiCloudCheckDuotone,
  PiDotsSixVerticalBold,
  PiLockSimpleDuotone,
  PiPencilSimpleDuotone,
  PiTrashDuotone,
  PiWarningDuotone,
} from "react-icons/pi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { celebrateTaskCompletion, originFromEvent } from "@/lib/celebrate";
import { format, isFutureDate, newDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

import { Task, TaskStatus } from "@/types/task";

import { useDraggableTask } from "../../dnd/useDragAndDrop";
import {
  formatEnumValue,
  statusBadgeVariant,
} from "../utils/task-list-utils";

interface TaskRowProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  // Kept for prop-shape parity with table-era TaskList; unused in flex layout.
  onInlineEdit?: (task: Task) => void;
}

function dueLabel(task: Task) {
  if (!task.dueDate) return null;
  const d = newDate(task.dueDate);
  const now = newDate();
  now.setHours(0, 0, 0, 0);
  const dayMs = 1000 * 60 * 60 * 24;
  const days = Math.floor((now.getTime() - d.getTime()) / dayMs);
  const overdue = days > 0;
  const oldOverdue = days >= 3;
  const text = format(d, "MMM d");
  return { text, overdue, oldOverdue };
}

export function TaskRow({
  task,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskRowProps) {
  const { draggableProps, isDragging } = useDraggableTask(task);
  const isFutureTask = task.startDate && isFutureDate(task.startDate);
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const isInProgress = task.status === TaskStatus.IN_PROGRESS;
  const due = dueLabel(task);

  return (
    <li
      className={cn(
        "group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-sunken/40",
        isInProgress &&
          "border-l-2 border-l-[hsl(var(--state-in-progress))] pl-[6px]",
        isCompleted && "opacity-60",
        isFutureTask && !isCompleted && "opacity-75",
        isDragging && "opacity-40"
      )}
    >
      {/* Drag handle */}
      <div
        className="cursor-grab text-ink-mute opacity-0 transition-opacity group-hover:opacity-100"
        {...draggableProps}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <PiDotsSixVerticalBold className="h-4 w-4" />
      </div>

      {/* Mark-done check */}
      <button
        type="button"
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
          isCompleted
            ? "border-[hsl(var(--state-complete))] bg-[hsl(var(--state-complete)/0.2)] text-[hsl(var(--state-complete))]"
            : "border-[hsl(var(--border-default))] text-transparent hover:border-[hsl(var(--state-complete))] hover:text-[hsl(var(--state-complete))]"
        )}
        onClick={(e) => {
          e.stopPropagation();
          const becomingComplete = !isCompleted;
          onStatusChange(
            task.id,
            becomingComplete ? TaskStatus.COMPLETED : TaskStatus.TODO
          );
          if (becomingComplete) {
            celebrateTaskCompletion({ origin: originFromEvent(e) });
          }
        }}
        title={isCompleted ? "Mark as todo" : "Mark as done"}
        aria-label={isCompleted ? "Mark as todo" : "Mark as done"}
      >
        <PiCheckBold className="h-3.5 w-3.5" />
      </button>

      {/* Title + inline indicators (clickable to edit) */}
      <button
        type="button"
        onClick={() => onEdit(task)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span
          className={cn(
            "task-title truncate text-body-sm font-medium text-ink",
            isCompleted && "line-clamp-1"
          )}
        >
          {task.title}
        </span>
        {task.isRecurring && (
          <PiArrowsClockwiseDuotone
            className="h-3.5 w-3.5 shrink-0 text-ink-mute"
            title="Recurring"
          />
        )}
        {task.isAutoScheduled && (
          <PiClockDuotone
            className="h-3.5 w-3.5 shrink-0 text-action"
            title="Auto-scheduled"
          />
        )}
        {task.scheduleLocked && (
          <PiLockSimpleDuotone
            className="h-3.5 w-3.5 shrink-0 text-ink-mute"
            title="Schedule locked"
          />
        )}
        {task.externalTaskId && (
          <PiCloudCheckDuotone
            className="h-3.5 w-3.5 shrink-0 text-ink-mute"
            title={`Synced from ${task.source}`}
          />
        )}
      </button>

      {/* Meta cluster — width controlled by --meta-w var (resizable) */}
      <div
        className="hidden items-center overflow-hidden text-meta uppercase tracking-wide text-ink-mute md:flex"
        style={{ width: "var(--meta-w, 540px)", flexShrink: 0 }}
      >
        {/* Status */}
        <div className="flex-1 min-w-0 px-2">
          <Badge
            variant={
              statusBadgeVariant(
                task.status
              ) as React.ComponentProps<typeof Badge>["variant"]
            }
          >
            {formatEnumValue(task.status)}
          </Badge>
        </div>

        {/* Energy — lg+ */}
        <div className="hidden flex-1 min-w-0 px-2 lg:block">
          <span className="truncate">
            {task.energyLevel ? formatEnumValue(task.energyLevel) : "—"}
          </span>
        </div>

        {/* Time pref — xl+ */}
        <div className="hidden flex-1 min-w-0 px-2 xl:block">
          <span className="truncate">
            {task.preferredTime ? formatEnumValue(task.preferredTime) : "—"}
          </span>
        </div>

        {/* Duration */}
        <div className="flex-1 min-w-0 px-2 font-mono normal-case tracking-normal text-[11px] text-ink-mute">
          {task.duration ? `${task.duration}m` : "—"}
        </div>

        {/* Due */}
        <div className="flex-1 min-w-0 px-2 font-mono normal-case tracking-normal text-[11px]">
          {due ? (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                due.overdue && !due.oldOverdue
                  ? "text-[hsl(var(--urgency-now))]"
                  : due.oldOverdue
                    ? "text-[hsl(var(--urgency-overdue-soft))]"
                    : "text-ink-mute"
              )}
              title={due.overdue ? `Overdue ${due.text}` : `Due ${due.text}`}
            >
              {due.overdue && (
                <PiWarningDuotone className="h-3 w-3" aria-hidden="true" />
              )}
              {due.text}
            </span>
          ) : (
            <span className="text-ink-mute">—</span>
          )}
        </div>

        {/* Schedule — xl+ */}
        <div className="hidden flex-1 min-w-0 px-2 font-mono normal-case tracking-normal text-[11px] xl:block">
          {task.isAutoScheduled && task.scheduledStart && task.scheduledEnd ? (
            <span className="text-action truncate">
              {format(newDate(task.scheduledStart), "p")}
            </span>
          ) : (
            <span className="text-ink-mute">—</span>
          )}
        </div>

        {/* Project */}
        <div className="flex-1 min-w-0 px-2 normal-case tracking-normal text-[11px] text-ink-soft">
          {task.project ? (
            <span className="inline-flex w-full items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    task.project.color || "hsl(var(--text-tertiary))",
                }}
              />
              <span className="project-name truncate">
                {task.project.name}
              </span>
            </span>
          ) : (
            <span className="text-ink-mute">—</span>
          )}
        </div>
      </div>

      {/* Mobile compact meta — collapsed to project dot + due only */}
      <div className="flex shrink-0 items-center gap-2 md:hidden">
        {due && (
          <span
            className={cn(
              "font-mono text-[10px]",
              due.overdue && !due.oldOverdue
                ? "text-[hsl(var(--urgency-now))]"
                : "text-ink-mute"
            )}
          >
            {due.text}
          </span>
        )}
        {task.project && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                task.project.color || "hsl(var(--text-tertiary))",
            }}
          />
        )}
      </div>

      {/* Actions — hover reveal */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-ink-mute"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          title="Edit"
          aria-label="Edit task"
        >
          <PiPencilSimpleDuotone className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-ink-mute hover:text-[hsl(var(--urgency-now))]"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          title="Delete"
          aria-label="Delete task"
        >
          <PiTrashDuotone className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
