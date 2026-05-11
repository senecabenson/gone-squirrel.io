"use client";

import { useEffect, useRef } from "react";

import {
  PiCaretLeftBold,
  PiCaretRightBold,
  PiSidebarSimpleDuotone,
  PiSparkleDuotone,
} from "react-icons/pi";

import { DayView } from "@/components/calendar/DayView";
import { FeedManager } from "@/components/calendar/FeedManager";
import { MonthView } from "@/components/calendar/MonthView";
import { MultiMonthView } from "@/components/calendar/MultiMonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { Button } from "@/components/ui/button";

import { format, isSameDay } from "date-fns";

import { addDays, newDate, subDays } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

import {
  useCalendarStore,
  useCalendarUIStore,
  useViewStore,
} from "@/store/calendar";
import { useSettingsStore } from "@/store/settings";
import { useTaskStore } from "@/store/task";

import { CalendarEvent, CalendarFeed } from "@/types/calendar";

interface CalendarProps {
  initialFeeds?: CalendarFeed[];
  initialEvents?: CalendarEvent[];
}

const VIEWS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "multiMonth", label: "Year" },
] as const;

export function Calendar({
  initialFeeds = [],
  initialEvents = [],
}: CalendarProps) {
  const { date: currentDate, setDate, view, setView } = useViewStore();
  const { isSidebarOpen, setSidebarOpen, isHydrated } = useCalendarUIStore();
  const { scheduleAllTasks } = useTaskStore();
  const { setFeeds, setEvents } = useCalendarStore();
  const { integrations } = useSettingsStore();
  const googleAutoSync =
    integrations.googleCalendar.enabled &&
    integrations.googleCalendar.autoSync;
  const googleSyncMinutes = integrations.googleCalendar.syncInterval;
  const lastPullRef = useRef<number>(0);

  useEffect(() => {
    if (initialFeeds.length > 0) setFeeds(initialFeeds);
    if (initialEvents.length > 0) setEvents(initialEvents);
    if (!initialFeeds.length || !initialEvents.length) {
      useCalendarStore.getState().loadFromDatabase();
    }
    useTaskStore.getState().fetchTasks();
  }, [initialFeeds, initialEvents, setFeeds, setEvents]);

  // Two-way pull: keep the UI in sync with external Google Calendar changes
  // (mobile, web, other MCPs). Settings already exposes the toggle/interval
  // but the timer only starts when a user *toggles* the setting — never on
  // mount. So we own the boot-time interval here, plus refresh on focus.
  useEffect(() => {
    const MIN_GAP_MS = 30_000;
    let cancelled = false;

    const pull = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      const now = Date.now();
      if (now - lastPullRef.current < MIN_GAP_MS) return;
      lastPullRef.current = now;
      try {
        await useCalendarStore.getState().syncAllFeeds();
      } catch (e) {
        // syncAllFeeds already sets error state in the store; just log.
        console.error("syncAllFeeds (background) failed", e);
      }
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (googleAutoSync && googleSyncMinutes > 0) {
      intervalId = setInterval(pull, googleSyncMinutes * 60 * 1000);
    }

    const onVisible = () => {
      if (!document.hidden) pull();
    };
    const onFocus = () => pull();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [googleAutoSync, googleSyncMinutes]);

  const handlePrev = () => {
    if (view === "month" || view === "multiMonth") {
      const next = new Date(currentDate);
      next.setMonth(next.getMonth() - 1);
      setDate(next);
    } else {
      setDate(subDays(currentDate, view === "day" ? 1 : 7));
    }
  };

  const handleNext = () => {
    if (view === "month" || view === "multiMonth") {
      const next = new Date(currentDate);
      next.setMonth(next.getMonth() + 1);
      setDate(next);
    } else {
      setDate(addDays(currentDate, view === "day" ? 1 : 7));
    }
  };

  const handleToday = () => setDate(newDate());
  const handleAutoSchedule = () => scheduleAllTasks();

  const isToday = isSameDay(currentDate, newDate());
  const dateLabel = format(currentDate, "EEEE, MMMM d");
  const yearLabel = format(currentDate, "yyyy");

  return (
    <div className="flex h-full w-full bg-canvas">
      {/* Sidebar — desktop only */}
      <aside
        className={cn(
          "hidden md:flex h-full w-72 flex-none flex-col border-r border-[hsl(var(--border-subtle))] bg-canvas",
          "transform transition-transform duration-200 ease-out",
          !isHydrated && "opacity-0 duration-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ marginLeft: isSidebarOpen ? 0 : "-18rem" }}
      >
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto">
            <FeedManager />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Editorial header */}
        <header className="flex flex-col gap-3 border-b border-[hsl(var(--border-subtle))] px-block py-block md:flex-row md:items-end md:justify-between md:gap-block">
          <div className="flex items-end gap-3">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="hidden h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink md:inline-flex"
              title="Toggle sidebar (b)"
              aria-label="Toggle sidebar"
            >
              <PiSidebarSimpleDuotone className="h-5 w-5" />
            </button>

            <div className="flex flex-col">
              <span className="text-meta uppercase tracking-wide text-ink-mute">
                {yearLabel}
              </span>
              <h1 className="font-display text-display-sm leading-tight tracking-[-0.014em] text-ink md:text-display">
                {dateLabel}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-md border border-[hsl(var(--border-subtle))] bg-surface-sunken/40 p-0.5">
              <button
                onClick={handlePrev}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                data-testid="calendar-prev-week"
                title="Previous (←)"
                aria-label="Previous"
              >
                <PiCaretLeftBold className="h-4 w-4" />
              </button>
              <button
                onClick={handleToday}
                disabled={isToday}
                className={cn(
                  "h-8 rounded-sm px-3 text-body-sm font-medium transition-colors",
                  isToday
                    ? "text-ink-mute"
                    : "text-ink-soft hover:bg-surface hover:text-ink"
                )}
                title="Today (t)"
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-soft transition-colors hover:bg-surface hover:text-ink"
                data-testid="calendar-next-week"
                title="Next (→)"
                aria-label="Next"
              >
                <PiCaretRightBold className="h-4 w-4" />
              </button>
            </div>

            {/* View switcher */}
            <div className="flex items-center gap-0.5 rounded-md border border-[hsl(var(--border-subtle))] bg-surface-sunken/40 p-0.5">
              {VIEWS.map((v) => {
                const active = view === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setView(v.id)}
                    className={cn(
                      "h-8 rounded-sm px-3 text-body-sm font-medium transition-colors",
                      active
                        ? "bg-surface text-ink shadow-card"
                        : "text-ink-soft hover:text-ink"
                    )}
                    aria-pressed={active}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>

            {/* Auto-schedule — secondary, sage tone, not the primary action accent */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAutoSchedule}
              className="gap-1.5"
            >
              <PiSparkleDuotone className="h-4 w-4" aria-hidden="true" />
              Auto-schedule
            </Button>
          </div>
        </header>

        {/* Grid */}
        <div className="flex-1 overflow-hidden">
          {view === "day" ? (
            <DayView currentDate={currentDate} onDateClick={setDate} />
          ) : view === "week" ? (
            <WeekView currentDate={currentDate} onDateClick={setDate} />
          ) : view === "month" ? (
            <MonthView currentDate={currentDate} onDateClick={setDate} />
          ) : (
            <MultiMonthView currentDate={currentDate} onDateClick={setDate} />
          )}
        </div>
      </main>
    </div>
  );
}
