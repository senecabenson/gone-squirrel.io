"use client";

import { useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { useNowModeStore } from "@/store/nowMode";

function formatMS(ms: number): { mm: string; ss: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    mm: String(Math.floor(total / 60)).padStart(2, "0"),
    ss: String(total % 60).padStart(2, "0"),
  };
}

export function StickyPomodoroBanner() {
  const step = useNowModeStore((s) => s.step);
  const remainingMs = useNowModeStore((s) => s.remainingMs);
  const elapsedMs = useNowModeStore((s) => s.elapsedMs);
  const durationMs = useNowModeStore((s) => s.pomodoroDurationMs);
  const taskTitle = useNowModeStore((s) => s.recommendedTaskTitle);
  const pause = useNowModeStore((s) => s.pause);
  const resume = useNowModeStore((s) => s.resume);
  const stop = useNowModeStore((s) => s.stop);
  const isPaused = useNowModeStore((s) => s.isPaused);
  const pathname = usePathname();
  const router = useRouter();
  const [, force] = useState(0);

  useEffect(() => {
    if (step !== "working") return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [step]);

  if (step !== "working" || pathname === "/focus" || !taskTitle) return null;

  const { mm, ss } = formatMS(remainingMs());
  const progress = durationMs ? Math.min(1, elapsedMs() / durationMs) : 0;

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-action to-[hsl(var(--accent-acorn))] text-action-foreground shadow-lg">
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push("/focus")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push("/focus");
          }
        }}
        aria-label="Return to Now Mode"
        className="w-full px-4 py-2.5 flex items-center gap-3 text-left cursor-pointer"
      >
        <div
          className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{
            background: `conic-gradient(currentColor 0deg ${progress * 360}deg, rgba(255,255,255,0.25) ${progress * 360}deg 360deg)`,
          }}
        >
          <div className="bg-action w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-mono font-semibold">
            {Math.round(progress * 100)}%
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-lg font-semibold leading-none">
            {mm}:{ss}<span className="text-[11px] font-sans opacity-70 ml-1.5">remaining</span>
          </div>
          <div className="text-xs opacity-90 mt-0.5 truncate">{taskTitle}</div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isPaused()) resume();
              else pause();
            }}
            aria-label={isPaused() ? "Resume" : "Pause"}
            className="bg-white/20 border border-white/30 rounded-lg px-3 py-1.5 text-xs"
          >
            {isPaused() ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); stop(); }}
            className="bg-black/20 border border-white/20 rounded-lg px-3 py-1.5 text-xs"
          >
            Stop
          </button>
        </div>
      </div>
      <div className="h-[3px] bg-white/20">
        <div
          className="h-full bg-amber-100 shadow-[0_0_8px_rgba(254,243,199,0.6)]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
