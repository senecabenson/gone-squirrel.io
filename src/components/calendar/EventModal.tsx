"use client";

import { useEffect, useRef, useState } from "react";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";

import { formatToLocalISOString, newDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

import { useCalendarStore } from "@/store/calendar";
import { useSettingsStore } from "@/store/settings";

import { CalendarEvent } from "@/types/calendar";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: Partial<CalendarEvent>;
  defaultDate?: Date;
  defaultEndDate?: Date;
}

// Google Calendar recurrence rules
const FREQUENCIES = {
  NONE: "NONE",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
} as const;

type Frequency = (typeof FREQUENCIES)[keyof typeof FREQUENCIES];

// RRule weekday codes
const WEEKDAYS = {
  SU: "Sunday",
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
} as const;

// Helper function to parse recurrence rule
function parseRecurrenceRule(rule?: string) {
  if (!rule) return { freq: FREQUENCIES.NONE, interval: 1, byDay: [] };

  // Remove RRULE: prefix and any array wrapper
  rule = rule.replace(/^\[?"?RRULE:/i, "").replace(/"?\]?$/, "");

  const parts = rule.split(";");
  const result = {
    freq: FREQUENCIES.NONE as Frequency,
    interval: 1,
    byDay: [] as string[],
  };

  parts.forEach((part) => {
    const [key, value] = part.split("=");
    switch (key) {
      case "FREQ":
        result.freq = value as Frequency;
        break;
      case "INTERVAL":
        result.interval = parseInt(value, 10);
        break;
      case "BYDAY":
        result.byDay = value.split(",");
        break;
    }
  });

  return result;
}

// Helper function to build recurrence rule
function buildRecurrenceRule(freq: string, interval: number, byDay: string[]) {
  if (freq === FREQUENCIES.NONE) return "";

  const parts = [];

  // Add frequency
  if (Object.values(FREQUENCIES).includes(freq as Frequency)) {
    parts.push(`FREQ=${freq}`);
  }

  // Add interval if greater than 1
  if (interval > 1) {
    parts.push(`INTERVAL=${interval}`);
  }

  // Add BYDAY for weekly recurrence
  if (freq === FREQUENCIES.WEEKLY && byDay.length > 0) {
    // byDay should already be in RRule format (MO, TU, etc.)
    console.log("Building RRule with weekdays:", byDay);
    parts.push(`BYDAY=${byDay.join(",")}`);
  }

  const rule = parts.join(";");
  console.log("Built RRule:", rule);
  return rule;
}

