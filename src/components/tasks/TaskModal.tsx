import { useCallback, useEffect, useRef, useState } from "react";

import { RRule } from "rrule";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { format, newDate } from "@/lib/date-utils";
import { RecurrenceConverterFactory } from "@/lib/task-sync/recurrence/recurrence-converter-factory";
import { cn } from "@/lib/utils";

import { useProjectStore } from "@/store/project";

import {
  EnergyLevel,
  NewTask,
  Priority,
  Tag,
  Task,
  TaskStatus,
  TimePreference,
} from "@/types/task";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: NewTask) => Promise<void>;
  task?: Task;
  tags: Tag[];
  onCreateTag: (name: string, color?: string) => Promise<Tag>;
  initialProjectId?: string | null;
}

//TODO: move to utils
const formatEnumValue = (value: string) => {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to convert external recurrence rule to RRule format
function getStandardRRule(task?: Task): RRule {
  if (!task?.recurrenceRule) {
    return new RRule({
      freq: RRule.WEEKLY,
      interval: 1,
      byweekday: [RRule.MO],
    });
  }

  // If the task has a source (e.g., OUTLOOK), use the appropriate converter
  if (task.source) {
    const converter = RecurrenceConverterFactory.getConverter(task.source);
    const standardRule = converter.convertFromString(task.recurrenceRule);
    return RRule.fromString(standardRule);
  }

  // If no source or internal task, assume it's already in RRule format
  return RRule.fromString(task.recurrenceRule);
}

export function TaskModal({
  isOpen,
  onClose,
  onSave,
  task,
  tags,
  onCreateTag,
  initialProjectId,
}: TaskModalProps) {
  const { projects } = useProjectStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [dueDate, setDueDate] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [chunkSize, setChunkSize] = useState<number>(30);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel | "">("");
  const [preferredTime, setPreferredTime] = useState<TimePreference | "">("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#E5E7EB");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectId, setProjectId] = useState<string | null | undefined>(
    initialProjectId || task?.projectId
  );
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<string | undefined>();
  const [isAutoScheduled, setIsAutoScheduled] = useState(
    task?.isAutoScheduled || false
  );
  const [scheduleLocked, setScheduleLocked] = useState(
    task?.scheduleLocked || false
  );
  const [priority, setPriority] = useState<Priority | null>(
    task?.priority || null
  );
  const titleInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setStatus(TaskStatus.TODO);
    setDueDate("");
    setStartDate("");
    setDuration("");
    setChunkSize(30);
    setEnergyLevel("");
    setPreferredTime("");
    setSelectedTagIds([]);
    setNewTagName("");
    setNewTagColor("#E5E7EB");
    setProjectId(initialProjectId ?? null);
    setIsRecurring(false);
    setRecurrenceRule(undefined);
    setIsAutoScheduled(true);
    setScheduleLocked(false);
    setPriority(null);
  }, [initialProjectId]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  // Populate form with task data when editing
  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      // Handle date string from API
      if (task.dueDate) {
        const date = newDate(task.dueDate);
        setDueDate(date.toISOString().split("T")[0]);
      } else {
        setDueDate("");
      }
      if (task.startDate) {
        const date = newDate(task.startDate);
        setStartDate(date.toISOString().split("T")[0]);
      } else {
        setStartDate("");
      }
      setDuration(task.duration?.toString() || "");
      setChunkSize(task.chunkMax ?? 30);
      setEnergyLevel(task.energyLevel || "");
      setPreferredTime(task.preferredTime || "");
      setSelectedTagIds(task.tags.map((t) => t.id));
      setProjectId(task.projectId || null);
      setIsRecurring(task.isRecurring);
      setRecurrenceRule(task.recurrenceRule || undefined);
      setIsAutoScheduled(task.isAutoScheduled);
      setScheduleLocked(task.scheduleLocked);
      setPriority(task.priority || null);
    } else if (!task && isOpen) {
      resetForm();
    }
  }, [task, isOpen, initialProjectId, resetForm]);

  // Focus title input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        dueDate: dueDate ? newDate(dueDate) : null,
        startDate: startDate ? newDate(startDate) : null,
        duration: duration ? parseInt(duration, 10) : undefined,
        energyLevel: energyLevel || undefined,
        preferredTime: preferredTime || undefined,
        tagIds: selectedTagIds,
        projectId: projectId,
        isRecurring,
        recurrenceRule: isRecurring ? recurrenceRule : undefined,
        isAutoScheduled,
        scheduleLocked,
        priority,
        chunkMin: chunkSize,
        chunkMax: chunkSize,
      });
      onClose();
    } catch (error) {
      console.error("Error saving task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      const tag = await onCreateTag(newTagName.trim(), newTagColor);
      setSelectedTagIds([...selectedTagIds, tag.id]);
      setNewTagName("");
      setNewTagColor("#E5E7EB");
    } catch (error) {
      console.error("Error creating tag:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[95vh] flex-col overflow-hidden bg-surface-raised sm:max-w-[640px] md:max-w-[900px] lg:max-w-[1100px]">
        {isSubmitting && <LoadingOverlay />}
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 space-y-block overflow-y-auto px-1"
        >
          <div className="space-y-block md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-0 md:space-y-0 md:items-start">
          <div className="space-y-block">
          {/* Title */}
          <div className="space-y-2">
            <Label
              htmlFor="title"
              className="text-meta uppercase tracking-wide text-ink-mute mb-1"
            >
              Title
            </Label>
            <Input
              id="title"
              className="task-title"
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="text-meta uppercase tracking-wide text-ink-mute mb-1"
            >
              Description
            </Label>
            <Textarea
              id="description"
              className="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Project */}
          <div className="space-y-2">
            <Label
              htmlFor="project"
              className="text-meta uppercase tracking-wide text-ink-mute mb-1"
            >
              Project
            </Label>
            <Select
              value={projectId || "none"}
              onValueChange={(value) =>
                setProjectId(value === "none" ? null : value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Project</SelectItem>
                {projects
                  .filter((p) => p.status === "active")
                  .map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-meta uppercase tracking-wide text-ink-mute mb-1">
              Tags
            </Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className={cn(
                    "inline-flex cursor-pointer items-center rounded-full px-3 py-1.5 text-sm transition-colors",
                    selectedTagIds.includes(tag.id)
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-ink-soft hover:bg-muted/70"
                  )}
                >
                  <Checkbox
                    className="sr-only"
                    checked={selectedTagIds.includes(tag.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTagIds([...selectedTagIds, tag.id]);
                      } else {
                        setSelectedTagIds(
                          selectedTagIds.filter((id) => id !== tag.id)
                        );
                      }
                    }}
                  />
                  <span
                    className="mr-2 h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color || "var(--muted)" }}
                  />
                  {tag.name}
                </label>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag name"
              />
              <Input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-9 w-9 p-1"
              />
              <Button
                type="button"
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                variant="secondary"
              >
                Add Tag
              </Button>
            </div>
          </div>
          </div>
          <div className="space-y-block">

          {/* Grid fields: status, due date, start date, duration, priority, energy, time */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="space-y-2">
              <Label
                htmlFor="status"
                className="text-meta uppercase tracking-wide text-ink-mute mb-1"
              >
                Status
              </Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue>{formatEnumValue(status)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TaskStatus).map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatEnumValue(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="dueDate"
                className="text-meta uppercase tracking-wide text-ink-mute mb-1"
              >
                Due Date
              </Label>
              <Input
                type="date"
                id="dueDate"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="startDate"
                className="text-meta uppercase tracking-wide text-ink-mute mb-1"
              >
                Start Date
              </Label>
              <Input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-xs text-ink-soft">
                Optional: Task won&apos;t be scheduled before this date
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="duration"
                className="text-meta uppercase tracking-wide text-ink-mute mb-1"
              >
                Duration (minutes)
              </Label>
              <Input
                type="number"
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="priority"
                className="text-meta uppercase tracking-wide text-ink-mute mb-1"
              >
                Priority
              </Label>
              <Select
                value={priority || Priority.NONE}
                onValueChange={(value) => setPriority(value as Priority)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {formatEnumValue(priority || Priority.NONE)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Priority).map((level) => (
                    <SelectItem key={level} value={level}>
                      {formatEnumValue(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="energyLevel"
                className="text-meta uppercase tracking-wide text-ink-mute mb-1"
              >
                Energy Level
              </Label>
              <Select
                value={energyLevel || "none"}
                onValueChange={(value) =>
                  setEnergyLevel(value === "none" ? "" : (value as EnergyLevel))
                }
              >
                <SelectTrigger id="energyLevel">
                  <SelectValue placeholder="None">
                    {energyLevel ? formatEnumValue(energyLevel) : "None"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {Object.values(EnergyLevel).map((level) => (
                    <SelectItem key={level} value={level}>
                      {formatEnumValue(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="preferredTime"
                className="text-meta uppercase tracking-wide text-ink-mute mb-1"
              >
                Preferred Time
              </Label>
              <Select
                value={preferredTime || "none"}
                onValueChange={(value) =>
                  setPreferredTime(
                    value === "none" ? "" : (value as TimePreference)
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None">
                    {preferredTime ? formatEnumValue(preferredTime) : "None"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {Object.values(TimePreference).map((time) => (
                    <SelectItem key={time} value={time}>
                      {formatEnumValue(time)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chunk Size */}
          <div className="space-y-2">
            <Label className="text-meta uppercase tracking-wide text-ink-mute mb-1">
              Chunk Size
            </Label>
            <div className="flex flex-wrap gap-2">
              {[15, 30, 45, 60].map((m) => {
                const isSelected = chunkSize === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setChunkSize(m)}
                    aria-pressed={isSelected}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-action text-action-foreground border-action shadow-md shadow-action/25"
                        : "bg-canvas border-border-subtle hover:border-action/40 text-ink"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <p className="text-xs italic text-ink-soft">
              How big each focus chunk should be when this task gets split across rounds.
            </p>
          </div>

          {/* Auto-schedule section */}
          <div className="space-y-4 border-t border-[hsl(var(--border-subtle))] pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-meta uppercase tracking-wide text-ink-mute mb-1">
                  Auto-Schedule
                </Label>
                <p className="text-sm text-ink-soft">
                  Let the system schedule this task automatically
                </p>
              </div>
              <Switch
                checked={isAutoScheduled}
                onCheckedChange={setIsAutoScheduled}
              />
            </div>

            {isAutoScheduled && (
              <>
                {/* Scheduled preview block */}
                {task?.scheduledStart && task?.scheduledEnd && (
                  <div className="bg-surface-sunken rounded-md p-3">
                    <div className="font-mono text-body-sm text-ink">
                      Scheduled for{" "}
                      {format(newDate(task.scheduledStart), "PPp")} to{" "}
                      {format(newDate(task.scheduledEnd), "p")}
                    </div>
                    {task.scheduleScore && (
                      <div className="mt-1 font-mono text-body-sm text-ink-soft">
                        Confidence: {Math.round(task.scheduleScore * 100)}%
                      </div>
                    )}
                    {/* Lock this slot toggle */}
                    <div className="mt-3 flex items-center justify-between">
                      <Label className="text-body-sm text-ink">
                        Lock this slot
                      </Label>
                      <Switch
                        checked={scheduleLocked}
                        onCheckedChange={setScheduleLocked}
                      />
                    </div>
                  </div>
                )}

                {/* Lock toggle when no preview block */}
                {!(task?.scheduledStart && task?.scheduledEnd) && (
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-meta uppercase tracking-wide text-ink-mute mb-1">
                        Lock Schedule
                      </Label>
                      <p className="text-sm text-ink-soft">
                        Prevent automatic rescheduling
                      </p>
                    </div>
                    <Switch
                      checked={scheduleLocked}
                      onCheckedChange={setScheduleLocked}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={isRecurring}
                onCheckedChange={(checked) => {
                  setIsRecurring(checked as boolean);
                  if (checked) {
                    if (!dueDate) {
                      const today = newDate();
                      setDueDate(today.toISOString().split("T")[0]);
                    }
                    if (!recurrenceRule) {
                      setRecurrenceRule(
                        new RRule({
                          freq: RRule.WEEKLY,
                          interval: 1,
                          byweekday: [RRule.MO],
                        }).toString()
                      );
                    }
                  }
                }}
              />
              <Label
                htmlFor="recurring"
                className="text-meta uppercase tracking-wide text-ink-mute"
              >
                Make this a recurring task
              </Label>
            </div>
            {isRecurring && !dueDate && (
              <div className="ml-6 mt-1 text-sm text-[hsl(var(--state-complete))]">
                A recurring task needs a start date. Today has been set as the
                default.
              </div>
            )}
            {isRecurring && (
              <div className="bg-surface-sunken rounded-md p-3 mt-2">
                <div className="space-y-3">
                  <div>
                    <span className="text-body-sm text-ink">Repeats every</span>
                    <div className="mt-1 flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={
                          recurrenceRule
                            ? getStandardRRule({
                                recurrenceRule,
                                source: task?.source,
                              } as Task).options.interval || 1
                            : 1
                        }
                        onChange={(e) => {
                          const interval = parseInt(e.target.value) || 1;
                          const currentRule = recurrenceRule
                            ? getStandardRRule({
                                recurrenceRule,
                                source: task?.source,
                              } as Task)
                            : new RRule({
                                freq: RRule.WEEKLY,
                                interval: 1,
                                byweekday: [RRule.MO],
                              });
                          setRecurrenceRule(
                            new RRule({
                              ...currentRule.options,
                              interval,
                            }).toString()
                          );
                        }}
                        className="w-20"
                      />
                      <Select
                        value={
                          recurrenceRule
                            ? getStandardRRule({
                                recurrenceRule,
                                source: task?.source,
                              } as Task).options.freq.toString()
                            : RRule.WEEKLY.toString()
                        }
                        onValueChange={(value) => {
                          const freq = parseInt(value);
                          const currentRule = recurrenceRule
                            ? getStandardRRule({
                                recurrenceRule,
                                source: task?.source,
                              } as Task)
                            : new RRule({
                                freq: RRule.WEEKLY,
                                interval: 1,
                                byweekday: [RRule.MO],
                              });
                          setRecurrenceRule(
                            new RRule({
                              ...currentRule.options,
                              freq,
                              byweekday:
                                freq === RRule.WEEKLY ? [RRule.MO] : null,
                            }).toString()
                          );
                        }}
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={RRule.DAILY.toString()}>
                            days
                          </SelectItem>
                          <SelectItem value={RRule.WEEKLY.toString()}>
                            weeks
                          </SelectItem>
                          <SelectItem value={RRule.MONTHLY.toString()}>
                            months
                          </SelectItem>
                          <SelectItem value={RRule.YEARLY.toString()}>
                            years
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          </div>
          </div>

          <DialogFooter className="border-t border-[hsl(var(--border-subtle))] pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? "Saving..." : task ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
