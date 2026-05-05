import { memo } from "react";

import type { EventContentArg } from "@fullcalendar/core";
import { IoCheckmarkCircle, IoRepeat, IoTimeOutline } from "react-icons/io5";

import { isTaskOverdue } from "@/lib/task-utils";
import { cn } from "@/lib/utils";

import { Priority, TaskStatus } from "@/types/task";

interface CalendarEventContentProps {
  eventInfo: EventContentArg;
}

const priorityColors = {
  [Priority.HIGH]: "border-urgency-now",
  [Priority.MEDIUM]: "border-urgency-soon",
  [Priority.LOW]: "border-state-in-progress",
  [Priority.NONE]: "border-ink-mute",
};

export const CalendarEventContent = memo(function CalendarEventContent({
  eventInfo,
}: CalendarEventContentProps) {
  const isTask = eventInfo.event.extendedProps.isTask;
  const isRecurring = eventInfo.event.extendedProps.isRecurring;
  const status = eventInfo.event.extendedProps.status;
  const priority = eventInfo.event.extendedProps.priority;
  const location = eventInfo.event.extendedProps.location;
  const dueDate = eventInfo.event.extendedProps?.extendedProps?.dueDate;
  const title = eventInfo.event.title;
  const endTime = eventInfo.event.end?.getTime() ?? 0;
  const startTime = eventInfo.event.start?.getTime() ?? 0;
  const duration = endTime - startTime;

  const isOverdue = isTask && isTaskOverdue({ dueDate, status });

  return (
    <div
      data-testid={isTask ? "calendar-task" : "calendar-event"}
      className={cn(
        "flex h-full flex-col justify-start gap-1 overflow-hidden rounded-md bg-dom-dust-soft p-2 text-[11px] shadow-card",
        "border-l-2 border-dom-dust text-ink",
        isTask && priority && priorityColors[priority as Priority],
        isTask &&
          !priority && {
            "border-state-complete": status === TaskStatus.COMPLETED,
            "border-state-in-progress": status === TaskStatus.IN_PROGRESS,
            "border-ink-mute": status === TaskStatus.TODO,
          },
        isOverdue && "border-urgency-now font-medium text-urgency-now",
        status === TaskStatus.COMPLETED && "text-ink-mute line-through"
      )}
    >
      <div className="flex w-full items-center gap-1.5">
        {isTask ? (
          <IoCheckmarkCircle className="h-3.5 w-3.5 flex-shrink-0 text-current opacity-75" />
        ) : isRecurring ? (
          <IoRepeat className="h-3.5 w-3.5 flex-shrink-0 text-current opacity-75" />
        ) : (
          <IoTimeOutline className="h-3.5 w-3.5 flex-shrink-0 text-current opacity-75" />
        )}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "calendar-event-title text-body-sm font-medium text-ink leading-snug",
              duration <= 1800000 ? "truncate" : "line-clamp-2 break-words"
            )}
          >
            {title}
          </div>
        </div>
      </div>
      {location && duration > 1800000 && (
        <div className="event-location truncate pl-5 font-mono text-[10px] text-ink-mute leading-snug">
          {location}
        </div>
      )}
    </div>
  );
});
