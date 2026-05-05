"use client";

import { useDroppable } from "@dnd-kit/core";
import { PiPlusBold } from "react-icons/pi";

import { cn } from "@/lib/utils";

import { Task, TaskStatus } from "@/types/task";

import { BoardTask } from "./BoardTask";

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onAdd?: (status: TaskStatus) => void;
}

const formatEnumValue = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const emptyCopy: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "Open lane. Drop something here, or leave it open.",
  [TaskStatus.IN_PROGRESS]: "Nothing in flight.",
  [TaskStatus.COMPLETED]: "Quiet here. Done tasks land here.",
};

export function Column({
  status,
  tasks,
  onEdit,
  onDelete,
  onAdd,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-xl border border-transparent bg-surface-sunken/40 transition-colors md:w-80",
        isOver && "border-action/40 bg-action-soft/40 ring-2 ring-action/30 ring-inset"
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-3">
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-h2 leading-none text-ink">
            {formatEnumValue(status)}
          </h2>
          <span className="font-mono text-[11px] text-ink-mute">
            {tasks.length}
          </span>
        </div>
        {onAdd && (
          <button
            type="button"
            onClick={() => onAdd(status)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-surface hover:text-ink"
            title={`Add to ${formatEnumValue(status)}`}
            aria-label={`Add task to ${formatEnumValue(status)}`}
          >
            <PiPlusBold className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {tasks.length === 0 ? (
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[hsl(var(--border-subtle))] px-4 py-section text-center text-body-sm text-ink-mute transition-colors",
              isOver && "border-action/40 text-ink-soft"
            )}
          >
            <p className="leading-relaxed">{emptyCopy[status]}</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2">
            {tasks.map((task) => (
              <BoardTask
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
            {/* Spacer keeps the column drop zone full-height even with few tasks */}
            <div className="min-h-12 flex-1" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
