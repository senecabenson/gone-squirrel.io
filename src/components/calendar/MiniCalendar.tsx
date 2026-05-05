import { useState } from "react";

import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
} from "date-fns";
import { PiCaretLeftBold, PiCaretRightBold } from "react-icons/pi";

import { cn } from "@/lib/utils";

interface MiniCalendarProps {
  currentDate: Date;
  onDateClick?: (date: Date) => void;
}

const WEEK_DAYS = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];

export function MiniCalendar({ currentDate, onDateClick }: MiniCalendarProps) {
  const [calendarDate, setCalendarDate] = useState(currentDate);
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfMonth = monthStart.getDay();
  const adjustedFirstDay = firstDayOfMonth === 0 ? 7 : firstDayOfMonth;
  const emptyDays = adjustedFirstDay - 1;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-h2 text-ink">
          {format(calendarDate, "MMMM")}
          <span className="ml-1.5 font-mono text-body-sm font-medium text-ink-mute">
            {format(calendarDate, "yyyy")}
          </span>
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              const next = new Date(calendarDate);
              next.setMonth(next.getMonth() - 1);
              setCalendarDate(next);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
            aria-label="Previous month"
          >
            <PiCaretLeftBold className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              const next = new Date(calendarDate);
              next.setMonth(next.getMonth() + 1);
              setCalendarDate(next);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
            aria-label="Next month"
          >
            <PiCaretRightBold className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {WEEK_DAYS.map((day) => (
          <div
            key={day.key}
            className="flex h-7 items-center justify-center font-mono text-[10px] uppercase tracking-wider text-ink-mute"
          >
            {day.label}
          </div>
        ))}

        {Array.from({ length: emptyDays }).map((_, index) => (
          <div key={`empty-${index}`} className="h-8" />
        ))}

        {days.map((day) => {
          const selected = isSameDay(day, currentDate);
          const today = isToday(day);
          const inMonth = isSameMonth(day, calendarDate);
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateClick?.(day)}
              className="relative flex h-8 items-center justify-center"
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs transition-colors",
                  selected
                    ? "bg-action text-action-on font-semibold"
                    : today
                      ? "text-action font-semibold"
                      : inMonth
                        ? "text-ink hover:bg-surface-sunken"
                        : "text-ink-disabled hover:bg-surface-sunken/60"
                )}
              >
                {format(day, "d")}
              </span>
              {today && !selected && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 h-1 w-1 rounded-full bg-action"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