export function EventModal({
  isOpen,
  onClose,
  event,
  defaultDate,
  defaultEndDate,
}: EventModalProps) {
  const { feeds, addEvent, updateEvent, removeEvent } = useCalendarStore();
  const { calendar } = useSettingsStore();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false);
  const [editMode, setEditMode] = useState<"single" | "series">();
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [location, setLocation] = useState(event?.location || "");
  const [startDate, setStartDate] = useState<Date>(
    event?.start
      ? newDate(event.start)
      : defaultDate
        ? newDate(defaultDate)
        : newDate()
  );
  const [endDate, setEndDate] = useState<Date>(
    event?.end
      ? newDate(event.end)
      : defaultEndDate
        ? newDate(defaultEndDate)
        : newDate(Date.now() + 3600000)
  );
  const [selectedFeedId, setSelectedFeedId] = useState<string>(
    event?.feedId || calendar.defaultCalendarId || ""
  );
  const [isAllDay, setIsAllDay] = useState(event?.allDay || false);
  const [isRecurring, setIsRecurring] = useState(event?.isRecurring || false);
  const [recurrenceFreq, setRecurrenceFreq] = useState("");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceByDay, setRecurrenceByDay] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(event?.title || "");
      setDescription(event?.description || "");
      setLocation(event?.location || "");
      setStartDate(
        event?.start
          ? newDate(event.start)
          : defaultDate
            ? newDate(defaultDate)
            : newDate()
      );
      setEndDate(
        event?.end
          ? newDate(event.end)
          : defaultEndDate
            ? newDate(defaultEndDate)
            : newDate(Date.now() + 3600000)
      );
      setSelectedFeedId(event?.feedId || calendar.defaultCalendarId || "");
      setIsAllDay(event?.allDay || false);
      setIsRecurring(event?.isRecurring || false);
      const { freq, interval, byDay } = parseRecurrenceRule(
        event?.recurrenceRule
      );
      setRecurrenceFreq(freq || "");
      setRecurrenceInterval(interval);
      setRecurrenceByDay(byDay);
      setEditMode(undefined);
      setShowRecurrenceDialog(false);

      // Focus the title input
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [
    isOpen,
    event,
    defaultDate,
    defaultEndDate,
    feeds,
    calendar.defaultCalendarId,
  ]);

  // Show recurrence dialog when editing a recurring event
  useEffect(() => {
    if (isOpen && event?.isRecurring && !editMode && !showRecurrenceDialog) {
      //todo: we need to handle editing series vs single, for now forcing to always edit series
      // setShowRecurrenceDialog(true);
      setEditMode("series");
    }
  }, [isOpen, event?.isRecurring, editMode, showRecurrenceDialog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const feed = feeds.find((f) => f.id === selectedFeedId);
      if (!feed) {
        console.error("Selected calendar not found");
        return;
      }

      const eventData: Omit<CalendarEvent, "id"> = {
        title,
        description,
        location,
        start: startDate,
        end: endDate,
        feedId: selectedFeedId,
        allDay: isAllDay,
        isRecurring,
        recurrenceRule: isRecurring
          ? buildRecurrenceRule(
              recurrenceFreq,
              recurrenceInterval,
              recurrenceByDay
            )
          : undefined,
        isMaster: false,
      };

      if (event?.id) {
        // For existing events
        if (feed.type === "GOOGLE" && !event.externalEventId) {
          throw new Error("Cannot edit this Google Calendar event");
        }
        await updateEvent(event.id, eventData, editMode);
      } else {
        // For new events
        await addEvent(eventData);
      }
      // Reset all states before closing
      resetState();
      onClose();
    } catch (error) {
      console.error("Failed to save event:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save event",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;

    try {
      setIsSubmitting(true);
      await removeEvent(event.id, editMode);
      resetState();
      onClose();
    } catch (error) {
      console.error("Failed to delete event:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete event",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to render recurrence options
  const renderRecurrenceOptions = () => {
    if (!isRecurring) return null;

    return (
      <div className="bg-surface-sunken rounded-md p-3 space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="recurrence-freq"
            className="text-meta uppercase tracking-wide text-ink-mute mb-1"
          >
            Repeats
          </Label>
          <Select
            value={recurrenceFreq || FREQUENCIES.WEEKLY}
            onValueChange={(value) =>
              setRecurrenceFreq(value === FREQUENCIES.NONE ? "" : value)
            }
          >
            <SelectTrigger id="recurrence-freq" data-testid="recurrence-freq">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FREQUENCIES.DAILY}>Daily</SelectItem>
              <SelectItem value={FREQUENCIES.WEEKLY}>Weekly</SelectItem>
              <SelectItem value={FREQUENCIES.MONTHLY}>Monthly</SelectItem>
              <SelectItem value={FREQUENCIES.YEARLY}>Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {recurrenceFreq && recurrenceFreq !== FREQUENCIES.NONE && (
          <>
            <div className="space-y-2">
              <Label
                htmlFor="recurrence-interval"
                className="text-meta uppercase tracking-wide text-ink-mute mb-1"
              >
                Repeat every
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  id="recurrence-interval"
                  min="1"
                  value={recurrenceInterval}
                  onChange={(e) =>
                    setRecurrenceInterval(
                      Math.max(1, parseInt(e.target.value, 10))
                    )
                  }
                  className="w-20"
                />
                <span className="text-body-sm text-ink">
                  {recurrenceFreq.toLowerCase()}
                  {recurrenceInterval > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {recurrenceFreq === FREQUENCIES.WEEKLY && (
              <div className="space-y-2">
                <Label className="text-meta uppercase tracking-wide text-ink-mute mb-1">
                  Repeat on
                </Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(WEEKDAYS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <Checkbox
                        checked={recurrenceByDay.includes(key)}
                        onCheckedChange={(checked) => {
                          setRecurrenceByDay(
                            checked
                              ? [...recurrenceByDay, key]
                              : recurrenceByDay.filter((d) => d !== key)
                          );
                        }}
                      />
                      <span className="text-body-sm text-ink">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden">
          {isSubmitting && <LoadingOverlay />}
          <DialogHeader>
            <DialogTitle>{event?.id ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-0 overflow-y-auto"
          >
            <div className="space-y-block px-1 pb-4">
              {/* Title */}
              <div className="space-y-2">
                <Label
                  htmlFor="title"
                  className="text-meta uppercase tracking-wide text-ink-mute mb-1"
                >
                  Title
                </Label>
                <Input
                  type="text"
                  id="title"
                  ref={titleInputRef}
                  data-testid="event-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="event-title"
                  required
                />
              </div>

              {/* Calendar */}
              <div className="space-y-2">
                <Label
                  htmlFor="calendar"
                  className="text-meta uppercase tracking-wide text-ink-mute mb-1"
                >
                  Calendar
                </Label>
                <Select
                  value={selectedFeedId}
                  onValueChange={(value) => setSelectedFeedId(value)}
                  disabled={!!event?.id}
                >
                  <SelectTrigger id="calendar" data-testid="calendar-select">
                    <SelectValue placeholder="Select a calendar" />
                  </SelectTrigger>
                  <SelectContent>
                    {feeds
                      .filter((feed) => feed.enabled)
                      .map((feed) => (
                        <SelectItem key={feed.id} value={feed.id}>
                          {feed.name} {feed.type === "GOOGLE" ? "(Google)" : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* When */}
              <div className="space-y-2">
                <Label className="text-meta uppercase tracking-wide text-ink-mute mb-1">
                  When
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start" className="text-ink-soft">
                      Start
                    </Label>
                    <Input
                      type={isAllDay ? "date" : "datetime-local"}
                      id="start"
                      data-testid="event-start-date"
                      value={
                        isAllDay
                          ? formatToLocalISOString(startDate).split("T")[0]
                          : formatToLocalISOString(startDate)
                      }
                      onChange={(e) => setStartDate(newDate(e.target.value))}
                      className={cn(
                        "cursor-pointer px-3 py-2",
                        "[&::-webkit-calendar-picker-indicator]:ml-auto",
                        "[&::-webkit-calendar-picker-indicator]:mr-1",
                        "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
                        "[&::-webkit-calendar-picker-indicator]:rounded-md",
                        "[&::-webkit-calendar-picker-indicator]:hover:bg-accent",
                        "[&::-webkit-calendar-picker-indicator]:dark:invert",
                        "[&::-webkit-datetime-edit]:text-foreground",
                        "[&::-webkit-datetime-edit-fields-wrapper]:p-0"
                      )}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end" className="text-ink-soft">
                      End
                    </Label>
                    <Input
                      type={isAllDay ? "date" : "datetime-local"}
                      id="end"
                      data-testid="event-end-date"
                      value={
                        isAllDay
                          ? formatToLocalISOString(endDate).split("T")[0]
                          : formatToLocalISOString(endDate)
                      }
                      onChange={(e) => setEndDate(newDate(e.target.value))}
                      className={cn(
                        "cursor-pointer px-3 py-2",
                        "[&::-webkit-calendar-picker-indicator]:ml-auto",
                        "[&::-webkit-calendar-picker-indicator]:mr-1",
                        "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
                        "[&::-webkit-calendar-picker-indicator]:rounded-md",
                        "[&::-webkit-calendar-picker-indicator]:hover:bg-accent",
                        "[&::-webkit-calendar-picker-indicator]:dark:invert",
                        "[&::-webkit-datetime-edit]:text-foreground",
                        "[&::-webkit-datetime-edit-fields-wrapper]:p-0"
                      )}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="all-day"
                    checked={isAllDay}
                    onCheckedChange={(checked) =>
                      setIsAllDay(checked as boolean)
                    }
                  />
                  <Label htmlFor="all-day" className="text-body-sm text-ink">
                    All day
                  </Label>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label
                  htmlFor="location"
                  className="text-meta uppercase tracking-wide text-ink-mute mb-1"
                >
                  Location
                </Label>
                <Input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="event-location"
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
                  data-testid="event-description-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="event-description resize-none"
                />
              </div>

              {/* Repeat */}
              <div className="space-y-2">
                <Label className="text-meta uppercase tracking-wide text-ink-mute mb-1">
                  Repeat
                </Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={isRecurring}
                    onCheckedChange={(checked) => {
                      const isChecked = checked as boolean;
                      setIsRecurring(isChecked);
                      if (
                        isChecked &&
                        (recurrenceFreq === FREQUENCIES.NONE || !recurrenceFreq)
                      ) {
                        setRecurrenceFreq(FREQUENCIES.WEEKLY);
                        const weekdayNum = startDate.getDay();
                        const weekdays = [
                          "SU",
                          "MO",
                          "TU",
                          "WE",
                          "TH",
                          "FR",
                          "SA",
                        ];
                        const weekday = weekdays[weekdayNum];
                        setRecurrenceByDay([weekday]);
                      }
                    }}
                    data-testid="recurring-event-checkbox"
                  />
                  <Label
                    htmlFor="recurring"
                    className="text-body-sm text-ink"
                  >
                    Recurring event
                  </Label>
                </div>
              </div>

              {renderRecurrenceOptions()}
            </div>

            <DialogFooter className="border-t border-[hsl(var(--border-subtle))] pt-4">
              {event?.id ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  data-testid="delete-event-button"
                  className="sm:mr-auto"
                >
                  Delete
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" data-testid="save-event-button">
                {event?.id ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recurring Event Edit Mode Dialog */}
      <AlertDialog.Root
        open={showRecurrenceDialog}
        onOpenChange={(open) => {
          setShowRecurrenceDialog(open);
          if (!open) onClose();
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[10001] bg-background/80 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[10002] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg">
            <AlertDialog.Title className="mb-4 text-lg font-semibold">
              Edit Recurring Event
            </AlertDialog.Title>
            <AlertDialog.Description className="mb-6 text-sm text-muted-foreground">
              Would you like to edit this event or the entire series?
            </AlertDialog.Description>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRecurrenceDialog(false);
                  onClose();
                }}
                data-testid="edit-cancel-button"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setEditMode("single");
                  setShowRecurrenceDialog(false);
                }}
                data-testid="edit-single-event-button"
              >
                This Event
              </Button>
              <Button
                onClick={() => {
                  setEditMode("series");
                  setShowRecurrenceDialog(false);
                }}
                data-testid="edit-series-button"
              >
                Entire Series
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );

  function resetState() {
    setShowRecurrenceDialog(false);
    setEditMode(undefined);
    setTitle("");
    setDescription("");
    setLocation("");
    setStartDate(newDate());
    setEndDate(newDate(Date.now() + 3600000));
    setIsAllDay(false);
    setIsRecurring(false);
    setRecurrenceFreq("");
    setRecurrenceInterval(1);
    setRecurrenceByDay([]);
  }
}
