import { useCallback, useEffect, useRef, useState } from "react";

import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
} from "@fullcalendar/core";
import type { DateSelectArg } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { toast } from "sonner";

import { TaskModal } from "@/components/tasks/TaskModal";

import { useEventModalStore } from "@/lib/commands/groups/calendar";
import { newDate } from "@/lib/date-utils";

import { useCalendarStore } from "@/store/calendar";
import { useSettingsStore } from "@/store/settings";
import { useTaskStore } from "@/store/task";

import { CalendarEvent, ExtendedEventProps } from "@/types/calendar";
import { Task, TaskStatus } from "@/types/task";

import { CalendarEventContent } from "./CalendarEventContent";
import { EventModal } from "./EventModal";
import { EventQuickView } from "./EventQuickView";

interface WeekViewProps {
  currentDate: Date;
  onDateClick?: (date: Date) => void;
}

export function WeekView({ currentDate, onDateClick }: WeekViewProps) {
  const { feeds, getAllCalendarItems, isLoading, removeEvent } =
    useCalendarStore();
  const { user: userSettings, calendar: calendarSettings } = useSettingsStore();
  const { updateTask } = useTaskStore();
  const [selectedEvent, setSelectedEvent] = useState<Partial<CalendarEvent>>();
  const [selectedTask, setSelectedTask] = useState<Task>();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedEndDate, setSelectedEndDate] = useState<Date>();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [events, setEvents] = useState<
    Array<{
      id: string;
      title: string;
      start: Date;
      end: Date;
      location?: string;
      backgroundColor: string;
      borderColor: string;
      allDay: boolean;
      classNames: string[];
      extendedProps?: ExtendedEventProps;
    }>
  >([]);
  const calendarRef = useRef<FullCalendar>(null);
  const tasks = useTaskStore((state) => state.tasks);
  const [quickViewItem, setQuickViewItem] = useState<CalendarEvent | Task>();
  const [isTask, setIsTask] = useState(false);
  const eventModalStore = useEventModalStore();
  const [clickedElement, setClickedElement] = useState<HTMLElement | null>(null);

  // Update events when the calendar view changes
  const handleDatesSet = useCallback(
    async (arg: DatesSetArg) => {
      // Get all calendar items with current task data
      const items = getAllCalendarItems(arg.start, arg.end);
      const formattedItems = items
        .filter((item) => {
          if (item.feedId === "tasks") return true;
          const feed = feeds.find((f) => f.id === item.feedId);
          return feed?.enabled;
        })
        .map((item) => ({
          id: item.id,
          title: item.title,
          start: newDate(item.start),
          end: newDate(item.end),
          location: item.location,
          backgroundColor:
            item.feedId === "tasks"
              ? item.color || "#4f46e5"
              : feeds.find((f) => f.id === item.feedId)?.color || "#3b82f6",
          borderColor:
            item.feedId === "tasks"
              ? item.color || "#4f46e5"
              : feeds.find((f) => f.id === item.feedId)?.color || "#3b82f6",
          allDay: item.allDay,
          classNames: [
            item.extendedProps?.isTask ? "calendar-task" : "calendar-event",
          ],
          // Store the original event data
          extendedProps: {
            ...item,
            // Bring important flags to top level of extendedProps for easy access
            isTask: item.extendedProps?.isTask,
            isRecurring: item.isRecurring,
            status: item.extendedProps?.status,
            priority: item.extendedProps?.priority,
          },
        }));

      // console.log("Setting formatted calendar items:", {
      //   total: formattedItems.length,
      //   tasks: formattedItems.filter((item) => item.extendedProps?.isTask)
      //     .length,
      //   events: formattedItems.filter((item) => !item.extendedProps?.isTask)
      //     .length,
      // });
      setEvents(formattedItems);
    },
    [feeds, getAllCalendarItems]
  );

  // Initial data load
  useEffect(() => {
    Promise.all([
      useCalendarStore.getState().loadFromDatabase(),
      useTaskStore.getState().fetchTasks(),
    ]);
  }, []);

  // Update items when loading state changes, feeds change, or tasks change
  useEffect(() => {
    if (!isLoading && calendarRef.current) {
      console.log("Updating calendar items due to dependency change");
      const calendar = calendarRef.current.getApi();
      handleDatesSet({
        start: calendar.view.activeStart,
        end: calendar.view.activeEnd,
        startStr: calendar.view.activeStart.toISOString(),
        endStr: calendar.view.activeEnd.toISOString(),
        timeZone: userSettings.timeZone,
        view: calendar.view,
      });
    }
  }, [isLoading, feeds, userSettings.timeZone, handleDatesSet, tasks]);

  // Update calendar date when currentDate changes
  useEffect(() => {
    if (calendarRef.current) {
      setTimeout(() => {
        if (calendarRef.current) {
          const calendar = calendarRef.current.getApi();
          calendar.gotoDate(currentDate);
        }
      }, 0);
    }
  }, [currentDate]);

  const handleEventClick = (info: EventClickArg) => {
    const item = info.event.extendedProps;
    const itemId = info.event.id;
    const isTask = item.isTask;

    // Store the clicked element for positioning
    setClickedElement(info.el);

    if (isTask) {
      const task = useTaskStore.getState().tasks.find((t) => t.id === itemId);
      if (task) {
        setQuickViewItem(task);
        setIsTask(true);
      }
    } else {
      const event = useCalendarStore
        .getState()
        .events.find((e) => e.id === itemId);
      setQuickViewItem(event as CalendarEvent);
      setIsTask(false);
    }
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    const start = selectInfo.start;
    const end = selectInfo.allDay ? start : selectInfo.end;

    setSelectedDate(start);
    setSelectedEndDate(end);
    setSelectedEvent({
      allDay: selectInfo.allDay,
    });
    setIsEventModalOpen(true);
  };

  const handleEventModalClose = () => {
    setIsEventModalOpen(false);
    eventModalStore.setOpen(false);
    setSelectedEvent(undefined);
    setSelectedDate(undefined);
    setSelectedEndDate(undefined);
    eventModalStore.setDefaultDate(undefined);
    eventModalStore.setDefaultEndDate(undefined);
  };

  const handleTaskModalClose = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(undefined);
  };

  const handleQuickViewClose = () => {
    setQuickViewItem(undefined);
    setClickedElement(null);
  };

  const handleQuickViewEdit = () => {
    if (!quickViewItem) return;

    if (isTask) {
      // It's a task
      setSelectedTask(quickViewItem as Task);
      setIsTaskModalOpen(true);
    } else {
      // It's an event
      setSelectedEvent(quickViewItem as CalendarEvent);
      setIsEventModalOpen(true);
    }
    handleQuickViewClose();
  };

  const handleQuickViewDelete = async () => {
    if (!quickViewItem) return;

    if (isTask) {
      if (confirm("Are you sure you want to delete this task?")) {
        try {
          await useTaskStore.getState().deleteTask(quickViewItem.id);
          handleQuickViewClose();
        } catch (e) {
          console.error("deleteTask failed", e);
          toast.error(
            e instanceof Error ? e.message : "Failed to delete task",
          );
        }
      }
    } else {
      if (confirm("Are you sure you want to delete this event?")) {
        try {
          await removeEvent(
            quickViewItem.id,
            quickViewItem.isRecurring ? "series" : "single",
          );
          handleQuickViewClose();
        } catch (e) {
          console.error("removeEvent failed", e);
          toast.error(
            e instanceof Error ? e.message : "Failed to delete event",
          );
        }
      }
    }
  };

  const handleQuickViewStatusChange = async (
    taskId: string,
    status: TaskStatus
  ) => {
    if (!quickViewItem) return;

    await updateTask(taskId, { status });

    // Update the quick view item to reflect the new status
    if (isTask) {
      const updatedTask = useTaskStore
        .getState()
        .tasks.find((t) => t.id === taskId);
      if (updatedTask) {
        setQuickViewItem(updatedTask);
      }
    }
  };

  const renderEventContent = useCallback(
    (arg: EventContentArg) => <CalendarEventContent eventInfo={arg} />,
    []
  );

  return (
    <div className={[
      "h-full",
      // Slot sizing
      "[&_.fc-daygrid-day-events]:!min-h-0",
      "[&_.fc-daygrid-day-frame]:!min-h-0",
      "[&_.fc-timegrid-slot]:!h-[35px]",
      // Hour gutter: mono, uppercase, muted — wider tap target on mobile
      "[&_.fc-timegrid-slot-label]:!py-1",
      "[&_.fc-timegrid-axis-cushion]:!py-1",
      "[&_.fc-timegrid-slot-label-cushion]:font-mono",
      "[&_.fc-timegrid-slot-label-cushion]:text-[11px]",
      "[&_.fc-timegrid-slot-label-cushion]:uppercase",
      "[&_.fc-timegrid-slot-label-cushion]:tracking-wide",
      "[&_.fc-timegrid-slot-label-cushion]:text-ink-mute",
      "sm:[&_.fc-timegrid-slot-label]:!min-w-[52px]",
      // Alternating row tint for visual rhythm
      "[&_.fc-timegrid-slot:nth-child(even)]:bg-surface-sunken/30",
      // Hover on hour cells
      "[&_.fc-timegrid-slot:hover]:bg-action/[0.04]",
      // Now indicator: action color (terracotta hairline via CSS var override)
      "[&_.fc-timegrid-now-indicator-line]:!border-action",
      "[&_.fc-timegrid-now-indicator-line]:!border-t",
      "[&_.fc-timegrid-now-indicator-arrow]:!border-action",
      // Today column: very subtle action tint
      "[&_.fc-day-today]:!bg-action/[0.03]",
      // Day-of-week column headers: display serif for weekday name
      "[&_.fc-col-header-cell-cushion]:font-display",
      // Today's column header text: action color
      "[&_.fc-day-today_.fc-col-header-cell-cushion]:text-action",
      // Mobile: horizontal scroll with snap on day columns
      "sm:[&_.fc-scrollgrid]:overflow-x-auto",
      "sm:[&_.fc-col-header]:scroll-snap-type-x-mandatory",
      "sm:[&_.fc-col-header-cell]:scroll-snap-align-start",
    ].join(" ")}>
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={false}
        initialDate={currentDate}
        events={events}
        nowIndicator={true}
        allDaySlot={true}
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        scrollTime={calendarSettings.workingHours.start}
        expandRows={true}
        slotEventOverlap={true}
        stickyHeaderDates={true}
        slotDuration="00:30:00"
        timeZone="local"
        displayEventEnd={true}
        eventTimeFormat={{
          hour: userSettings.timeFormat === "12h" ? "numeric" : "2-digit",
          minute: "2-digit",
          meridiem: userSettings.timeFormat === "12h" ? "short" : false,
          hour12: userSettings.timeFormat === "12h",
        }}
        slotLabelFormat={{
          hour: userSettings.timeFormat === "12h" ? "numeric" : "2-digit",
          minute: "2-digit",
          meridiem: userSettings.timeFormat === "12h" ? "short" : false,
          hour12: userSettings.timeFormat === "12h",
        }}
        firstDay={userSettings.weekStartDay === "monday" ? 1 : 0}
        businessHours={{
          daysOfWeek: calendarSettings.workingHours.enabled
            ? calendarSettings.workingHours.days
            : [0, 1, 2, 3, 4, 5, 6],
          startTime: calendarSettings.workingHours.start,
          endTime: calendarSettings.workingHours.end,
        }}
        dayHeaderFormat={{
          weekday: "short",
          month: "numeric",
          day: "numeric",
          omitCommas: true,
        }}
        height="100%"
        dateClick={(arg) => onDateClick?.(arg.date)}
        eventClick={handleEventClick}
        select={handleDateSelect}
        selectable={true}
        selectMirror={true}
        datesSet={handleDatesSet}
        eventContent={renderEventContent}
      />
      {quickViewItem && (
        <EventQuickView
          isOpen={!!quickViewItem}
          onClose={handleQuickViewClose}
          item={quickViewItem}
          onEdit={handleQuickViewEdit}
          onDelete={handleQuickViewDelete}
          onStatusChange={handleQuickViewStatusChange}
          referenceElement={clickedElement}
          isTask={isTask}
        />
      )}
      <EventModal
        isOpen={isEventModalOpen || eventModalStore.isOpen}
        onClose={handleEventModalClose}
        event={selectedEvent}
        defaultDate={selectedDate || eventModalStore.defaultDate}
        defaultEndDate={selectedEndDate || eventModalStore.defaultEndDate}
      />

      {selectedTask && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={handleTaskModalClose}
          task={selectedTask}
          tags={useTaskStore.getState().tags}
          onSave={async (updates) => {
            await updateTask(selectedTask.id, updates);
            handleTaskModalClose();
          }}
          onCreateTag={async (name: string, color?: string) => {
            return useTaskStore.getState().createTag({ name, color });
          }}
        />
      )}
    </div>
  );
}
