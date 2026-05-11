"use client";

import { useEffect } from "react";

import { useNowModeStore } from "@/store/nowMode";

import { EnergyPicker } from "./EnergyPicker";
import { TimePicker } from "./TimePicker";
import { RecommendationCard } from "./RecommendationCard";
import { PomodoroHero } from "./PomodoroHero";
import { UpNextSheet } from "./UpNextSheet";
import { RoundComplete } from "./RoundComplete";

export function NowMode() {
  const step = useNowModeStore((s) => s.step);
  const taskId = useNowModeStore((s) => s.recommendedTaskId);
  const chunkId = useNowModeStore((s) => s.recommendedChunkId);
  const taskTitle = useNowModeStore((s) => s.recommendedTaskTitle);
  const chunkIndex = useNowModeStore((s) => s.recommendedChunkIndex);
  const totalChunks = useNowModeStore((s) => s.recommendedTotalChunks);

  // Sync URL hash to step for browser-back support
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.location.hash = `now-${step}`;
  }, [step]);

  if (step === "pick-energy") return <EnergyPicker />;
  if (step === "pick-time") return <TimePicker />;
  if (step === "recommend") return <RecommendationCard />;

  if (step === "working" && taskTitle) {
    return (
      <div className="relative min-h-[640px] bg-gradient-to-b from-[hsl(var(--surface-warm))] to-[hsl(var(--accent-peach))]">
        <PomodoroHero taskTitle={taskTitle} />
        <UpNextSheet excludeChunkId={chunkId} />
      </div>
    );
  }

  if (
    step === "round-complete" &&
    taskTitle &&
    taskId &&
    chunkId &&
    chunkIndex !== null &&
    totalChunks !== null
  ) {
    return (
      <div className="min-h-[640px] bg-gradient-to-b from-[hsl(var(--surface-warm))] to-[hsl(var(--accent-peach))]">
        <RoundComplete
          taskId={taskId}
          taskTitle={taskTitle}
          chunkId={chunkId}
          chunkIndex={chunkIndex}
          totalChunks={totalChunks}
        />
      </div>
    );
  }

  // Loading/transition state — fall back to picker if data missing
  return <EnergyPicker />;
}
