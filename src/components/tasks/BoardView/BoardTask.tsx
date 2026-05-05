"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  PiClockDuotone,
  PiLockSimpleDuotone,
  PiPencilSimpleDuotone,
  PiTrashDuotone,
  PiWarningDuotone,
} from "react-icons/pi";

import { Badge } from "@/components/ui/badge";

import {
  format,
  isFutureDate,
  isThisWeek,
  isThisYear,
  isToday,
  isTomorrow,
  newDate,
  newDateFromYMD,
} from "@/lib/date-utils";
import { cn } from "@/lib/utils";

import { Task, TaskStatus, TimePreference } from "@/types/task";

interface BoardTaskProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

// Energy → state-in-progress style accent (calm blue), admin → mustard tone, low → sage.
// Anchored to the design system energy palette. Soft variant 90% of time.
const energyVariant: Record<string, React.ComponentProps<typeof Badge>["variant"]> = {
  high: "urgency-soon",
  medium: "default",
  low: "state-complete",
};

const timeVariant: Record<TimePreference, React.ComponentProps<typeof Badge>["variant"]> = {
  [TimePreference.MORNING]: "dom-dust",
  [TimePreference.AFTERNOON]: "dom-mustard",
  [TimePreference.EVENING]: "dom-plum",
};

const formatEnumValue = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

interface DueDateInfo {
  text: string;
  isOverdue: boolean;
  isOldOverdue: boolean;
  isFuture: boolean;
}

const formatContextualDate = (date: Date): DueDateInfo => {
  const localDate = newDateFromYMD(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  const now = newDate();
  now.setHours(0, 0, 0, 0);

  const dayMs = 1000 * 60 * 60 * 24;
  const daysOverdue = Math.floor((now.getTime() - localDate.getTime()) / dayMs);
  const isOverdue = daysOverdue > 0;
  // Decay rule: after 3 days, soften to dignified amber rather than escalate.
  const isOldOverdue = daysOverdue >= 3;
  const isFuture = isFutureDate(localDate);

  let text = "";
  if (isToday(localDate)) text = "Today";
  else if (isTomorrow(localDate)) text = "Tomorrow";
  else if (isThisWeek(localDate)) text = format(localDate, "EEEE");
  else if (isThisYear(localDate)) text = format(localDate, "MMM d");
  else text = format(localDate, "MMM d, yyyy");

  return { text, isOverdue, isOldOverdue, isFuture };
};

export function BoardTask({ task, onEdit, onDelete }: BoardTaskProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { type: "task", task },
    });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const isInProgress = task.status === TaskStatus.IN_PROGRESS;
  const isCompleted = task.status === TaskStatus.COMPLETED;
  const due = task.dueDate
    ? formatContextualDate(newDate(task.dueDate))
    : null;

  return (
    <div className="group relative">
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={style}
        className={cn(
          "cursor-grab rounded-xl border border-[hsl(var(--border-subtle))] bg-surface text-ink shadow-card transition-shadow",
          "hover:shadow-raised",
          isInProgress &&
            "border-l-2 border-l-[hsl(var(--state-in-progress))]",
          isCompleted && "opacity-60",
          isDragging && "opacity-40"
        )}
      >
        <div className="flex flex-col gap-1.5 p-3">
          {/* Row 1 — title + project dot */}
          <div className="flex items-start gap-2">
            <h3 className="task-title flex-1 text-body-sm font-medium leading-snug text-ink">
              {task.title}
            </h3>
            {task.project && (
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    task.project.color || "hsl(var(--text-tertiary))",
                }}
                aria-label={`Project: ${task.project.name}`}
                title={task.project.name}
              />
            )}
          </div>

          {/* Row 2 — single meta line */}
          {(due ||
            task.duration ||
            task.energyLevel ||
            task.preferredTime ||
            task.isAutoScheduled) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta uppercase tracking-wide text-ink-mute">
              {due && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    due.isOverdue && !due.isOldOverdue
                      ? "text-[hsl(var(--urgency-now))]"
                      : due.isOldOverdue
                        ? "text-[hsl(var(--urgency-overdue-soft))]"
                        : isToday(newDate(task.dueDate as Date))
                          ? "text-[hsl(var(--urgency-today))]"
                          : "text-ink-mute"
                  )}
                >
                  {due.isOverdue && (
                    <PiWarningDuotone
                      className="h-3 w-3"
                      aria-hidden="true"
                    />
                  )}
                  {due.text}
                </span>
              )}
              {task.duration && (
                <span className="font-mono text-[10px] tracking-normal normal-case text-ink-mute">
                  {task.duration}m
                </span>
              )}
              {task.isAutoScheduled &&
                task.scheduledStart &&
                task.scheduledEnd && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-normal normal-case text-ink-soft">
                    <PiClockDuotone className="h-3 w-3" aria-hidden="true" />
                    {format(newDate(task.scheduledStart), "p")} –{" "}
                    {format(newDate(task.scheduledEnd), "p")}
                    {task.scheduleLocked && (
                      <PiLockSimpleDuotone
                        className="h-3 w-3"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                )}
            </div>
          )}

          {/* Energy / time-pref badges only if assigned */}
          {(task.energyLevel || task.preferredTime) && (
            <div className="flex flex-wrap gap-1">
              {task.energyLevel && (
                <Badge variant={energyVariant[task.energyLevel] || "default"}>
                  {formatEnumValue(task.energyLevel)}
                </Badge>
              )}
              {task.preferredTime && (
                <Badge variant={timeVariant[task.preferredTime]}>
                  {formatEnumValue(task.preferredTime)}
                </Badge>
              )}
            </div>
          )}

          {/* Tags — hover reveal so they don't compete with primary content */}
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 opacity-70 transition-opacity group-hover:opacity-100">
              {task.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color || "hsl(var(--text-secondary))",
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hover actions — outside drag handle so click doesn't trigger drag */}
      <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          className="rounded-md bg-surface p-1 text-ink-soft shadow-card transition-colors hover:bg-surface-sunken hover:text-ink"
          title="Edit"
          aria-label="Edit task"
        >
          <PiPencilSimpleDuotone className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="rounded-md bg-surface p-1 text-ink-soft shadow-card transition-colors hover:bg-surface-sunken hover:text-[hsl(var(--urgency-now))]"
          title="Delete"
          aria-label="Delete task"
        >
          <PiTrashDuotone className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
