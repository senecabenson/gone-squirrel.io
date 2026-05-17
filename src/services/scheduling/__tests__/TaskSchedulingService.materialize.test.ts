/**
 * RED tests: scheduleAllTasksForUser should call materialize before building
 * SchedulingService, and a materialize throw must be swallowed (scheduling
 * still completes).
 *
 * Matches sibling prisma-mock style (CommitmentMaterializer.test.ts).
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => ({
  prisma: {
    autoScheduleSettings: { findUnique: jest.fn() },
    task: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Spy on materialize — default resolves; can be overridden per test.
const mockMaterialize = jest.fn().mockResolvedValue({
  created: 0,
  skipped: 0,
  materialized: 0,
  errors: 0,
});

jest.mock("@/services/scheduling/CommitmentMaterializer", () => ({
  materialize: (...args: unknown[]) => mockMaterialize(...args),
}));

// Stub SchedulingService so the test doesn't need real DB data.
const mockScheduleMultipleTasks = jest.fn().mockResolvedValue([]);
jest.mock("../SchedulingService", () => ({
  SchedulingService: jest.fn().mockImplementation(() => ({
    scheduleMultipleTasks: mockScheduleMultipleTasks,
  })),
}));

// Stub google sync (fire-and-forget in the real code).
jest.mock("../../google-task-sync", () => ({
  syncScheduledTasksToGoogle: jest.fn().mockResolvedValue(undefined),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { SchedulingService } from "../SchedulingService";
import { scheduleAllTasksForUser } from "../TaskSchedulingService";

// ── Helpers ──────────────────────────────────────────────────────────────────

const FAKE_SETTINGS = {
  id: "s1",
  userId: "u1",
  workDays: "[1,2,3,4,5]",
  workHourStart: 9,
  workHourEnd: 17,
  selectedCalendars: "[]",
  bufferMinutes: 15,
  blockTypeMap: "[]",
  highEnergyStart: null,
  highEnergyEnd: null,
  mediumEnergyStart: null,
  mediumEnergyEnd: null,
  lowEnergyStart: null,
  lowEnergyEnd: null,
  groupByProject: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("scheduleAllTasksForUser – materialize integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMaterialize.mockResolvedValue({ created: 0, skipped: 0, materialized: 0, conflicts: 0 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = prisma as any;
    p.autoScheduleSettings.findUnique.mockResolvedValue(FAKE_SETTINGS);
    p.task.findMany.mockResolvedValue([]);
    p.task.update.mockResolvedValue({});
    p.task.updateMany.mockResolvedValue({ count: 0 });

    mockScheduleMultipleTasks.mockResolvedValue([]);
  });

  it("calls materialize(userId) before constructing SchedulingService", async () => {
    const callOrder: string[] = [];
    mockMaterialize.mockImplementation(() => {
      callOrder.push("materialize");
      return Promise.resolve({ created: 0, skipped: 0, materialized: 0, conflicts: 0 });
    });
    (SchedulingService as jest.Mock).mockImplementation(() => {
      callOrder.push("SchedulingService");
      return { scheduleMultipleTasks: jest.fn().mockResolvedValue([]) };
    });

    await scheduleAllTasksForUser("u1");

    expect(callOrder[0]).toBe("materialize");
    expect(callOrder[1]).toBe("SchedulingService");
  });

  it("passes userId to materialize", async () => {
    await scheduleAllTasksForUser("u1");
    expect(mockMaterialize).toHaveBeenCalledWith("u1");
  });

  it("swallows a materialize error and scheduling still completes", async () => {
    mockMaterialize.mockRejectedValue(new Error("GCal down"));

    // Should NOT throw.
    await expect(scheduleAllTasksForUser("u1")).resolves.toBeDefined();

    // Error was logged.
    expect(logger.error).toHaveBeenCalled();

    // SchedulingService was still instantiated.
    expect(SchedulingService).toHaveBeenCalled();
  });
});
