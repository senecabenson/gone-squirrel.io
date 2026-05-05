"use client";

import { useEffect, useState } from "react";

import {
  PiKanbanDuotone,
  PiListBulletsDuotone,
  PiSidebarSimpleDuotone,
  PiSparkleDuotone,
} from "react-icons/pi";
import { toast } from "sonner";

import { ProjectSidebar } from "@/components/projects/ProjectSidebar";
import { BoardView } from "@/components/tasks/BoardView/BoardView";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskModal } from "@/components/tasks/TaskModal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

import { useProjectStore } from "@/store/project";
import { useTaskStore } from "@/store/task";
import { useTaskModalStore } from "@/store/taskModal";
import { useTaskPageSettings } from "@/store/taskPageSettings";

import { NewTask, Task, TaskStatus } from "@/types/task";

export default function TasksPage() {
  const {
    tasks,
    tags,
    error,
    fetchTasks,
    fetchTags,
    createTask,
    updateTask,
    deleteTask,
    createTag,
    scheduleAllTasks,
  } = useTaskStore();
  const { fetchProjects, activeProject } = useProjectStore();
  const { viewMode, setViewMode } = useTaskPageSettings();
  const { isOpen, setOpen } = useTaskModalStore();

  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [initialProjectId, setInitialProjectId] = useState<
    string | null | undefined
  >(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetchTasks();
    fetchTags();
    fetchProjects();
  }, [fetchTasks, fetchTags, fetchProjects]);

  const handleCreateTask = async (task: NewTask) => {
    await createTask(task);
    await fetchTasks();
    await fetchProjects();
  };

  const handleUpdateTask = async (task: NewTask) => {
    if (selectedTask) {
      await updateTask(selectedTask.id, task);
      await fetchTasks();
      await fetchProjects();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm("Delete this task? This can't be undone.")) {
      await deleteTask(taskId);
      await fetchTasks();
      await fetchProjects();
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    await updateTask(taskId, { status });
    await fetchTasks();
    await fetchProjects();
  };

  const handleCreateTag = async (name: string, color?: string) => {
    try {
      const newTag = await createTag({ name, color });
      await fetchTags();
      return newTag;
    } catch (err) {
      console.error("Error creating tag:", err);
      throw err;
    }
  };

  const handleInlineEdit = async (task: Task) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, tags: _t, createdAt, updatedAt, project, ...updates } = task;
    try {
      await updateTask(id, updates);
      await fetchTasks();
      if ("projectId" in updates) await fetchProjects();
    } catch (err) {
      console.error("Error updating task:", err);
      toast.error("Hmm, that didn't save", {
        description: "Not your fault — try again in a moment.",
      });
    }
  };

  const openNewTask = () => {
    setSelectedTask(undefined);
    const projectId = activeProject
      ? activeProject.id === "no-project"
        ? null
        : activeProject.id
      : undefined;
    setInitialProjectId(projectId);
    setOpen(true);
  };

  return (
    <div className="flex h-full bg-canvas">
      {/* Collapsible project sidebar */}
      <div
        className={cn(
          "transition-all duration-200 ease-out",
          sidebarOpen ? "w-64 md:w-72" : "w-0"
        )}
        aria-hidden={!sidebarOpen}
      >
        <div
          className={cn(
            "h-full overflow-hidden transition-opacity",
            sidebarOpen ? "opacity-100" : "opacity-0"
          )}
        >
          <ProjectSidebar />
        </div>
      </div>

      <div
        className="flex min-w-0 flex-1 flex-col"
        data-task-page
      >
        {/* Editorial header */}
        <header className="flex flex-col gap-3 border-b border-[hsl(var(--border-subtle))] px-block py-block md:flex-row md:items-end md:justify-between md:gap-block">
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
              title={sidebarOpen ? "Hide projects" : "Show projects"}
              aria-label={sidebarOpen ? "Hide projects" : "Show projects"}
              aria-expanded={sidebarOpen}
            >
              <PiSidebarSimpleDuotone className="h-5 w-5" />
            </button>
            <div className="flex flex-col">
              <span className="text-meta uppercase tracking-wide text-ink-mute">
                {activeProject?.name || "All projects"}
              </span>
              <h1 className="font-display text-display-sm leading-tight tracking-[-0.014em] text-ink md:text-display">
                Tasks
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* View toggle */}
            <div className="flex items-center gap-0.5 rounded-md border border-[hsl(var(--border-subtle))] bg-surface-sunken/40 p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium transition-colors",
                  viewMode === "list"
                    ? "bg-surface text-ink shadow-card"
                    : "text-ink-soft hover:text-ink"
                )}
                aria-pressed={viewMode === "list"}
              >
                <PiListBulletsDuotone className="h-4 w-4" />
                List
              </button>
              <button
                onClick={() => setViewMode("board")}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium transition-colors",
                  viewMode === "board"
                    ? "bg-surface text-ink shadow-card"
                    : "text-ink-soft hover:text-ink"
                )}
                aria-pressed={viewMode === "board"}
              >
                <PiKanbanDuotone className="h-4 w-4" />
                Board
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => scheduleAllTasks()}
              className="gap-1.5"
            >
              <PiSparkleDuotone className="h-4 w-4" aria-hidden="true" />
              Auto-schedule
            </Button>

            <Button
              data-create-task-button
              size="sm"
              onClick={openNewTask}
            >
              New task
            </Button>
          </div>
        </header>

        {error && (
          <div className="px-block pt-3">
            <Alert variant="destructive">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-block">
          {viewMode === "list" ? (
            <TaskList
              tasks={tasks}
              onEdit={(task) => {
                setSelectedTask(task);
                setOpen(true);
              }}
              onDelete={handleDeleteTask}
              onStatusChange={handleStatusChange}
              onInlineEdit={handleInlineEdit}
            />
          ) : (
            <BoardView
              tasks={tasks}
              onEdit={(task) => {
                setSelectedTask(task);
                setOpen(true);
              }}
              onDelete={handleDeleteTask}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>

        <TaskModal
          isOpen={isOpen}
          onClose={() => {
            setOpen(false);
            setSelectedTask(undefined);
            setInitialProjectId(undefined);
          }}
          onSave={selectedTask ? handleUpdateTask : handleCreateTask}
          task={selectedTask}
          tags={tags}
          onCreateTag={handleCreateTag}
          initialProjectId={initialProjectId}
        />
      </div>
    </div>
  );
}
