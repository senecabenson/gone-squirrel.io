import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet-mobile";
import { Switch } from "@/components/ui/switch";

import { newDate } from "@/lib/date-utils";

import { useProjectStore } from "@/store/project";
import { useSettingsStore } from "@/store/settings";
import { useTaskStore } from "@/store/task";
import { useTaskListViewSettings } from "@/store/taskListViewSettings";
import { useTaskModalStore } from "@/store/taskModal";

import { EnergyLevel, Task, TaskStatus, TimePreference } from "@/types/task";

import { StatusFilter, TaskRow } from "./components";
import { formatEnumValue } from "./utils/task-list-utils";

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onInlineEdit: (task: Task) => void;
}

export function TaskList({
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
  onInlineEdit,
}: TaskListProps) {
  const {
    sortBy,
    sortDirection,
    status,
    energyLevel,
    timePreference,
    tagIds,
    search,
    hideUpcomingTasks,
    setSortBy,
    setSortDirection,
    setFilters,
    resetFilters,
  } = useTaskListViewSettings();
  const { activeProject } = useProjectStore();
  const { loading } = useTaskStore();
  const { setOpen: openTaskModal } = useTaskModalStore();

  const [energyPopoverOpen, setEnergyPopoverOpen] = useState(false);
  const [timePopoverOpen, setTimePopoverOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Resizable meta column width (persisted)
  const storedMetaWidth = useSettingsStore((s) => s.taskListMetaWidth);
  const setStoredMetaWidth = useSettingsStore((s) => s.setTaskListMetaWidth);
  const [draftMetaWidth, setDraftMetaWidth] = useState<number | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const metaWidth = draftMetaWidth ?? storedMetaWidth;

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!listContainerRef.current) return;
    const rect = listContainerRef.current.getBoundingClientRect();
    const ACTIONS_W = 64; // approx width of trailing actions slot + outer padding
    let lastWidth = metaWidth;

    const onMove = (ev: MouseEvent) => {
      const next = rect.right - ev.clientX - ACTIONS_W;
      lastWidth = Math.max(220, Math.min(800, next));
      setDraftMetaWidth(lastWidth);
    };
    const onUp = () => {
      setStoredMetaWidth(lastWidth);
      setDraftMetaWidth(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // First, filter by project
  const projectFilteredTasks = activeProject
    ? activeProject.id === "no-project"
      ? tasks.filter((task) => !task.projectId)
      : tasks.filter((task) => task.projectId === activeProject.id)
    : tasks;

  // Then apply other filters
  const filteredTasks = useMemo(() => {
    const now = newDate();

    return projectFilteredTasks.filter((task) => {
      // Status filter
      if (status?.length && !status.includes(task.status)) {
        return false;
      }

      // Hide future tasks
      if (
        hideUpcomingTasks &&
        task.startDate &&
        newDate(task.startDate) > now
      ) {
        return false;
      }

      // Energy level filter
      if (
        energyLevel?.length &&
        (!task.energyLevel || !energyLevel.includes(task.energyLevel))
      ) {
        return false;
      }

      // Time preference filter
      if (
        timePreference?.length &&
        (!task.preferredTime || !timePreference.includes(task.preferredTime))
      ) {
        return false;
      }

      // Tags filter
      if (tagIds?.length) {
        const taskTagIds = task.tags.map((t) => t.id);
        if (!tagIds.some((id) => taskTagIds.includes(id))) {
          return false;
        }
      }

      // Search
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower) ||
          task.tags.some((tag) => tag.name.toLowerCase().includes(searchLower))
        );
      }

      return true;
    });
  }, [
    projectFilteredTasks,
    status,
    energyLevel,
    timePreference,
    tagIds,
    search,
    hideUpcomingTasks,
  ]);

  // Apply sorting
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      switch (sortBy) {
        case "title":
          return direction * a.title.localeCompare(b.title);
        case "dueDate":
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return (
            direction *
            (newDate(a.dueDate).getTime() - newDate(b.dueDate).getTime())
          );
        case "startDate":
          if (!a.startDate) return 1;
          if (!b.startDate) return -1;
          return (
            direction *
            (newDate(a.startDate).getTime() - newDate(b.startDate).getTime())
          );
        case "status":
          return direction * a.status.localeCompare(b.status);
        case "project":
          if (!a.project?.name) return 1;
          if (!b.project?.name) return -1;
          return direction * a.project.name.localeCompare(b.project.name);
        case "priority":
          if (!a.priority) return 1;
          if (!b.priority) return -1;
          return direction * a.priority.localeCompare(b.priority);
        case "energyLevel":
          if (!a.energyLevel) return 1;
          if (!b.energyLevel) return -1;
          return direction * a.energyLevel.localeCompare(b.energyLevel);
        case "preferredTime":
          if (!a.preferredTime) return 1;
          if (!b.preferredTime) return -1;
          return direction * a.preferredTime.localeCompare(b.preferredTime);
        case "duration":
          if (!a.duration) return 1;
          if (!b.duration) return -1;
          return direction * (a.duration - b.duration);
        case "schedule":
          // First sort by auto-scheduled vs manual
          if (a.isAutoScheduled !== b.isAutoScheduled) {
            return direction * (a.isAutoScheduled ? -1 : 1);
          }
          // Then sort by scheduled start time
          if (a.isAutoScheduled && b.isAutoScheduled) {
            if (!a.scheduledStart) return 1;
            if (!b.scheduledStart) return -1;
            return (
              direction *
              (newDate(a.scheduledStart).getTime() -
                newDate(b.scheduledStart).getTime())
            );
          }
          // Default to creation date for manual tasks
          return (
            direction *
            (newDate(b.createdAt).getTime() - newDate(a.createdAt).getTime())
          );
        default:
          return (
            direction *
            (newDate(b.createdAt).getTime() - newDate(a.createdAt).getTime())
          );
      }
    });
  }, [filteredTasks, sortBy, sortDirection]);

  const hasActiveFilters = !!(
    status?.length ||
    energyLevel?.length ||
    timePreference?.length ||
    tagIds?.length ||
    search
  );

  const activeFilterCount = [
    status?.length ? 1 : 0,
    energyLevel?.length ? 1 : 0,
    timePreference?.length ? 1 : 0,
    tagIds?.length ? 1 : 0,
    search ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Derived label helpers
  const energyLabel = energyLevel?.[0]
    ? `Energy: ${formatEnumValue(energyLevel[0])}`
    : "Energy";
  const timeLabel = timePreference?.[0]
    ? `Time: ${formatEnumValue(timePreference[0])}`
    : "Time";

  return (
    <div className="flex h-full flex-col">
      {/* ── Filter row ── */}
      <div className="mb-4">
        {/* Desktop pill bar (md+) */}
        <div className="hidden md:flex md:items-center md:gap-2">
          {/* Search */}
          <Input
            value={search || ""}
            onChange={(e) => setFilters({ search: e.target.value || undefined })}
            placeholder="Search tasks…"
            className="h-9 max-w-sm flex-1 bg-canvas text-ink-soft placeholder:text-ink-mute"
          />

          {/* Status pill */}
          <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={status?.length ? "secondary" : "ghost"}
                size="sm"
              >
                {status?.length
                  ? `Status: ${status.map((s) => formatEnumValue(s)).join(", ")}`
                  : "Status"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <StatusFilter
                value={status || []}
                onChange={(value) => setFilters({ status: value })}
              />
            </PopoverContent>
          </Popover>

          {/* Energy pill */}
          <Popover open={energyPopoverOpen} onOpenChange={setEnergyPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={energyLevel?.length ? "secondary" : "ghost"}
                size="sm"
              >
                {energyLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="start">
              <Select
                value={energyLevel?.[0] || "none"}
                onValueChange={(value) => {
                  setFilters({
                    energyLevel:
                      value !== "none" ? [value as EnergyLevel] : undefined,
                  });
                  setEnergyPopoverOpen(false);
                }}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder="All Energy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Energy</SelectItem>
                  {Object.values(EnergyLevel).map((level) => (
                    <SelectItem key={level} value={level}>
                      {formatEnumValue(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Time pill */}
          <Popover open={timePopoverOpen} onOpenChange={setTimePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={timePreference?.length ? "secondary" : "ghost"}
                size="sm"
              >
                {timeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-2" align="start">
              <Select
                value={timePreference?.[0] || "none"}
                onValueChange={(value) => {
                  setFilters({
                    timePreference:
                      value !== "none" ? [value as TimePreference] : undefined,
                  });
                  setTimePopoverOpen(false);
                }}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder="All Times" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Times</SelectItem>
                  {Object.values(TimePreference).map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatEnumValue(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PopoverContent>
          </Popover>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear
            </Button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Hide upcoming toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="hideUpcomingDesktop"
              checked={hideUpcomingTasks}
              onCheckedChange={(checked) =>
                setFilters({ hideUpcomingTasks: checked as boolean })
              }
            />
            <label
              htmlFor="hideUpcomingDesktop"
              className="cursor-pointer text-meta text-ink-mute"
            >
              Hide upcoming
            </label>
          </div>
        </div>

        {/* Mobile filter row (<md) */}
        <div className="flex items-center gap-2 md:hidden">
          <Input
            value={search || ""}
            onChange={(e) => setFilters({ search: e.target.value || undefined })}
            placeholder="Search tasks…"
            className="h-9 flex-1 bg-canvas text-ink-soft placeholder:text-ink-mute"
          />

          <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="relative shrink-0">
                Filter
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-action text-[10px] font-semibold text-action-on">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-4 pt-2">
                {/* Status */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-meta uppercase tracking-wide text-ink-mute">
                    Status
                  </p>
                  <StatusFilter
                    value={status || []}
                    onChange={(value) => setFilters({ status: value })}
                  />
                </div>

                {/* Energy */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-meta uppercase tracking-wide text-ink-mute">
                    Energy
                  </p>
                  <Select
                    value={energyLevel?.[0] || "none"}
                    onValueChange={(value) =>
                      setFilters({
                        energyLevel:
                          value !== "none"
                            ? [value as EnergyLevel]
                            : undefined,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="All Energy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All Energy</SelectItem>
                      {Object.values(EnergyLevel).map((level) => (
                        <SelectItem key={level} value={level}>
                          {formatEnumValue(level)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Time preference */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-meta uppercase tracking-wide text-ink-mute">
                    Time of day
                  </p>
                  <Select
                    value={timePreference?.[0] || "none"}
                    onValueChange={(value) =>
                      setFilters({
                        timePreference:
                          value !== "none"
                            ? [value as TimePreference]
                            : undefined,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="All Times" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All Times</SelectItem>
                      {Object.values(TimePreference).map((time) => (
                        <SelectItem key={time} value={time}>
                          {formatEnumValue(time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hide upcoming */}
                <div className="flex items-center justify-between">
                  <p className="text-meta uppercase tracking-wide text-ink-mute">
                    Hide upcoming
                  </p>
                  <Switch
                    id="hideUpcomingMobile"
                    checked={hideUpcomingTasks}
                    onCheckedChange={(checked) =>
                      setFilters({ hideUpcomingTasks: checked as boolean })
                    }
                  />
                </div>

                {/* Clear */}
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetFilters();
                      setMobileFilterOpen(false);
                    }}
                    className="w-full"
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* ── Loading state ── */}
      {loading && (
        <div className="flex items-center gap-3 py-4">
          <span className="h-3 w-3 rounded-full bg-action animate-pulse" />
          <p className="text-body-sm text-ink-soft">
            One moment — pulling tasks.
          </p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && sortedTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-section text-center">
          <p className="font-display text-display-sm text-ink">
            Nothing on the docket.
          </p>
          <p className="max-w-[44ch] text-body-sm text-ink-soft">
            Want to capture something, or just breathe?
          </p>
          <Button onClick={() => openTaskModal(true)}>Capture a task</Button>
        </div>
      )}

      {/* ── Sort bar ── */}
      {!loading && sortedTasks.length > 0 && (
        <div className="mb-2 flex items-center justify-between gap-2 px-2">
          <span className="text-meta uppercase tracking-wide text-ink-mute">
            {sortedTasks.length} task{sortedTasks.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="hidden text-meta uppercase tracking-wide text-ink-mute sm:inline">
              Sort
            </span>
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as typeof sortBy)}
            >
              <SelectTrigger className="h-8 w-36 text-body-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="dueDate">Due date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="energyLevel">Energy</SelectItem>
                <SelectItem value="preferredTime">Time of day</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() =>
                setSortDirection(sortDirection === "asc" ? "desc" : "asc")
              }
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
              title={sortDirection === "asc" ? "Ascending" : "Descending"}
              aria-label={`Sort ${sortDirection === "asc" ? "ascending" : "descending"}`}
            >
              {sortDirection === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>
      )}

      {/* ── Task list with sticky header + resizable meta column ── */}
      {!loading && sortedTasks.length > 0 && (
        <div
          ref={listContainerRef}
          className="flex flex-1 flex-col overflow-y-auto rounded-lg border border-[hsl(var(--border-subtle))] bg-canvas"
          style={{ ["--meta-w" as string]: `${metaWidth}px` }}
        >
          {/* Header — desktop only, mirrors TaskRow meta cell widths */}
          <div className="sticky top-0 z-10 hidden border-b border-[hsl(var(--border-subtle))] bg-surface-sunken/80 px-2 backdrop-blur md:block">
            <div className="flex items-center gap-3 py-2 text-meta uppercase tracking-wide text-ink-mute">
              <span className="w-4 shrink-0" aria-hidden="true" />
              <span className="w-7 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">Task</span>

              {/* Resize handle — drag to grow/shrink the meta column */}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize meta column"
                onMouseDown={handleResizeStart}
                className="group relative -mx-1 h-6 w-2 shrink-0 cursor-col-resize"
                title="Drag to resize"
              >
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[hsl(var(--border-default))] transition-colors group-hover:bg-action" />
              </div>

              <div
                className="flex items-center overflow-hidden"
                style={{ width: "var(--meta-w, 540px)", flexShrink: 0 }}
              >
                <span className="flex-1 min-w-0 px-2 truncate">Status</span>
                <span className="hidden flex-1 min-w-0 px-2 truncate lg:block">
                  Energy
                </span>
                <span className="hidden flex-1 min-w-0 px-2 truncate xl:block">
                  Time
                </span>
                <span className="flex-1 min-w-0 px-2 truncate">Mins</span>
                <span className="flex-1 min-w-0 px-2 truncate">Due</span>
                <span className="hidden flex-1 min-w-0 px-2 truncate xl:block">
                  Sched
                </span>
                <span className="flex-1 min-w-0 px-2 truncate">Project</span>
              </div>
              <span className="w-14 shrink-0" aria-hidden="true" />
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-[hsl(var(--border-subtle))]">
            {sortedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onInlineEdit={onInlineEdit}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
