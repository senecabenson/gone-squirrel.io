import { useNowModeStore } from "../nowMode";

beforeEach(() => {
  useNowModeStore.setState(useNowModeStore.getInitialState(), true);
});

describe("useNowModeStore", () => {
  test("initial step is pick-energy", () => {
    expect(useNowModeStore.getState().step).toBe("pick-energy");
  });

  test("setEnergy transitions to pick-time", () => {
    useNowModeStore.getState().setEnergy("high");
    expect(useNowModeStore.getState().energy).toBe("high");
    expect(useNowModeStore.getState().step).toBe("pick-time");
  });

  test("setDuration transitions to recommend", () => {
    useNowModeStore.getState().setEnergy("high");
    useNowModeStore.getState().setDuration(30);
    expect(useNowModeStore.getState().durationMin).toBe(30);
    expect(useNowModeStore.getState().step).toBe("recommend");
  });

  test("startPomodoro stamps wall-clock + transitions to working", () => {
    const before = Date.now();
    useNowModeStore.getState().startPomodoro({ taskId: "t1", chunkId: "c1", taskTitle: "Test Task", chunkIndex: 1, totalChunks: 3, durationMs: 30 * 60 * 1000 });
    const state = useNowModeStore.getState();
    expect(state.step).toBe("working");
    expect(state.pomodoroStartedAt).toBeGreaterThanOrEqual(before);
    expect(state.pomodoroDurationMs).toBe(30 * 60 * 1000);
    expect(state.recommendedTaskId).toBe("t1");
    expect(state.recommendedTaskTitle).toBe("Test Task");
    expect(state.recommendedChunkIndex).toBe(1);
    expect(state.recommendedTotalChunks).toBe(3);
  });

  test("remainingMs computes from wall clock", () => {
    useNowModeStore.getState().startPomodoro({ taskId: "t1", chunkId: "c1", taskTitle: "Test Task", chunkIndex: 1, totalChunks: 3, durationMs: 30 * 60 * 1000 });
    const remaining = useNowModeStore.getState().remainingMs();
    expect(remaining).toBeLessThanOrEqual(30 * 60 * 1000);
    expect(remaining).toBeGreaterThan(29 * 60 * 1000);
  });

  test("pause accrues pause time; resume continues from same remaining", () => {
    useNowModeStore.getState().startPomodoro({ taskId: "t1", chunkId: "c1", taskTitle: "Test Task", chunkIndex: 1, totalChunks: 3, durationMs: 30 * 60 * 1000 });
    useNowModeStore.getState().pause();
    const pausedRemaining = useNowModeStore.getState().remainingMs();
    return new Promise((resolve) => setTimeout(() => {
      const stillPausedRemaining = useNowModeStore.getState().remainingMs();
      expect(Math.abs(stillPausedRemaining - pausedRemaining)).toBeLessThan(10);
      useNowModeStore.getState().resume();
      expect(useNowModeStore.getState().pomodoroPausedAt).toBeNull();
      resolve(null);
    }, 200));
  });

  test("extendDuration adds minutes without resetting startedAt", () => {
    useNowModeStore.getState().startPomodoro({ taskId: "t1", chunkId: "c1", taskTitle: "Test Task", chunkIndex: 1, totalChunks: 3, durationMs: 30 * 60 * 1000 });
    const startedAt = useNowModeStore.getState().pomodoroStartedAt;
    useNowModeStore.getState().extendDuration(15);
    expect(useNowModeStore.getState().pomodoroDurationMs).toBe(45 * 60 * 1000);
    expect(useNowModeStore.getState().pomodoroStartedAt).toBe(startedAt);
  });

  test("completeRound transitions to round-complete and stamps lastEnergy/lastDuration", () => {
    useNowModeStore.getState().setEnergy("high");
    useNowModeStore.getState().setDuration(30);
    useNowModeStore.getState().startPomodoro({ taskId: "t1", chunkId: "c1", taskTitle: "Test Task", chunkIndex: 1, totalChunks: 3, durationMs: 30 * 60 * 1000 });
    useNowModeStore.getState().completeRound();
    expect(useNowModeStore.getState().step).toBe("round-complete");
    expect(useNowModeStore.getState().lastEnergy).toBe("high");
    expect(useNowModeStore.getState().lastDurationMin).toBe(30);
  });

  test("reset returns to pick-energy and clears Pomodoro state", () => {
    useNowModeStore.getState().setEnergy("high");
    useNowModeStore.getState().startPomodoro({ taskId: "t1", chunkId: "c1", taskTitle: "Test Task", chunkIndex: 1, totalChunks: 3, durationMs: 30 * 60 * 1000 });
    useNowModeStore.getState().reset();
    expect(useNowModeStore.getState().step).toBe("pick-energy");
    expect(useNowModeStore.getState().pomodoroStartedAt).toBeNull();
  });

  test("toggleTimerMode flips countdown ↔ countup", () => {
    expect(useNowModeStore.getState().timerMode).toBe("countdown");
    useNowModeStore.getState().toggleTimerMode();
    expect(useNowModeStore.getState().timerMode).toBe("countup");
  });
});
