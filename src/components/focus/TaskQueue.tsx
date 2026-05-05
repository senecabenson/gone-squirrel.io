"use client";

import { useState } from "react";

import { format, isBefore, newDate } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

import { useFocusModeStore } from "@/store/focusMode";
import { useTaskStore } from "@/store/task";

import { Task, TaskStatus } from "@/types/task";

interface QueueSection {
  key: "queued" | "pastDue" | "postponed" | "completed";
  title: string;
}

const SECTIONS: QueueSection[] = [
  { key: "queued", title: "Up next" },
  { key: "pastDue", title: "Past due" },
  { key: "postponed", title: "Postponed" },
  { key: "completed", title: "Recently done" },
];

export function TaskQueue() {
  const { switchToTask, currentTaskId, getQueuedTasks } = useFocusModeStore();
  const { tasks } = useTaskStore();

  const [expanded, setExpanded] = useState<Record<QueueSection["key"], boolean>>(
    {
      queued: false,
      pastDue: false,
      postponed: false,
      completed: false,
    }
  );

  const queuedTasks = getQueuedTasks();

  const pastDueTasks = tasks
    .filter(
      (t) =>
        t.status !== TaskStatus.COMPLETED &&
        t.dueDate &&
        isBefore(newDate(t.dueDate), newDate()) &&
        !t.postponedUntil
    )
    .sort((a, b) => {
      const da = a.dueDate ? newDate(a.dueDate).getTime() : 0;
      const db = b.dueDate ? newDate(b.dueDate).getTime() : 0;
      return da - db;
    });

  const postponedTasks = tasks
    .filter(
      (t) =>
        t.status !== TaskStatus.COMPLETED &&
        t.postponedUntil &&
        isBefore(newDate(), newDate(t.postponedUntil))
    )
    .sort((a, b) => {
      const da = a.postponedUntil ? newDate(a.postponedUntil).getTime() : 0;
      const db = b.postponedUntil ? newDate(b.postponedUntil).getTime() : 0;
      return da - db;
    });

  const completedTasks = tasks
    .filter((t) => t.status === TaskStatus.COMPLETED && t.completedAt)
    .sort((a, b) => {
      const da = a.completedAt ? newDate(a.completedAt).getTime() : 0;
      const db = b.completedAt ? newDate(b.completedAt).getTime() : 0;
      return db - da;
    });

  const dataMap: Record<QueueSection["key"], Task[]> = {
    queued: queuedTasks,
    pastDue: pastDueTasks,
    postponed: postponedTasks,
    completed: completedTasks,
  };

  logger.debug("[TaskQueue] Rendering", {
    queuedCount: queuedTasks.length,
    pastDueCount: pastDueTasks.length,
    postponedCount: postponedTasks.length,
    completedCount: completedTasks.length,
    currentTaskId,
  });

  const isEmpty = SECTIONS.every((s) => dataMap[s.key].length === 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-block py-block">
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-body-sm text-ink-soft">Nothing in the queue.</p>
          <p className="text-meta uppercase tracking-wide text-ink-mute">
            Capture a task to get started
          </p>
        </div>
      ) : (
        <nav aria-label="Task queue" className="flex flex-col gap-section">
          {SECTIONS.map((section) => {
            const sectionTasks = dataMap[section.key];
            if (sectionTasks.length === 0) return null;

            const isOpen = expanded[section.key];
            const visible = isOpen ? sectionTasks : sectionTasks.slice(0, 3);
            const hasMore = sectionTasks.length > 3;

            return (
              <div key={section.key} className="flex flex-col gap-2">
                <h3 className="flex items-baseline gap-2 text-meta uppercase tracking-wide text-ink-mute">
                  <span>{section.title}</span>
                  <span className="font-mono text-[10px] text-ink-mute/80">
                    {sectionTasks.length}
                  </span>
                </h3>

                <ul className="flex flex-col gap-0.5">
                  {visible.map((task) => {
                    const isCurrent = task.id === currentTaskId;
                    const isCompleted = task.status === TaskStatus.COMPLETED;
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => switchToTask(task.id)}
                          className={cn(
                            "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                            isCurrent
                              ? "bg-action-soft text-ink"
                              : "text-ink-soft hover:bg-surface-sunken/60 hover:text-ink",
                            isCompleted && "opacity-60"
                          )}
                          aria-current={isCurrent ? "true" : undefined}
                        >
                          {isCurrent && (
                            <span
                              aria-hidden="true"
                              className="h-4 w-[2px] rounded-full bg-action"
                            />
                          )}
                          <span className="task-title flex-1 truncate text-body-sm font-medium">
                            {task.title}
                          </span>
                          {section.key === "pastDue" && task.dueDate && (
                            <span className="font-mono text-[10px] text-[hsl(var(--urgency-overdue-soft))]">
                              {format(task.dueDate, "M/d")}
                            </span>
                          )}
                          {section.key === "postponed" &&
                            task.postponedUntil && (
                              <span className="font-mono text-[10px] text-ink-mute">
                                {format(task.postponedUntil, "M/d")}
                              </span>
                            )}
                          {section.key === "completed" && (
                            <span
                              aria-hidden="true"
                              className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--state-complete))]"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {hasMore && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((p) => ({ ...p, [section.key]: !p[section.key] }))
                    }
                    className="self-start px-2 py-1 text-meta uppercase tracking-wide text-ink-mute transition-colors hover:text-ink"
                  >
                    {isOpen
                      ? "Show fewer"
                      : `Show ${sectionTasks.length - 3} more`}
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      )}
    </div>
  );
}
