"use client";

import { useState } from "react";

import { toast } from "sonner";

import { useNowModeStore } from "@/store/nowMode";

import { FinishLaterModal } from "./FinishLaterModal";

interface Props {
  taskId: string;
  taskTitle: string;
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
}

export function RoundComplete({ taskId, taskTitle, chunkId, chunkIndex, totalChunks }: Props) {
  const reset = useNowModeStore((s) => s.reset);
  const setStep = useNowModeStore((s) => s.setStep);
  const extendDuration = useNowModeStore((s) => s.extendDuration);
  const askedDurationMin = useNowModeStore((s) => s.durationMin);
  const pomodoroDurationMs = useNowModeStore((s) => s.pomodoroDurationMs);
  const [finishLaterOpen, setFinishLaterOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isChunked = totalChunks > 1;
  const roundMin = Math.round((pomodoroDurationMs ?? 0) / 60000);
  const leftoverMin = Math.max(0, (askedDurationMin ?? 0) - roundMin);
  const showLeftoverCTA = leftoverMin >= 10;

  const handlePickAnother = () => {
    setStep("pick-energy");
  };

  const handleDone = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/focus/chunks/${chunkId}/complete`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { parentClosed: boolean };
      toast.success(data.parentClosed ? "Task done. Picking next." : "Chunk done. Picking next.");
      setStep("pick-energy");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark done");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteParent = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/focus/complete-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`${taskTitle} fully done. Clearing calendar.`);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not close task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtend = (min: number) => {
    extendDuration(min);
    setStep("working");
  };

  return (
    <>
      <div className="flex flex-col items-center px-6 py-10 md:py-14 text-center">
        <p className="font-serif text-[13px] uppercase tracking-[0.1em] text-[hsl(var(--accent-acorn))] mb-1">
          Round complete
        </p>
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-ink font-medium mb-1.5">
          Caught it.
        </h1>
        <p className="font-serif italic text-sm text-ink-soft mb-7">
          {isChunked ? `Chunk ${chunkIndex} of ${totalChunks} — ${taskTitle}` : taskTitle}
        </p>

        <div className="bg-canvas rounded-3xl p-6 max-w-md w-full shadow-xl shadow-action/10 text-left">
          <p className="font-serif text-xs uppercase tracking-wider text-[hsl(var(--accent-acorn))] mb-3.5 font-medium">
            What&apos;s true right now?
          </p>

          <button
            type="button"
            disabled={submitting}
            onClick={handleDone}
            className="w-full bg-action text-action-foreground rounded-xl p-4 mb-2 font-semibold flex items-center gap-3 shadow-md shadow-action/30 disabled:opacity-50"
          >
            <span className="text-xl">✓</span>
            <div className="flex-1 text-left">
              <div>Done — I finished this {isChunked ? "chunk" : ""}</div>
              <div className="text-xs opacity-80 font-normal mt-0.5">Marks {isChunked ? "this chunk" : "task"} complete. Pre-loads next task.</div>
            </div>
          </button>

          {isChunked && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleCompleteParent}
              className="w-full border border-action/40 bg-action/5 text-[hsl(var(--accent-acorn))] rounded-xl p-3.5 mb-2 text-sm font-medium flex items-center gap-3 disabled:opacity-50"
            >
              <span className="text-base">⏭</span>
              <div className="flex-1 text-left">
                <div>I&apos;m fully done with &quot;{taskTitle}&quot;</div>
                <div className="text-[11px] text-ink-soft mt-0.5 font-normal">Clears all remaining chunks + frees calendar slots.</div>
              </div>
            </button>
          )}

          <div className="w-full bg-canvas text-ink border border-border-subtle rounded-xl p-3.5 mb-2 text-sm font-medium flex items-center gap-3">
            <span className="text-base text-[hsl(var(--accent-acorn))]">＋</span>
            <div className="flex-1 text-left">Need more time</div>
            <div className="flex gap-1">
              {[5, 15, 25].map((m) => (
                <button
                  key={m}
                  disabled={submitting}
                  onClick={() => handleExtend(m)}
                  className="bg-canvas border border-border-subtle text-[hsl(var(--accent-acorn))] rounded-md px-1.5 py-0.5 text-[10px] disabled:opacity-50"
                >
                  +{m}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => setFinishLaterOpen(true)}
            className="w-full bg-canvas text-ink border border-border-subtle rounded-xl p-3.5 mb-2 text-sm font-medium flex items-center gap-3 disabled:opacity-50"
          >
            <span className="text-base text-[hsl(var(--accent-acorn))]">↪</span>
            <div className="flex-1 text-left">
              <div>Finish later — pick something else</div>
              <div className="text-[11px] text-ink-soft mt-0.5 font-normal">Saves progress + reschedules.</div>
            </div>
          </button>

          {showLeftoverCTA && (
            <button
              type="button"
              disabled={submitting}
              onClick={handlePickAnother}
              className="w-full bg-[hsl(var(--accent-peach))] text-[hsl(var(--accent-acorn))] border border-[hsl(var(--accent-acorn))]/20 rounded-xl p-3.5 mb-2 text-sm font-medium flex items-center gap-3 disabled:opacity-50"
            >
              <span className="text-base">⏳</span>
              <div className="flex-1 text-left">
                <div>Got {leftoverMin} min left — pick another?</div>
                <div className="text-[11px] opacity-70 mt-0.5 font-normal">Use the rest of the window you asked for.</div>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={reset}
            className="w-full text-ink-mute italic text-xs py-2.5"
          >
            I need a break first →
          </button>
        </div>
      </div>

      <FinishLaterModal
        open={finishLaterOpen}
        onClose={() => setFinishLaterOpen(false)}
        taskId={taskId}
        taskTitle={taskTitle}
      />
    </>
  );
}
