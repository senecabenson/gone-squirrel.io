"use client";

import { useState } from "react";

import {
  PiCheckBold,
  PiClockClockwiseDuotone,
  PiPencilSimpleDuotone,
  PiTrashDuotone,
} from "react-icons/pi";

import { TaskModal } from "@/components/tasks/TaskModal";
import { Button } from "@/components/ui/button";

import { logger } from "@/lib/logger";

import { useFocusModeStore } from "@/store/focusMode";
import { useTaskStore } from "@/store/task";

import { NewTask } from "@/types/task";

const POSTPONE_OPTIONS = [
  { label: "1h", value: "1h" as const },
  { label: "3h", value: "3h" as const },
  { label: "tomorrow", value: "1d" as const },
  { label: "next week", value: "1w" as const },
];

export function QuickActions() {
  const { completeCurrentTask, postponeTask, getCurrentTask } =
    useFocusModeStore();
  const { updateTask, deleteTask, fetchTasks, tags, createTag } =
    useTaskStore();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const currentTask = getCurrentTask();
  const disabled = !currentTask;

  const handleEditTask = async (taskData: NewTask) => {
    if (!currentTask) return;
    try {
      await updateTask(currentTask.id, taskData);
      await fetchTasks();
      setIsEditModalOpen(false);
    } catch (error) {
      logger.error("Failed to update task in focus mode", {
        error: error instanceof Error ? error.message : String(error),
        taskId: currentTask.id,
      });
    }
  };

  const handleDeleteTask = async () => {
    if (!currentTask) return;
    if (!confirm("Delete this task? This can't be undone.")) return;
    try {
      await deleteTask(currentTask.id);
      await fetchTasks();
    } catch (error) {
      logger.error("Failed to delete task in focus mode", {
        error: error instanceof Error ? error.message : String(error),
        taskId: currentTask.id,
      });
    }
  };

  return (
    <div className="flex h-full flex-col gap-block px-block py-block">
      {/* Primary — single accent action */}
      <Button
        variant="default"
        size="lg"
        onClick={() => completeCurrentTask()}
        disabled={disabled}
        className="w-full justify-center gap-2"
      >
        <PiCheckBold className="h-5 w-5" aria-hidden="true" />
        Mark done
      </Button>

      {/* Postpone — quiet support row */}
      <div className="flex flex-col gap-2">
        <h3 className="text-meta uppercase tracking-wide text-ink-mute">
          Move it
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {POSTPONE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="outline"
              size="sm"
              onClick={() => postponeTask(opt.value)}
              disabled={disabled}
              className="gap-1.5 capitalize"
            >
              <PiClockClockwiseDuotone className="h-3.5 w-3.5" aria-hidden="true" />
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Secondary actions */}
      <div className="mt-auto flex flex-col gap-1 border-t border-[hsl(var(--border-subtle))] pt-block">
        <Button
          variant="ghost"
          onClick={() => setIsEditModalOpen(true)}
          disabled={disabled}
          className="justify-start gap-2"
        >
          <PiPencilSimpleDuotone className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
        <Button
          variant="subtle"
          onClick={handleDeleteTask}
          disabled={disabled}
          className="justify-start gap-2 hover:text-[hsl(var(--urgency-now))]"
        >
          <PiTrashDuotone className="h-4 w-4" aria-hidden="true" />
          Delete
        </Button>
      </div>

      {currentTask && (
        <TaskModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleEditTask}
          task={currentTask}
          tags={tags}
          onCreateTag={(name, color) => createTag({ name, color: color || "" })}
        />
      )}
    </div>
  );
}
