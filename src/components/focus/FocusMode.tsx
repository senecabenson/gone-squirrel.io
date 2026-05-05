"use client";

import { useEffect, useState } from "react";

import { PiListBulletsDuotone, PiSlidersHorizontalDuotone } from "react-icons/pi";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet-mobile";
import { ActionOverlay } from "@/components/ui/action-overlay";

import { useFocusModeStore } from "@/store/focusMode";

import { FocusedTask } from "./FocusedTask";
import { QuickActions } from "./QuickActions";
import { TaskQueue } from "./TaskQueue";

export function FocusMode() {
  const [mounted, setMounted] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const {
    getCurrentTask,
    isProcessing,
    actionType,
    actionMessage,
    stopProcessing,
    getQueuedTasks,
  } = useFocusModeStore();

  const currentTask = getCurrentTask();
  const queueCount = getQueuedTasks().length;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <span className="block h-3 w-3 animate-pulse rounded-full bg-action" />
        <p className="text-body-sm text-ink-soft">One moment — pulling your queue.</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {isProcessing && actionType && (
        <ActionOverlay
          type={actionType}
          message={actionMessage || undefined}
          onComplete={stopProcessing}
        />
      )}

      {/* Mobile header — quick access to queue */}
      <header className="flex items-center justify-between border-b border-[hsl(var(--border-subtle))] bg-canvas px-4 py-3 md:hidden">
        <Sheet open={queueOpen} onOpenChange={setQueueOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-body-sm text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <PiListBulletsDuotone className="h-4 w-4" aria-hidden="true" />
              Queue
              {queueCount > 0 && (
                <span className="font-mono text-[10px] text-ink-mute">
                  {queueCount}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh]">
            <TaskQueue />
          </SheetContent>
        </Sheet>

        <span className="font-display text-h2 leading-none tracking-[-0.008em] text-ink">
          Now
        </span>

        <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="More actions"
              className="inline-flex items-center justify-center rounded-md p-1.5 text-ink-soft transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <PiSlidersHorizontalDuotone className="h-5 w-5" aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh]">
            <QuickActions />
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop 3-pane / Mobile single hero */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)_280px]">
        <aside className="hidden border-r border-[hsl(var(--border-subtle))] md:block">
          <TaskQueue />
        </aside>

        <main className="overflow-y-auto">
          <FocusedTask task={currentTask} />
        </main>

        <aside className="hidden border-l border-[hsl(var(--border-subtle))] md:block">
          <QuickActions />
        </aside>
      </div>
    </div>
  );
}
