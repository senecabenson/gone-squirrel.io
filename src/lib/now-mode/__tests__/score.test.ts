import { scoreTasks } from "../score";

type T = Parameters<typeof scoreTasks>[0]["tasks"][number];

function task(overrides: Partial<T>): T {
  return {
    id: "t1",
    title: "Default",
    energyLevel: "medium",
    timeEstimate: 30,
    chunkMin: 15,
    chunkMax: 60,
    dueDate: null,
    projectId: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    lastFocusedAt: null,
    status: "todo",
    ...overrides,
  };
}

const NOW = new Date("2026-05-11T12:00:00Z");
const CTX = { energy: "high" as const, durationMin: 30, now: NOW, userTimeZone: "America/Los_Angeles", lastCompletedProjectId: null };

describe("scoreTasks", () => {
  test("returns null when no tasks provided", () => {
    expect(scoreTasks({ tasks: [], ...CTX })).toBeNull();
  });

  test("strict eligibility — only tasks with a fitting chunk", () => {
    const fits = task({ id: "fits", timeEstimate: 30 });
    const doesNot = task({ id: "no", timeEstimate: 30, chunkMin: 45, chunkMax: 60 });
    const result = scoreTasks({ tasks: [fits, doesNot], ...CTX });
    expect(result?.matchedExactly).toBe(true);
  });

  test("closest-match fallback when no strict fit", () => {
    const long = task({ id: "long", timeEstimate: 90, chunkMin: 60, chunkMax: 90 });
    const result = scoreTasks({ tasks: [long], ...CTX, durationMin: 30 });
    expect(result).not.toBeNull();
    expect(result!.matchedExactly).toBe(false);
    expect(result!.task.id).toBe("long");
  });

  test("energy match weights highest", () => {
    const high = task({ id: "high", energyLevel: "high", timeEstimate: 30 });
    const low = task({ id: "low", energyLevel: "low", timeEstimate: 30 });
    const result = scoreTasks({ tasks: [high, low], ...CTX });
    expect(result!.task.id).toBe("high");
    expect(result!.components.energy).toBe(1);
  });

  test("deadline soon outranks no deadline (energy equal)", () => {
    const soon = task({ id: "soon", energyLevel: "high", timeEstimate: 30, dueDate: new Date("2026-05-12T00:00:00Z") });
    const noDeadline = task({ id: "no", energyLevel: "high", timeEstimate: 30, dueDate: null });
    const result = scoreTasks({ tasks: [soon, noDeadline], ...CTX });
    expect(result!.task.id).toBe("soon");
  });

  test("variety — penalize same project as last completed within 24h", () => {
    const same = task({ id: "same", energyLevel: "high", timeEstimate: 30, projectId: "p1" });
    const diff = task({ id: "diff", energyLevel: "high", timeEstimate: 30, projectId: "p2" });
    const result = scoreTasks({ tasks: [same, diff], ...CTX, lastCompletedProjectId: "p1" });
    expect(result!.task.id).toBe("diff");
  });

  test("picks correct chunk for the recommendation", () => {
    const longChunked = task({ id: "longC", energyLevel: "high", timeEstimate: 90 });
    const result = scoreTasks({ tasks: [longChunked], ...CTX, durationMin: 30 });
    expect(result!.chunkDurationMin).toBe(30);
  });
});
