import { useCallback, useState } from "react";

import { BsArrowRepeat, BsGoogle, BsMicrosoft, BsPlus, BsThreeDots, BsTrash } from "react-icons/bs";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

import { cn } from "@/lib/utils";

import { useCalendarStore } from "@/store/calendar";
import { useViewStore } from "@/store/calendar";

import { MiniCalendar } from "./MiniCalendar";

type FeedType = "GOOGLE" | "OUTLOOK" | "CALDAV" | string;

const PROVIDER_LABELS: Record<string, string> = {
  GOOGLE: "Google",
  OUTLOOK: "Outlook",
  CALDAV: "CalDAV",
};

function groupFeedsByType<T extends { type: FeedType }>(
  feeds: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const feed of feeds) {
    const key = feed.type ?? "OTHER";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(feed);
  }
  return groups;
}

export function FeedManager() {
  const [syncingFeeds, setSyncingFeeds] = useState<Set<string>>(new Set());
  const { feeds, removeFeed, toggleFeed, syncFeed } = useCalendarStore();
  const { date: currentDate, setDate } = useViewStore();

  const handleRemoveFeed = useCallback(
    async (feedId: string) => {
      try {
        await removeFeed(feedId);
      } catch (error) {
        console.error("Failed to remove feed:", error);
      }
    },
    [removeFeed]
  );

  const handleSyncFeed = useCallback(
    async (feedId: string) => {
      if (syncingFeeds.has(feedId)) return;

      try {
        setSyncingFeeds((prev) => new Set(prev).add(feedId));
        await syncFeed(feedId);
      } finally {
        setSyncingFeeds((prev) => {
          const next = new Set(prev);
          next.delete(feedId);
          return next;
        });
      }
    },
    [syncFeed, syncingFeeds]
  );

  const grouped = groupFeedsByType(feeds);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="py-4">
        <MiniCalendar currentDate={currentDate} onDateClick={setDate} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {/* Section header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-h2 text-ink">Calendars</h2>
          <Button variant="ghost" size="sm" className="gap-1">
            <BsPlus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>

        {/* Empty state */}
        {feeds.length === 0 && (
          <div className="py-section flex flex-col items-center gap-3 text-center">
            <p className="text-body-sm text-ink-soft">
              No calendars connected yet. Add one to start syncing.
            </p>
            <Button variant="default" size="sm">
              Connect a calendar
            </Button>
          </div>
        )}

        {/* Grouped feed list */}
        {Array.from(grouped.entries()).map(([type, typeFeeds]) => (
          <div key={type} className="mt-block">
            {/* Group heading */}
            <p className="text-meta mb-2 uppercase tracking-wide text-ink-mute">
              {PROVIDER_LABELS[type] ?? type}
            </p>

            {/* Feed rows */}
            <div className="space-y-1">
              {typeFeeds.map((feed) => {
                const isSyncing = syncingFeeds.has(feed.id);

                return (
                  <div
                    key={feed.id}
                    className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-sunken/60"
                  >
                    {/* Color dot */}
                    <span
                      style={{
                        backgroundColor:
                          feed.color || "hsl(var(--color-action))",
                      }}
                      className="h-2 w-2 shrink-0 rounded-full"
                      aria-hidden="true"
                    />

                    {/* Feed name */}
                    <span className="calendar-name flex-1 truncate text-body-sm text-ink">
                      {feed.name}
                    </span>

                    {/* Provider icon */}
                    {feed.type === "GOOGLE" && (
                      <BsGoogle
                        className="h-3.5 w-3.5 shrink-0 text-ink-mute"
                        title={feed.url}
                      />
                    )}
                    {feed.type === "OUTLOOK" && (
                      <BsMicrosoft
                        className="h-3.5 w-3.5 shrink-0 text-ink-mute"
                        title={feed.url}
                      />
                    )}

                    {/* Toggle */}
                    <Switch
                      checked={feed.enabled}
                      onCheckedChange={() => toggleFeed(feed.id)}
                      aria-label={`Toggle ${feed.name}`}
                      className="shrink-0"
                    />

                    {/* Hover action menu */}
                    <div className="opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={cn(
                              "rounded-full p-1 text-ink-mute",
                              "hover:bg-surface-sunken hover:text-ink",
                              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                            )}
                            aria-label="Feed options"
                          >
                            <BsThreeDots className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={() => handleSyncFeed(feed.id)}
                            disabled={isSyncing}
                          >
                            <BsArrowRepeat
                              className={cn(
                                "mr-2 h-3.5 w-3.5",
                                isSyncing && "animate-spin"
                              )}
                            />
                            {isSyncing ? "Syncing…" : "Sync now"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRemoveFeed(feed.id)}
                            className="text-[hsl(var(--urgency-critical))] focus:text-[hsl(var(--urgency-critical))]"
                          >
                            <BsTrash className="mr-2 h-3.5 w-3.5" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
