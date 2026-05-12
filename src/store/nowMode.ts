import { create } from "zustand";
import { persist } from "zustand/middleware";

type EnergyLevel = "low" | "medium" | "high";
type NowModeStep = "pick-energy" | "pick-time" | "recommend" | "working" | "round-complete";
type TimerMode = "countdown" | "countup";

interface NowModeState {
  step: NowModeStep;
  energy: EnergyLevel | null;
  durationMin: number | null;

  recommendedTaskId: string | null;
  recommendedChunkId: string | null;
  recommendedTaskTitle: string | null;
  recommendedChunkIndex: number | null;
  recommendedTotalChunks: number | null;

  pomodoroStartedAt: number | null;
  pomodoroDurationMs: number | null;
  pomodoroPausedAt: number | null;
  pomodoroAccruedPausedMs: number;

  timerMode: TimerMode;

  lastEnergy: EnergyLevel | null;
  lastDurationMin: number | null;

  setStep: (s: NowModeStep) => void;
  setEnergy: (e: EnergyLevel) => void;
  setDuration: (m: number) => void;
  setRecommendation: (input: { taskId: string; chunkId: string; taskTitle: string; chunkIndex: number; totalChunks: number }) => void;
  startPomodoro: (input: { taskId: string; chunkId: string; taskTitle: string; chunkIndex: number; totalChunks: number; durationMs: number }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  extendDuration: (additionalMin: number) => void;
  toggleTimerMode: () => void;
  completeRound: () => void;
  reset: () => void;
  remainingMs: () => number;
  elapsedMs: () => number;
  isPaused: () => boolean;
}

export const useNowModeStore = create<NowModeState>()(
  persist(
    (set, get) => ({
      step: "pick-energy",
      energy: null,
      durationMin: null,
      recommendedTaskId: null,
      recommendedChunkId: null,
      recommendedTaskTitle: null,
      recommendedChunkIndex: null,
      recommendedTotalChunks: null,
      pomodoroStartedAt: null,
      pomodoroDurationMs: null,
      pomodoroPausedAt: null,
      pomodoroAccruedPausedMs: 0,
      timerMode: "countdown",
      lastEnergy: null,
      lastDurationMin: null,

      setStep: (s) => set({ step: s }),
      setEnergy: (e) => set({ energy: e, step: "pick-time" }),
      setDuration: (m) => set({ durationMin: m, step: "recommend" }),
      setRecommendation: ({ taskId, chunkId, taskTitle, chunkIndex, totalChunks }) =>
        set({
          recommendedTaskId: taskId,
          recommendedChunkId: chunkId,
          recommendedTaskTitle: taskTitle,
          recommendedChunkIndex: chunkIndex,
          recommendedTotalChunks: totalChunks,
        }),

      startPomodoro: ({ taskId, chunkId, taskTitle, chunkIndex, totalChunks, durationMs }) =>
        set({
          step: "working",
          recommendedTaskId: taskId,
          recommendedChunkId: chunkId,
          recommendedTaskTitle: taskTitle,
          recommendedChunkIndex: chunkIndex,
          recommendedTotalChunks: totalChunks,
          pomodoroStartedAt: Date.now(),
          pomodoroDurationMs: durationMs,
          pomodoroPausedAt: null,
          pomodoroAccruedPausedMs: 0,
        }),

      pause: () => {
        if (get().pomodoroPausedAt !== null) return;
        set({ pomodoroPausedAt: Date.now() });
      },

      resume: () => {
        const pausedAt = get().pomodoroPausedAt;
        if (pausedAt === null) return;
        const delta = Date.now() - pausedAt;
        set({
          pomodoroPausedAt: null,
          pomodoroAccruedPausedMs: get().pomodoroAccruedPausedMs + delta,
        });
      },

      stop: () =>
        set({
          step: "pick-energy",
          recommendedTaskTitle: null,
          recommendedChunkIndex: null,
          recommendedTotalChunks: null,
          pomodoroStartedAt: null,
          pomodoroDurationMs: null,
          pomodoroPausedAt: null,
          pomodoroAccruedPausedMs: 0,
        }),

      extendDuration: (additionalMin) => {
        const cur = get().pomodoroDurationMs ?? 0;
        set({ pomodoroDurationMs: cur + additionalMin * 60 * 1000 });
      },

      toggleTimerMode: () =>
        set({ timerMode: get().timerMode === "countdown" ? "countup" : "countdown" }),

      completeRound: () => {
        set({
          step: "round-complete",
          lastEnergy: get().energy,
          lastDurationMin: get().durationMin,
        });
      },

      reset: () =>
        set({
          step: "pick-energy",
          energy: null,
          durationMin: null,
          recommendedTaskId: null,
          recommendedChunkId: null,
          recommendedTaskTitle: null,
          recommendedChunkIndex: null,
          recommendedTotalChunks: null,
          pomodoroStartedAt: null,
          pomodoroDurationMs: null,
          pomodoroPausedAt: null,
          pomodoroAccruedPausedMs: 0,
        }),

      remainingMs: () => {
        const s = get();
        if (s.pomodoroStartedAt === null || s.pomodoroDurationMs === null) return 0;
        const pausedAdditional = s.pomodoroPausedAt !== null ? Date.now() - s.pomodoroPausedAt : 0;
        const elapsed = Date.now() - s.pomodoroStartedAt - s.pomodoroAccruedPausedMs - pausedAdditional;
        return Math.max(0, s.pomodoroDurationMs - elapsed);
      },

      elapsedMs: () => {
        const s = get();
        if (s.pomodoroStartedAt === null || s.pomodoroDurationMs === null) return 0;
        const pausedAdditional = s.pomodoroPausedAt !== null ? Date.now() - s.pomodoroPausedAt : 0;
        return Math.max(0, Date.now() - s.pomodoroStartedAt - s.pomodoroAccruedPausedMs - pausedAdditional);
      },

      isPaused: () => get().pomodoroPausedAt !== null,
    }),
    { name: "now-mode-store" },
  ),
);
