/**
 * Phase C / CP3 — POST /api/commitments/[id]/skip|move (TDD).
 *
 * No API-route harness exists in the repo, so this drives the handlers
 * directly with a fake NextRequest + mocked deps and asserts the contract:
 *   • adjuster called with parsed args, THEN scheduleAllTasksForUser
 *   • move conflict → 409 {code:"move_conflict"} and recompute is NOT run
 *   • ownership / occurrence-belongs-to-commitment guards
 */

jest.mock("@/lib/auth/api-auth", () => ({
  authenticateRequest: jest.fn(),
}));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    personalCommitment: { findUnique: jest.fn() },
    commitmentEvent: { findUnique: jest.fn() },
  },
}));
jest.mock("@/services/scheduling/CommitmentAdjuster", () => {
  const actual = jest.requireActual("@/services/scheduling/CommitmentAdjuster");
  return {
    ...actual,
    skipOccurrence: jest.fn(),
    moveOccurrence: jest.fn(),
  };
});
jest.mock("@/services/scheduling/TaskSchedulingService", () => ({
  scheduleAllTasksForUser: jest.fn(),
}));

import type { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import {
  skipOccurrence,
  moveOccurrence,
  CommitmentMoveConflictError,
} from "@/services/scheduling/CommitmentAdjuster";
import { scheduleAllTasksForUser } from "@/services/scheduling/TaskSchedulingService";
import { POST as skipPOSTraw } from "../skip/route";
import { POST as movePOSTraw } from "../move/route";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mAuth = authenticateRequest as jest.Mock;
const mPC = (prisma as any).personalCommitment.findUnique as jest.Mock;
const mCE = (prisma as any).commitmentEvent.findUnique as jest.Mock;
const mSkip = skipOccurrence as jest.Mock;
const mMove = moveOccurrence as jest.Mock;
const mRecompute = scheduleAllTasksForUser as jest.Mock;

function req(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

type Handler = (
  r: NextRequest,
  p: { params: Promise<{ id: string }> }
) => Promise<Response | undefined>;

async function call(
  h: Handler,
  body: unknown,
  id: string
): Promise<Response> {
  const res = await h(req(body), params(id));
  if (!res) throw new Error("handler returned no response");
  return res;
}

const skipPOST = (b: unknown, id = "c1") =>
  call(skipPOSTraw as Handler, b, id);
const movePOST = (b: unknown, id = "c1") =>
  call(movePOSTraw as Handler, b, id);

beforeEach(() => {
  jest.clearAllMocks();
  mAuth.mockResolvedValue({ userId: "u1" });
  mPC.mockResolvedValue({ id: "c1", userId: "u1" });
  mCE.mockResolvedValue({
    id: "occ1",
    commitmentId: "c1",
    status: "materialized",
  });
  mRecompute.mockResolvedValue([{ id: "task1" }]);
});

describe("POST /api/commitments/[id]/skip", () => {
  it("(1) calls skipOccurrence then scheduleAllTasksForUser; returns makeup + plan", async () => {
    mSkip.mockResolvedValue({
      skipped: true,
      reflow: "work",
      makeup: { status: "materialized", start: new Date(), end: new Date() },
    });
    const order: string[] = [];
    mSkip.mockImplementation(async () => {
      order.push("skip");
      return {
        skipped: true,
        reflow: "work",
        makeup: { status: "conflict" },
      };
    });
    mRecompute.mockImplementation(async () => {
      order.push("recompute");
      return [{ id: "t" }];
    });

    const res = await skipPOST({ occurrenceId: "occ1" });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(json.makeup.status).toBe("conflict");
    expect(json.plan).toEqual([{ id: "t" }]);
    expect(mSkip).toHaveBeenCalledWith("occ1", { reflow: "work" });
    expect(order).toEqual(["skip", "recompute"]);
  });

  it("(2) reflow:'free' is forwarded", async () => {
    mSkip.mockResolvedValue({
      skipped: true,
      reflow: "free",
      makeup: { status: "conflict" },
    });
    await skipPOST({ occurrenceId: "occ1", reflow: "free" });
    expect(mSkip).toHaveBeenCalledWith("occ1", { reflow: "free" });
  });

  it("(3) 404 when commitment not owned by user", async () => {
    mPC.mockResolvedValue(null);
    const res = await skipPOST({ occurrenceId: "occ1" });
    expect(res.status).toBe(404);
    expect(mSkip).not.toHaveBeenCalled();
  });

  it("(4) 404 when occurrence belongs to a different commitment", async () => {
    mCE.mockResolvedValue({ id: "occ1", commitmentId: "OTHER" });
    const res = await skipPOST({ occurrenceId: "occ1" });
    expect(res.status).toBe(404);
    expect(mSkip).not.toHaveBeenCalled();
  });

  it("(5) 400 when occurrenceId missing", async () => {
    const res = await skipPOST({});
    expect(res.status).toBe(400);
  });

  it("(R2a) 409 already_skipped when occurrence already cancelled", async () => {
    mCE.mockResolvedValue({ id: "occ1", commitmentId: "c1", status: "cancelled" });
    const res = await skipPOST({ occurrenceId: "occ1" });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("already_skipped");
    expect(mSkip).not.toHaveBeenCalled();
  });
});

describe("POST /api/commitments/[id]/move", () => {
  it("(6) valid move → moveOccurrence then recompute; returns start/end/plan", async () => {
    const start = new Date("2026-05-19T10:00:00Z");
    const end = new Date("2026-05-19T11:00:00Z");
    mMove.mockResolvedValue({ moved: true, start, end });

    const res = await movePOST({
      occurrenceId: "occ1",
      newStart: start.toISOString(),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.moved).toBe(true);
    expect(json.plan).toEqual([{ id: "task1" }]);
    expect(mMove).toHaveBeenCalledWith("occ1", expect.any(Date));
    expect(mMove.mock.calls[0][1].getTime()).toBe(start.getTime());
    expect(mRecompute).toHaveBeenCalled();
  });

  it("(7) conflict → 409 {code:'move_conflict'}, recompute NOT called", async () => {
    mMove.mockRejectedValue(
      new CommitmentMoveConflictError("Overlaps a protected block")
    );

    const res = await movePOST({ occurrenceId: "occ1", newStart: "2026-05-19T10:00:00Z" });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("move_conflict");
    expect(mRecompute).not.toHaveBeenCalled();
  });

  it("(8) 400 when newStart is missing/invalid", async () => {
    const res = await movePOST({ occurrenceId: "occ1", newStart: "not-a-date" });
    expect(res.status).toBe(400);
    expect(mMove).not.toHaveBeenCalled();
  });

  it("(R2a) 409 move_conflict when occurrence is not materialized", async () => {
    mCE.mockResolvedValue({ id: "occ1", commitmentId: "c1", status: "cancelled" });
    const res = await movePOST({
      occurrenceId: "occ1",
      newStart: "2026-05-19T10:00:00Z",
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("move_conflict");
    expect(mMove).not.toHaveBeenCalled();
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
