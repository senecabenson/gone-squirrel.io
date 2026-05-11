import { pickReasoning, pickMismatchReasoning } from "../reasoning";

describe("pickReasoning", () => {
  test("returns non-empty string for any valid bucket", () => {
    const phrase = pickReasoning({
      taskTitle: "Q3 contracts",
      energy: "high",
      durationMin: 30,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      now: new Date(),
    });
    expect(typeof phrase).toBe("string");
    expect(phrase.length).toBeGreaterThan(10);
  });

  test("interpolates {{task}} with task title", () => {
    const phrase = pickReasoning({
      taskTitle: "UNIQUE_TASK_NAME_XYZ",
      energy: "high",
      durationMin: 30,
      dueDate: null,
      now: new Date(),
    });
    expect(phrase).toContain("UNIQUE_TASK_NAME_XYZ");
  });

  test("falls back to a phrase when bucket missing", () => {
    const phrase = pickReasoning({
      taskTitle: "Some task",
      energy: "medium",
      durationMin: 120,
      dueDate: null,
      now: new Date(),
    });
    expect(phrase.length).toBeGreaterThan(0);
  });
});

describe("pickMismatchReasoning", () => {
  test("notes the mismatch and asks for adjustment", () => {
    const phrase = pickMismatchReasoning({
      taskTitle: "Big task",
      requestedMin: 30,
      actualMin: 60,
    });
    expect(phrase).toContain("30");
    expect(phrase).toContain("60");
    expect(phrase.toLowerCase()).toMatch(/extend|swap|adjust|try/);
  });
});
