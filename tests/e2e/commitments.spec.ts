/**
 * Phase B2 — Commitment Materializer live contract test.
 *
 * Drives the REAL Google-connected user (senecacbenson@gmail.com) against
 * the real "Task Blocks" Google Calendar. Explicitly authorized by the user.
 *
 * Auth strategy: Mint a NextAuth JWT (HS256 via next-auth/jwt encode) and
 * inject it as a session cookie — zero DB mutation on the real user's
 * credentials, zero password exposure.
 *
 * DB setup: Before the test, the spec temporarily wires
 * AutoScheduleSettings.taskBlocksFeedId to the existing "Task Blocks" feed.
 * This is restored in afterAll even if assertions fail.
 *
 * Self-cleaning: afterAll + try/finally inside the test guarantee every
 * commitment and task created is deleted even if assertions fail. Revoke
 * (DELETE /api/commitments/:id) cascades to GCal events + CalendarEvent rows.
 *
 * Run:
 *   # Assumes dev server already running on :3001 (or start it):
 *   PORT=3001 npm run dev &
 *   TEST_BASE_URL=http://localhost:3001 \
 *     npx playwright test tests/e2e/commitments.spec.ts \
 *     --project=chromium --workers=1
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { spawnSync } from "child_process";
import { encode } from "next-auth/jwt";
import path from "path";

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE = "http://localhost:3001";
const ROOT = path.resolve(__dirname, "../..");

/** Real user in the dev DB. */
const REAL_USER_ID = "cmp1et2bg00002i8c5ts40o53";
const REAL_USER_EMAIL = "senecacbenson@gmail.com";
const REAL_USER_NAME = "Seneca Benson";

/** The "Task Blocks" CalendarFeed that already exists in the dev DB. */
const TASK_BLOCKS_FEED_ID = "619f2c29-f3b4-47c1-ae2f-cf64874fe70e";

/**
 * Protected emoji from DEFAULT_BLOCK_TYPE_MAP (used when blockTypeMap = "[]").
 * 💪🏽 = Movement → eligibility: "protected".
 */
const PROTECTED_EMOJI = "💪🏽";

const NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "7FgPBVLrsLCDI/LcsNfYC7XNV9nnmM904HPItjFoWGo=";

// ── Module-level cleanup state ────────────────────────────────────────────────

let createdCommitmentId: string | null = null;
let createdTaskId: string | null = null;

// ── DB helpers (via child tsx scripts — avoids Playwright bundler complications) ──

function runDbScript(code: string): { stdout: string; stderr: string; ok: boolean } {
  const result = spawnSync(
    "npx",
    ["tsx", "-e", code],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://gonesquirrel:gonesquirrel@localhost:5432/gonesquirrel_dev" },
      timeout: 30_000,
      encoding: "utf8",
    }
  );
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ok: result.status === 0,
  };
}

/**
 * Wire taskBlocksFeedId into AutoScheduleSettings so the materializer has
 * a Google Calendar to write to. Returns the original feedId for restoration.
 */
function wireTaskBlocksFeed(): { originalFeedId: string | null; didCreate: boolean } {
  const r = runDbScript(`
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
async function main() {
  const existing = await prisma.autoScheduleSettings.findUnique({ where: { userId: '${REAL_USER_ID}' } });
  const originalFeedId = existing?.taskBlocksFeedId ?? null;
  const didCreate = !existing;
  if (!existing) {
    await prisma.autoScheduleSettings.create({
      data: {
        userId: '${REAL_USER_ID}',
        workDays: JSON.stringify([1,2,3,4,5]),
        workHourStart: 9,
        workHourEnd: 17,
        taskBlocksFeedId: '${TASK_BLOCKS_FEED_ID}',
      },
    });
  } else {
    await prisma.autoScheduleSettings.update({
      where: { userId: '${REAL_USER_ID}' },
      data: { taskBlocksFeedId: '${TASK_BLOCKS_FEED_ID}' },
    });
  }
  console.log(JSON.stringify({ originalFeedId, didCreate }));
}
main().finally(() => prisma.$disconnect());
  `.trim());
  if (!r.ok) throw new Error(`wireTaskBlocksFeed failed:\n${r.stderr}`);
  const lines = r.stdout.trim().split("\n");
  for (const line of lines.reverse()) {
    try { return JSON.parse(line); } catch { /* skip non-JSON lines */ }
  }
  throw new Error(`wireTaskBlocksFeed: no JSON output. stdout=${r.stdout}`);
}

