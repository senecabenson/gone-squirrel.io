/**
 * R1b — PATCH /api/commitments/[id] must allowlist fields (no mass-assignment).
 * Drives the handler directly with mocked deps (no route harness in repo).
 */

jest.mock("@/lib/auth/api-auth", () => ({ authenticateRequest: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("@/lib/prisma", () => ({
  prisma: {
    personalCommitment: { findUnique: jest.fn(), update: jest.fn() },
    autoScheduleSettings: { findUnique: jest.fn() },
  },
}));
jest.mock("@/services/scheduling/CommitmentMaterializer", () => ({
  materialize: jest.fn(),
  revoke: jest.fn(),
}));

import type { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { materialize, revoke } from "@/services/scheduling/CommitmentMaterializer";
import { PATCH as PATCHraw } from "../route";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mAuth = authenticateRequest as jest.Mock;
const mFind = (prisma as any).personalCommitment.findUnique as jest.Mock;
const mUpd = (prisma as any).personalCommitment.update as jest.Mock;
const mSettings = (prisma as any).autoScheduleSettings.findUnique as jest.Mock;
const mMat = materialize as jest.Mock;
const mRev = revoke as jest.Mock;

function req(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
type H = (
  r: NextRequest,
  p: { params: Promise<{ id: string }> }
) => Promise<Response | undefined>;
async function PATCH(body: unknown, id = "c1"): Promise<Response> {
  const res = await (PATCHraw as H)(req(body), params(id));
  if (!res) throw new Error("no response");
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mAuth.mockResolvedValue({ userId: "u1" });
  mFind.mockResolvedValue({ id: "c1", userId: "u1" });
  mUpd.mockImplementation(async ({ data }: any) => ({
    id: "c1",
    userId: "u1",
    ...data,
  }));
  mSettings.mockResolvedValue({ blockTypeMap: "[]" });
  mMat.mockResolvedValue({ created: 0, materialized: 0, conflicts: 0, skipped: 0 });
  mRev.mockResolvedValue(undefined);
});

it("(1) ignores injected userId and unknown/relation keys", async () => {
  const res = await PATCH({
    label: "New label",
    userId: "attacker",
    events: { deleteMany: {} },
    id: "other",
  });
  expect(res.status).toBe(200);
  expect(mUpd).toHaveBeenCalledTimes(1);
  const data = mUpd.mock.calls[0][0].data;
  expect(data.label).toBe("New label");
  expect(data).not.toHaveProperty("userId");
  expect(data).not.toHaveProperty("events");
  expect(data).not.toHaveProperty("id");
  // where clause still scopes to the authed user
  expect(mUpd.mock.calls[0][0].where).toEqual({ id: "c1", userId: "u1" });
});

it("(2) applies a normal allowlisted field update", async () => {
  const res = await PATCH({ durationMin: 45, active: false });
  expect(res.status).toBe(200);
  const data = mUpd.mock.calls[0][0].data;
  expect(data.durationMin).toBe(45);
  expect(data.active).toBe(false);
});

it("(3) rejects an emoji that is not a protected block rule (400)", async () => {
  const res = await PATCH({ emoji: "🦄" });
  expect(res.status).toBe(400);
  expect(mUpd).not.toHaveBeenCalled();
});

it("(4) rrule change triggers revoke + re-materialize", async () => {
  const res = await PATCH({ rrule: "FREQ=WEEKLY;BYDAY=MO" });
  expect(res.status).toBe(200);
  expect(mRev).toHaveBeenCalledWith("c1");
  expect(mMat).toHaveBeenCalledWith("u1");
});

it("(5) 404 when commitment not owned", async () => {
  mFind.mockResolvedValue(null);
  const res = await PATCH({ label: "x" });
  expect(res.status).toBe(404);
  expect(mUpd).not.toHaveBeenCalled();
});
/* eslint-enable @typescript-eslint/no-explicit-any */
