import { HiCheck, HiPencil, HiTrash } from "react-icons/hi";

import { Button } from "@/components/ui/button";
import {
  IoCalendarOutline,
  IoFlagOutline,
  IoFolderOutline,
  IoLocationOutline,
  IoLockClosedOutline,
  IoPeopleOutline,
  IoRepeat,
  IoTimeOutline,
} from "react-icons/io5";

import { format, isFutureDate, newDate } from "@/lib/date-utils";
import { isTaskOverdue } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { AttendeeStatus, CalendarEvent } from "@/types/calendar";
import { Priority, Task, TaskStatus } from "@/types/task";

interface Attendee {
  name?: string;
  email: string;
  status?: AttendeeStatus;
}

interface EventQuickViewProps {
  isOpen: boolean;
  onClose: () => void;
  item:
  | (CalendarEvent & {
    attendees?: Attendee[];
    extendedProps?: { isTask?: boolean };
  })
  | (Task & { project?: { name: string; color?: string | null } | null });
  onEdit: () => void;
  onDelete: () => void;
  isTask: boolean;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  referenceElement: HTMLElement | null;
}

//TODO: move to utils
const priorityColors = {
  [Priority.HIGH]: "text-[hsl(var(--urgency-now))]",
  [Priority.MEDIUM]: "text-[hsl(var(--urgency-soon))]",
  [Priority.LOW]: "text-action",
  [Priority.NONE]: "text-ink-mute",
};