/** Restore AutoScheduleSettings.taskBlocksFeedId to its original value. */
function restoreTaskBlocksFeed(originalFeedId: string | null, didCreate: boolean): void {
  let code: string;
  if (didCreate) {
    code = `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
async function main() {
  await prisma.autoScheduleSettings.deleteMany({ where: { userId: '${REAL_USER_ID}' } });
  console.log('deleted');
}
main().finally(() => prisma.$disconnect());
    `.trim();
  } else {
    const feedVal = originalFeedId ? `'${originalFeedId}'` : "null";
    code = `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
async function main() {
  await prisma.autoScheduleSettings.update({
    where: { userId: '${REAL_USER_ID}' },
    data: { taskBlocksFeedId: ${feedVal} },
  });
  console.log('restored');
}
main().finally(() => prisma.$disconnect());
    `.trim();
  }
  const r = runDbScript(code);
  if (!r.ok) throw new Error(`restoreTaskBlocksFeed failed:\n${r.stderr}`);
}

/** Verify no CommitmentEvent for commitmentId remains (for cleanup confirmation). */
function verifyCommitmentGone(commitmentId: string): boolean {
  const r = runDbScript(`
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
async function main() {
  const c = await prisma.personalCommitment.findUnique({ where: { id: '${commitmentId}' } });
  console.log(JSON.stringify({ found: !!c }));
}
main().finally(() => prisma.$disconnect());
  `.trim());
  if (!r.ok) return false;
  const lines = r.stdout.trim().split("\n");
  for (const line of lines.reverse()) {
    try { const j = JSON.parse(line); return !j.found; } catch { /* skip */ }
  }
  return false;
}

// ── Auth helper ───────────────────────────────────────────────────────────────

/**
 * Mint a NextAuth JWT session token for the real user.
 * Uses next-auth/jwt encode — no DB write, no password needed.
 */
