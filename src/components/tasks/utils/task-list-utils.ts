import {
  format,
  isThisWeek,
  isThisYear,
  isToday,
  isTomorrow,
  newDate,
} from "@/lib/date-utils";

import { Priority, TaskStatus, TimePreference } from "@/types/task";

// Helper function to format enum values for display
export const formatEnumValue = (value: string) => {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Badge variant strings for status (replaces hardcoded Tailwind tints)
export const statusColors: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "default",
  [TaskStatus.IN_PROGRESS]: "state-progress",
  [TaskStatus.COMPLETED]: "state-complete",
};

export type BadgeVariant = string;

export function statusBadgeVariant(status: TaskStatus): BadgeVariant {
  return statusColors[status] ?? "default";
}

export const energyLevelColors: Record<string, string> = {
  high: "dom-clay",
  medium: "dom-mustard",
  low: "dom-sage",
};

export const timePreferenceColors: Record<TimePreference, string> = {
  [TimePreference.MORNING]: "dom-dust",
  [TimePreference.AFTERNOON]: "dom-mustard",
  [TimePreference.EVENING]: "dom-plum",
};

export const priorityColors: Record<Priority, string> = {
  [Priority.HIGH]: "urgency-now",
  [Priority.MEDIUM]: "urgency-soon",
  [Priority.LOW]: "dom-slate",
  [Priority.NONE]: "default",
};

// Format date in a contextual way (Today, Tomorrow, etc.)
export const formatContextualDate = (date: Date) => {
  const now = newDate();
  const isOverdue = date < now && !isToday(date);
  let text;

  if (isToday(date)) {
    text = `Today, ${format(date, "p")}`;
  } else if (isTomorrow(date)) {
    text = `Tomorrow, ${format(date, "p")}`;
  } else if (isThisWeek(date)) {
    text = format(date, "EEEE, p");
  } else if (isThisYear(date)) {
    text = format(date, "MMM d, p");
  } else {
    text = format(date, "MMM d, yyyy, p");
  }

  return { text, isOverdue };
};