export function EventQuickView({
  isOpen,
  onClose,
  item,
  onEdit,
  onDelete,
  isTask,
  onStatusChange,
  referenceElement,
}: EventQuickViewProps) {
  const getStatusColor = (status: string | undefined) => {
    switch (status?.toUpperCase()) {
      case "ACCEPTED":
      case TaskStatus.COMPLETED:
        return "text-[hsl(var(--state-complete))]";
      case "TENTATIVE":
      case TaskStatus.IN_PROGRESS:
        return "text-[hsl(var(--state-in-progress))]";
      case "DECLINED":
        return "text-[hsl(var(--urgency-now))]";
      default:
        return "text-ink-mute";
    }
  };

  // Cast item to the appropriate type based on isTask
  const taskItem = isTask ? (item as Task) : null;
  const eventItem = !isTask
    ? (item as CalendarEvent & { attendees?: Attendee[] })
    : null;

  const isOverdue = taskItem && isTaskOverdue(taskItem);

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger asChild>
        <div
          className="w-0 h-0 opacity-0 pointer-events-none"
          style={{
            position: 'fixed',
            left: referenceElement ? referenceElement.getBoundingClientRect().left : 0,
            top: referenceElement ? referenceElement.getBoundingClientRect().top : 0,
          }}
        />
      </PopoverTrigger>
      <PopoverContent
        className="z-[10000] max-w-sm rounded-xl border border-[hsl(var(--border-subtle))] bg-surface-raised p-block text-ink shadow-raised"
        align="start"
        sideOffset={24}
        onOpenAutoFocus={(e) => e.preventDefault()}
        forceMount
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="event-title flex items-center gap-2 font-display text-display-sm leading-tight text-ink">
              {item.title}
              {isTask ? (
                <>
                  {taskItem?.isRecurring && (
                    <IoRepeat
                      className="h-4 w-4 text-ink-mute"
                      title="Recurring task"
                    />
                  )}
                  {taskItem?.scheduleLocked && (
                    <IoLockClosedOutline
                      className="h-4 w-4 text-ink-mute"
                      title="Schedule locked"
                    />
                  )}
                </>
              ) : (
                eventItem?.isRecurring && (
                  <IoRepeat
                    className="h-4 w-4 text-ink-mute"
                    title="Recurring event"
                  />
                )
              )}
            </h3>
            <div className="flex items-center gap-1">
              {isTask && taskItem && onStatusChange && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    onStatusChange(
                      taskItem.id,
                      taskItem.status === TaskStatus.COMPLETED
                        ? TaskStatus.TODO
                        : TaskStatus.COMPLETED
                    )
                  }
                  className={cn(
                    "h-7 w-7",
                    taskItem.status === TaskStatus.COMPLETED
                      ? "bg-[hsl(var(--state-complete)/0.25)] text-[hsl(var(--state-complete))] hover:bg-[hsl(var(--state-complete)/0.35)]"
                      : "text-ink-mute hover:text-[hsl(var(--state-complete))]"
                  )}
                  title={
                    taskItem.status === TaskStatus.COMPLETED
                      ? "Mark as todo"
                      : "Mark as completed"
                  }
                >
                  <HiCheck className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={onEdit}
                className="h-7 w-7 text-ink-mute"
                title="Edit"
              >
                <HiPencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onDelete}
                className="h-7 w-7 text-ink-mute hover:text-[hsl(var(--urgency-now))]"
                title="Delete"
              >
                <HiTrash className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!isTask && eventItem && (
            <div className="space-y-2 text-ink-soft">
              <div className="flex items-center gap-2">
                <IoTimeOutline className="h-4 w-4 flex-shrink-0 text-ink-mute" />
                <span className="font-mono text-body-sm">
                  {format(newDate(eventItem.start), "PPp")} -{" "}
                  {format(
                    newDate(eventItem.end),
                    eventItem.allDay ? "PP" : "p"
                  )}
                </span>
              </div>
              {eventItem.location && (
                <div className="flex items-center gap-2">
                  <IoLocationOutline className="h-4 w-4 flex-shrink-0 text-ink-mute" />
                  <span className="event-location line-clamp-2 text-body-sm text-ink-soft">
                    {eventItem.location}
                  </span>
                </div>
              )}
              {eventItem.attendees && eventItem.attendees.length > 0 && (
                <div className="flex items-start gap-2">
                  <IoPeopleOutline className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-mute" />
                  <div className="flex-1">
                    {eventItem.attendees.map((attendee) => (
                      <div
                        key={attendee.email}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="event-attendees flex-1 truncate text-ink-soft">
                          {attendee.name || attendee.email}
                        </span>
                        <span
                          className={cn(
                            "ml-2 flex-shrink-0 text-meta uppercase tracking-wide",
                            getStatusColor(attendee.status)
                          )}
                        >
                          {attendee.status?.toLowerCase() || "pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {eventItem.description && (
                <div className="event-description mt-2 line-clamp-2 text-body-sm text-ink-soft leading-relaxed">
                  {eventItem.description}
                </div>
              )}
            </div>
          )}

          {isTask && taskItem && (
            <div className="space-y-2 text-body-sm text-ink-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IoTimeOutline className="h-4 w-4 flex-shrink-0 text-ink-mute" />
                  {taskItem.dueDate ? (
                    <span
                      className={cn(
                        "font-mono text-body-sm",
                        isOverdue && "font-medium text-[hsl(var(--urgency-now))]",
                        !isOverdue && isFutureDate(taskItem.dueDate) && "font-medium text-action"
                      )}
                    >
                      Due {format(newDate(taskItem.dueDate), "PPp")}
                      {isOverdue && " · slipped"}
                      {isFutureDate(taskItem.dueDate) && " · upcoming"}
                    </span>
                  ) : (
                    <span className="font-mono text-body-sm">No due date</span>
                  )}
                </div>
                <span
                  className={cn("rounded-full px-2 py-0.5 text-meta uppercase tracking-wide", {
                    "bg-[hsl(var(--state-complete)/0.25)] text-[hsl(var(--state-complete))]":
                      taskItem.status === TaskStatus.COMPLETED,
                    "bg-[hsl(var(--state-in-progress)/0.18)] text-[hsl(var(--state-in-progress))]":
                      taskItem.status === TaskStatus.IN_PROGRESS,
                    "bg-surface-sunken text-ink-mute":
                      taskItem.status === TaskStatus.TODO,
                  })}
                >
                  {taskItem.status.toLowerCase().replace("_", " ")}
                </span>
              </div>

              {taskItem.startDate && (
                <div className="flex items-center gap-2">
                  <IoCalendarOutline className="h-4 w-4 flex-shrink-0 text-ink-mute" />
                  <span
                    className={cn(
                      "font-mono text-body-sm",
                      isFutureDate(taskItem.startDate) && "font-medium text-action"
                    )}
                  >
                    Starts {format(newDate(taskItem.startDate), "PPp")}
                    {isFutureDate(taskItem.startDate) && " (UPCOMING)"}
                  </span>
                </div>
              )}

              {taskItem.priority && (
                <div className="flex items-center gap-2">
                  <IoFlagOutline className="h-4 w-4 flex-shrink-0 text-ink-mute" />
                  <span
                    className={cn(
                      "text-body-sm",
                      priorityColors[taskItem.priority]
                    )}
                  >
                    {taskItem.priority.charAt(0).toUpperCase() +
                      taskItem.priority.slice(1)}{" "}
                    Priority
                  </span>
                </div>
              )}

              {taskItem.isAutoScheduled &&
                taskItem.scheduledStart &&
                taskItem.scheduledEnd && (
                  <div className="flex items-center gap-2">
                    <IoCalendarOutline className="h-4 w-4 flex-shrink-0 text-ink-mute" />
                    <div className="flex-1">
                      <div className="font-mono text-body-sm">
                        Scheduled:{" "}
                        {format(newDate(taskItem.scheduledStart), "PPp")} -{" "}
                        {format(newDate(taskItem.scheduledEnd), "p")}
                      </div>
                      {taskItem.scheduleScore !== undefined && (
                        <div className="font-mono text-meta text-ink-mute">
                          Confidence:{" "}
                          {Math.round((taskItem.scheduleScore ?? 0) * 100)}%
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {taskItem.project && (
                <div className="flex items-center gap-2">
                  <IoFolderOutline className="h-4 w-4 flex-shrink-0 text-ink-mute" />
                  <span
                    className="rounded px-2 py-0.5 text-meta uppercase tracking-wide"
                    style={{
                      backgroundColor:
                        (taskItem.project.color || "hsl(var(--action))") +
                        "20",
                      color: taskItem.project.color || "hsl(var(--action))",
                    }}
                  >
                    {taskItem.project.name}
                  </span>
                </div>
              )}

              {taskItem.duration && (
                <div className="flex items-center gap-2">
                  <IoTimeOutline className="h-4 w-4 flex-shrink-0 text-ink-mute" />
                  <span className="font-mono text-body-sm">Duration: {taskItem.duration} minutes</span>
                </div>
              )}

              {taskItem.tags && taskItem.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {taskItem.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-meta uppercase tracking-wide"
                      style={{
                        backgroundColor:
                          (tag.color || "hsl(var(--action))") + "20",
                        color: tag.color || "hsl(var(--action))",
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {taskItem.description && (
                <div className="task-description mt-2 line-clamp-2 text-body-sm text-ink-soft leading-relaxed">
                  {taskItem.description}
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