async function mintSessionToken(): Promise<string> {
  return encode({
    token: {
      sub: REAL_USER_ID,
      email: REAL_USER_EMAIL,
      name: REAL_USER_NAME,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    secret: NEXTAUTH_SECRET,
  });
}

/** Build a Playwright APIRequestContext pre-loaded with the session cookie. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildAuthedCtx(playwright: any): Promise<APIRequestContext> {
  const token = await mintSessionToken();
  return playwright.request.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { "Content-Type": "application/json" },
    storageState: {
      cookies: [
        {
          name: "next-auth.session-token",
          value: token,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax" as const,
          expires: Math.floor(Date.now() / 1000) + 3600,
        },
      ],
      origins: [],
    },
  });
}

// ── Utility ───────────────────────────────────────────────────────────────────

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe("Phase B2 — Commitment Materializer live GCal contract", () => {
  test.setTimeout(180_000);

  const TS = Date.now();
  const LABEL = `E2E TEMP Commitment ${TS}`;

  // Track DB setup state for teardown.
  let originalFeedId: string | null = null;
  let didCreateSettings = false;

  test.afterAll(async ({ playwright }) => {
    console.log("\n[afterAll] ===== CLEANUP START =====");
    let cleanupFailed = false;
    const errors: string[] = [];

    // ── Step A: Delete commitment + task via API FIRST ───────────────────────
    // IMPORTANT: Must happen BEFORE restoring settings because:
    // DELETE /api/commitments/[id] calls revoke() which needs taskBlocksFeedId
    // to be set in AutoScheduleSettings to delete the GCal events. If we restore
    // settings first (setting taskBlocksFeedId=null), revoke() will skip GCal delete.
    if (createdCommitmentId || createdTaskId) {
      let req: APIRequestContext | null = null;
      try {
        req = await buildAuthedCtx(playwright);

        // B1. Delete commitment (revoke → GCal delete + CalendarEvent rows).
        if (createdCommitmentId) {
          try {
            const del = await req.delete(`${BASE}/api/commitments/${createdCommitmentId}`);
            if (del.status() !== 204) {
              const msg = `DELETE /api/commitments/${createdCommitmentId} → HTTP ${del.status()}`;
              console.error(`[CLEANUP FAIL] ${msg}`);
              errors.push(msg);
              cleanupFailed = true;
            } else {
              console.log(`[afterAll] Commitment ${createdCommitmentId} deleted OK`);

              // Verify gone via API.
              const check = await req.get(`${BASE}/api/commitments`);
              if (check.ok()) {
                const body = await check.json();
                const residue = (body.commitments ?? []).find(
                  (c: { id: string }) => c.id === createdCommitmentId
                );
                if (residue) {
                  const msg = `Commitment ${createdCommitmentId} still present in GET /api/commitments after DELETE`;
                  console.error(`[CLEANUP FAIL] ${msg}`);
                  errors.push(msg);
                  cleanupFailed = true;
                } else {
                  console.log("[afterAll] Commitment confirmed absent from GET /api/commitments");
                }
              }

              // Verify gone via DB.
              const dbGone = verifyCommitmentGone(createdCommitmentId);
              if (!dbGone) {
                const msg = `Commitment ${createdCommitmentId} still in DB after DELETE`;
                console.error(`[CLEANUP FAIL] ${msg}`);
                errors.push(msg);
                cleanupFailed = true;
              } else {
                console.log("[afterAll] Commitment confirmed absent from DB");
              }
            }
          } catch (e) {
            const msg = `Exception deleting commitment: ${e}`;
            console.error(`[CLEANUP FAIL] ${msg}`);
            errors.push(msg);
            cleanupFailed = true;
          }
        }

        // B2. Delete test task.
        if (createdTaskId) {
          try {
            const del = await req.delete(`${BASE}/api/tasks/${createdTaskId}`);
            if (del.status() !== 204) {
              const msg = `DELETE /api/tasks/${createdTaskId} → HTTP ${del.status()}`;
              console.error(`[CLEANUP FAIL] ${msg}`);
              errors.push(msg);
              cleanupFailed = true;
            } else {
              console.log(`[afterAll] Task ${createdTaskId} deleted OK`);
            }
          } catch (e) {
            const msg = `Exception deleting task: ${e}`;
            console.error(`[CLEANUP FAIL] ${msg}`);
            errors.push(msg);
            cleanupFailed = true;
          }
        }
      } catch (e) {
        const msg = `Exception building auth context in afterAll: ${e}`;
        console.error(`[CLEANUP FAIL] ${msg}`);
        errors.push(msg);
        cleanupFailed = true;
      } finally {
        await req?.dispose();
      }
    }

    // ── Step B: Restore AutoScheduleSettings AFTER API cleanup ───────────────
    // Settings restoration happens last so revoke() above could use taskBlocksFeedId.
    try {
      restoreTaskBlocksFeed(originalFeedId, didCreateSettings);
      console.log(`[afterAll] AutoScheduleSettings restored (originalFeedId=${originalFeedId})`);
    } catch (e) {
      const msg = `Exception restoring AutoScheduleSettings: ${e}`;
      console.error(`[CLEANUP FAIL] ${msg}`);
      errors.push(msg);
      cleanupFailed = true;
    }

    console.log("[afterAll] ===== CLEANUP END =====\n");

    if (cleanupFailed) {
      throw new Error(
        "CLEANUP FAILED — residue may remain on the real Task Blocks calendar.\n" +
          `Commitment ID: ${createdCommitmentId}\nTask ID: ${createdTaskId}\n` +
          "Errors:\n" + errors.map((e) => `  - ${e}`).join("\n") + "\n" +
          "ACTION REQUIRED: Manually verify and delete from Google Calendar."
      );
    }

    console.log("[afterAll] All cleanup confirmed. Zero residue on real calendar.");
  });

  test("create commitment → materialize to GCal → no-overlap with auto-scheduled task → idempotent", async ({
    playwright,
  }) => {
    // ── Step 0: Wire DB so materializer has a Task Blocks feed ───────────────
    console.log("[test] Step 0: Wiring taskBlocksFeedId in AutoScheduleSettings...");
    const wired = wireTaskBlocksFeed();
    originalFeedId = wired.originalFeedId;
    didCreateSettings = wired.didCreate;
    console.log(`[test] AutoScheduleSettings wired. originalFeedId=${originalFeedId}, didCreate=${didCreateSettings}`);

    const req = await buildAuthedCtx(playwright);

    try {
      // ── Step 1: Verify auth works ─────────────────────────────────────────
      const authCheck = await req.get(`${BASE}/api/auto-schedule-settings`);
      expect(
        authCheck.status(),
        `Auth check failed (${authCheck.status()}) — JWT cookie not accepted by NextAuth`
      ).toBe(200);
      console.log("[test] Step 1: Auth OK (JWT cookie accepted)");

      // ── Step 2: POST /api/commitments ──────────────────────────────────────
      const postBody = {
        label: LABEL,
        emoji: PROTECTED_EMOJI,
        durationMin: 60,
        rrule: "FREQ=WEEKLY;BYDAY=TU,TH",
        preferredHour: 16,
      };
      console.log(`\n[test] Step 2: Creating commitment "${LABEL}" with emoji ${PROTECTED_EMOJI}...`);

      const postRes = await req.post(`${BASE}/api/commitments`, { data: postBody });
      const postText = await postRes.text();
      expect(
        postRes.status(),
        `POST /api/commitments failed (${postRes.status()}): ${postText}`
      ).toBe(201);

      const postJson = JSON.parse(postText);
      const commitment = postJson.commitment;
      const materializeResult = postJson.materialize;

      createdCommitmentId = commitment.id;
      console.log(`[test] Commitment created: id=${commitment.id}`);
      console.log(`[test] Materialize result: created=${materializeResult?.created} materialized=${materializeResult?.materialized} conflicts=${materializeResult?.conflicts} skipped=${materializeResult?.skipped}`);

      // Assert materialize happened and at least 1 event was placed.
      expect(materializeResult, "POST must return materialize key").not.toBeNull();
      expect(
        materializeResult.materialized,
        `Expected >= 1 materialized GCal events over 14d Tue+Thu horizon, got ${materializeResult.materialized}`
      ).toBeGreaterThanOrEqual(1);

      // ── Step 3: GET /api/commitments → events have status=materialized + googleEventId ──
      console.log("\n[test] Step 3: Verifying commitment events via GET /api/commitments...");
      const getRes = await req.get(`${BASE}/api/commitments`);
      expect(getRes.status()).toBe(200);
      const getJson = await getRes.json();

      const found = (getJson.commitments ?? []).find(
        (c: { id: string }) => c.id === createdCommitmentId
      );
      expect(found, "Commitment not found in GET /api/commitments response").toBeTruthy();
      expect(
        found.events.length,
        "Commitment must have at least one upcoming CommitmentEvent"
      ).toBeGreaterThan(0);

      for (const ev of found.events) {
        expect(
          ev.status,
          `Event ${ev.id}: expected status=materialized, got "${ev.status}"`
        ).toBe("materialized");
        expect(
          ev.googleEventId,
          `Event ${ev.id}: must have googleEventId (proves real GCal write happened)`
        ).toBeTruthy();
        console.log(`  Event: id=${ev.id} start=${ev.start} googleEventId=${ev.googleEventId}`);
      }

      // ── Step 4: Assert CalendarEvent mirrors exist in DB ──────────────────
      console.log("\n[test] Step 4: Verifying CalendarEvent mirrors in DB...");
      const { stdout: dbOut } = runDbScript(`
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
async function main() {
  const googleEventIds = ${JSON.stringify(found.events.map((e: { googleEventId: string }) => e.googleEventId))};
  const results = [];
  for (const gid of googleEventIds) {
    const calEv = await prisma.calendarEvent.findFirst({
      where: { feedId: '${TASK_BLOCKS_FEED_ID}', externalEventId: gid }
    });
    results.push({ gid, found: !!calEv, title: calEv?.title ?? null });
  }
  console.log(JSON.stringify(results));
}
main().finally(() => prisma.$disconnect());
      `.trim());

      let calEvResults: Array<{ gid: string; found: boolean; title: string | null }> = [];
      for (const line of dbOut.trim().split("\n").reverse()) {
        try { calEvResults = JSON.parse(line); break; } catch { /* skip */ }
      }

      const expectedTitle = `${PROTECTED_EMOJI} ${LABEL}`;
      for (const r of calEvResults) {
        expect(
          r.found,
          `CalendarEvent mirror not found in DB for googleEventId=${r.gid} (feedId=${TASK_BLOCKS_FEED_ID})`
        ).toBe(true);
        expect(
          r.title,
          `CalendarEvent title must be "${expectedTitle}", got "${r.title}"`
        ).toBe(expectedTitle);
        console.log(`  CalendarEvent mirror: googleEventId=${r.gid} title="${r.title}" OK`);
      }

      // ── Step 5: Create auto-scheduled task overlapping a commitment slot ───
      console.log("\n[test] Step 5: Creating auto-scheduled task overlapping commitment slot...");
      const firstEvent = found.events[0];
      const slotStart = new Date(firstEvent.start);
      const slotEnd = new Date(firstEvent.end);

      // Task window covers the commitment's day ± 1 day so the scheduler
      // would naturally want to place it near that slot.
      const taskStartDate = new Date(slotStart.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const taskDueDate = new Date(slotEnd.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const taskBody = {
        title: `E2E TEMP Task ${TS}`,
        status: "todo",
        isAutoScheduled: true,
        duration: 30,
        startDate: taskStartDate,
        dueDate: taskDueDate,
        priority: "high",
        energyLevel: "high",
      };

      const taskPostRes = await req.post(`${BASE}/api/tasks`, { data: taskBody });
      const taskPostText = await taskPostRes.text();
      // Tasks POST returns 200 (not 201) in this codebase.
      const taskPostStatus = taskPostRes.status();
      expect(
        taskPostStatus === 200 || taskPostStatus === 201,
        `POST /api/tasks failed (${taskPostStatus}): ${taskPostText}`
      ).toBe(true);
      const taskCreated = JSON.parse(taskPostText);
      createdTaskId = taskCreated.id;
      console.log(`[test] Task created: id=${createdTaskId} title="${taskCreated.title}"`);

      // ── Step 6: POST /api/tasks/schedule-all ──────────────────────────────
      console.log("\n[test] Step 6: Running schedule-all...");
      const schedRes = await req.post(`${BASE}/api/tasks/schedule-all`);
      expect(
        schedRes.status(),
        `POST /api/tasks/schedule-all failed: ${schedRes.status()}`
      ).toBe(200);
      console.log("[test] schedule-all OK");

      // ── Step 7: Verify scheduled task does NOT overlap commitment intervals ─
      console.log("\n[test] Step 7: Verifying no-overlap (Phase A↔B contract)...");
      const taskGetRes = await req.get(`${BASE}/api/tasks/${createdTaskId}`);
      expect(taskGetRes.status()).toBe(200);
      const scheduledTask = await taskGetRes.json();

      console.log(`[test] Task scheduledStart=${scheduledTask.scheduledStart} scheduledEnd=${scheduledTask.scheduledEnd}`);

      if (scheduledTask.scheduledStart && scheduledTask.scheduledEnd) {
        const commitmentIntervals = found.events.map((ev: { start: string; end: string }) => ({
          start: ev.start,
          end: ev.end,
        }));

        for (const ci of commitmentIntervals) {
          const doesOverlap = overlaps(
            scheduledTask.scheduledStart,
            scheduledTask.scheduledEnd,
            ci.start,
            ci.end
          );
          expect(
            doesOverlap,
            `PHASE A↔B CONTRACT VIOLATION: task scheduled at ${scheduledTask.scheduledStart}–${scheduledTask.scheduledEnd} ` +
              `overlaps commitment block ${ci.start}–${ci.end}`
          ).toBe(false);
        }
        console.log("[test] No-overlap PASSED: task avoids all materialized commitment blocks");
      } else {
        console.log("[test] Task not scheduled (no free slot) — no overlap possible. Contract holds.");
      }

      // ── Step 8: Idempotency — second materialize creates 0 new events ──────
      console.log("\n[test] Step 8: Idempotency check (second materialize)...");
      const idemRes = await req.post(`${BASE}/api/commitments/materialize`, {
        data: { horizonDays: 14 },
      });
      expect(idemRes.status()).toBe(200);
      const idemJson = await idemRes.json();
      expect(
        idemJson.created,
        `Idempotent second materialize must return created=0, got ${idemJson.created}`
      ).toBe(0);
      console.log(`[test] Idempotency PASSED: second materialize created=${idemJson.created} (expected 0)`);

      console.log("\n[test] ===== ALL ASSERTIONS PASSED =====\n");
    } finally {
      await req.dispose();
      // Cleanup (commitment delete + settings restore) runs in afterAll.
    }
  });
});
