"use client";

import { useEffect, useState } from "react";

import { useNowModeStore } from "@/store/nowMode";
import { useSettingsStore } from "@/store/settings";

function formatMS(ms: number): { mm: string; ss: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return { mm, ss };
}

export function PomodoroHero({ taskTitle }: { taskTitle: string }) {
  const remainingMs = useNowModeStore((s) => s.remainingMs);
  const elapsedMs = useNowModeStore((s) => s.elapsedMs);
  const pomodoroDurationMs = useNowModeStore((s) => s.pomodoroDurationMs);
  const timerMode = useNowModeStore((s) => s.timerMode);
  const toggleTimerMode = useNowModeStore((s) => s.toggleTimerMode);
  const pause = useNowModeStore((s) => s.pause);
  const resume = useNowModeStore((s) => s.resume);
  const stop = useNowModeStore((s) => s.stop);
  const completeRound = useNowModeStore((s) => s.completeRound);
  const isPaused = useNowModeStore((s) => s.pomodoroPausedAt !== null);
  const motionEnabled = useSettingsStore((s) => s.motionEnabled);

  const [, force] = useState(0);

  // Tick: 250ms re-render; wall-clock derived
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  // Round-complete trigger — fires once when remaining hits zero
  useEffect(() => {
    if (remainingMs() <= 0 && pomodoroDurationMs !== null) completeRound();
  });

  // Tab title
  useEffect(() => {
    const original = document.title;
    const tick = () => {
      const ms = timerMode === "countdown" ? remainingMs() : elapsedMs();
      const { mm, ss } = formatMS(ms);
      document.title = `${mm}:${ss} · ${taskTitle}`;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      document.title = original;
    };
  }, [taskTitle, remainingMs, elapsedMs, timerMode]);

  const displayMs = timerMode === "countdown" ? remainingMs() : elapsedMs();
  const { mm, ss } = formatMS(displayMs);
  const progress = pomodoroDurationMs ? Math.min(1, elapsedMs() / pomodoroDurationMs) : 0;
  const degrees = progress * 360;

  return (
    <div className="flex flex-col items-center px-6 py-10 md:py-14 relative">
      <p className="font-serif text-[13px] uppercase tracking-[0.1em] text-[hsl(var(--accent-acorn))] mb-2">
        Working on
      </p>
      <h1 className="font-serif text-2xl md:text-3xl leading-tight tracking-tight text-ink font-medium text-center max-w-xl mb-7">
        {taskTitle}
      </h1>
      <div
        className="relative w-[280px] h-[280px] mx-auto mb-5 cursor-pointer"
        onClick={toggleTimerMode}
        role="button"
        tabIndex={0}
        aria-label="Toggle countdown / countup"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleTimerMode(); }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--action)) 0deg ${degrees}deg, hsl(var(--action) / 0.15) ${degrees}deg 360deg)`,
            transition: motionEnabled ? "background 0.5s linear" : "none",
          }}
        />
        <div className="absolute inset-3.5 rounded-full bg-canvas flex flex-col items-center justify-center shadow-inner">
          <div className="flex items-baseline gap-1.5">
            <div className="flex flex-col items-center">
              <div className="font-mono text-[64px] font-semibold text-ink leading-none tracking-tight">{mm}</div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-ink-mute mt-1.5">min</div>
            </div>
            <div className="font-mono text-[48px] font-semibold text-ink-mute leading-none mb-4">:</div>
            <div className="flex flex-col items-center">
              <div className="font-mono text-[64px] font-semibold text-ink leading-none tracking-tight">{ss}</div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-ink-mute mt-1.5">sec</div>
            </div>
          </div>
          <div className="mt-3.5 inline-flex items-center gap-1.5 bg-canvas border border-border-subtle rounded-full px-2.5 py-0.5 text-[10px] text-[hsl(var(--accent-acorn))] font-medium tracking-wide">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-action" />
            {timerMode === "countdown" ? "COUNTDOWN" : "COUNT UP"} <span className="opacity-50">↻ tap</span>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-2 mb-7">
        <button onClick={isPaused ? resume : pause} className="border border-border-subtle text-[hsl(var(--accent-acorn))] rounded-lg px-4 py-2 text-sm">
          {isPaused ? "Resume" : "Pause"}
        </button>
        <button onClick={stop} className="border border-border-subtle text-[hsl(var(--accent-acorn))] rounded-lg px-4 py-2 text-sm">
          Stop
        </button>
        <button onClick={completeRound} className="border border-border-subtle text-[hsl(var(--accent-acorn))] rounded-lg px-4 py-2 text-sm">
          Done early
        </button>
      </div>
    </div>
  );
}
