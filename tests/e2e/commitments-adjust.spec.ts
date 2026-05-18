/**
 * Phase C / CP5 — Adaptive adjustment (skip + reflow + makeup + move) live
 * contract test against the REAL Google-connected user
 * (senecacbenson@gmail.com) and the real "Task Blocks" Google Calendar.
 * Explicitly authorized by the user.
 *
 * THE REFLOW PROOF B2 LACKED:
 * B2 only proved no-eviction (a work task overlapping a commitment parked).
 * It never exercised "freed time → work schedules IN". This spec makes that
 * deterministic WITHOUT depending on whatever real 🧠/🪶 blocks happen to be
 * on the live calendar: the work task's window is constrained to EXACTLY the
 * skipped occurrence's one-hour interval.
 *   • Before skip  → that hour is the commitment's 💪🏽 PROTECTED block →
 *                     the task cannot schedule → parked. (baseline)
 *   • Skip(reflow:work) → cancels it, drops a 🪶 Light (low-eligible) temp
 *                     block over exactly that hour (gs:reflow:<occ> tag),
 *                     makes up the occurrence elsewhere the same ISO week,
 *                     and re-runs schedule-all.
 *   • After skip   → the 30-min low-energy task now lands INSIDE that freed
 *                     hour. That is the reflow, proven on the real calendar.
 * The temp block itself is the in-window eligibility — exactly the mechanism
 * under test — so no extra eligible-block seeding is needed (and seeding
 * blocks on makeup-candidate days would wrongly mark them busy).
 *
 * Self-cleaning (mandatory, real calendar writes):
 *   afterAll → DELETE commitment (revoke cascades GCal+mirrors of every
 *   non-cancelled occurrence) → DELETE task → run
 *   scripts/e2e-reflow-cleanup.ts (removes the gs:reflow temp block from
 *   real Google + mirror; revoke does NOT, it isn't a CommitmentEvent) →
 *   restore AutoScheduleSettings. Throws on any residue.
 *
 * Run:
 *   pkill -f next-server 2>/dev/null || true
 *   PORT=3001 npm run dev &
 *   # wait for HTTP 200 on :3001 (first authed compile is slow, >90s)
 *   npx playwright test tests/e2e/commitments-adjust.spec.ts \
 *     --project=chromium --workers=1
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { spawnSync } from "child_process";
import { encode } from "next-auth/jwt";
import path from "path";

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE = "http://localhost:3001";
const ROOT = path.resolve(__dirname, "../..");

const REAL_USER_ID = "cmp1et2bg00002i8c5ts40o53";
const REAL_USER_EMAIL = "senecacbenson@gmail.com";
const REAL_USER_NAME = "Seneca Benson";
const TASK_BLOCKS_FEED_ID = "619f2c29-f3b4-47c1-ae2f-cf64874fe70e";
const PROTECTED_EMOJI = "💪🏽"; // Movement → eligibility "protected"

const NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? "7FgPBVLrsLCDI/LcsNfYC7XNV9nnmM904HPItjFoWGo=";

let createdCommitmentId: string | null = null;
let createdTaskId: string | null = null;

// ── DB / script helpers (child tsx — avoids Playwright bundler issues) ────────

function runScript(args: string[]): {
  stdout: string;
  stderr: string;
  ok: boolean;
} {
  const result = spawnSync("npx", ["tsx", ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://gonesquirrel:gonesquirrel@localhost:5432/gonesquirrel_dev",
    },
    timeout: 60_000,
    encoding: "utf8",
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    ok: result.status === 0,
  };
}

function runDbScript(code: string) {
  return runScript(["-e", code]);
}

function lastJson<T>(stdout: string): T | null {
  for (const line of stdout.trim().split("\n").reverse()) {
    try {
      return JSON.parse(line) as T;
    } catch {
      /* skip non-JSON */
    }
  }
  return null;
}

interface SettingsSnapshot {
  originalFeedId: string | null;
  workHourStart: number;
  workHourEnd: number;
  workDays: string;
  bufferMinutes: number;
  didCreate: boolean;
}

/**
 * Wire taskBlocksFeedId AND widen work hours to 0–23 / all 7 days for the
 * duration of the test. Why widen: the materializer places the commitment on
 * the first free daytime UTC slot, which on the real calendar can be early
 * (e.g. 06:00Z). The reflow proof needs that freed hour to be inside the work
 * window; narrow 9–17 work hours would drop it BEFORE the block filter and
 * the task could never reflow there. Baseline parking still holds: pre-skip
 * the hour is a PROTECTED commitment block, which the Phase A filter rejects
 * regardless of work hours. The real values are snapshotted and restored.
 */
function wireTaskBlocksFeed(): SettingsSnapshot {
  const r = runDbScript(
    `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
async function main() {
  const existing = await prisma.autoScheduleSettings.findUnique({ where: { userId: '${REAL_USER_ID}' } });
  const snap = {
    originalFeedId: existing?.taskBlocksFeedId ?? null,
    workHourStart: existing?.workHourStart ?? 9,
    workHourEnd: existing?.workHourEnd ?? 17,
    workDays: existing?.workDays ?? JSON.stringify([1,2,3,4,5]),
    bufferMinutes: existing?.bufferMinutes ?? 15,
    didCreate: !existing,
  };
  const wide = { taskBlocksFeedId: '${TASK_BLOCKS_FEED_ID}', workHourStart: 0, workHourEnd: 23, workDays: JSON.stringify([0,1,2,3,4,5,6]), bufferMinutes: 0 };
  if (!existing) {
    await prisma.autoScheduleSettings.create({ data: { userId: '${REAL_USER_ID}', ...wide } });
  } else {
    await prisma.autoScheduleSettings.update({ where: { userId: '${REAL_USER_ID}' }, data: wide });
  }
  console.log(JSON.stringify(snap));
}
main().finally(() => prisma.$disconnect());
`.trim()
  );
  if (!r.ok) throw new Error(`wireTaskBlocksFeed failed:\n${r.stderr}`);
  const j = lastJson<SettingsSnapshot>(r.stdout);
  if (!j) throw new Error(`wireTaskBlocksFeed: no JSON. stdout=${r.stdout}`);
  return j;
}

function restoreTaskBlocksFeed(snap: SettingsSnapshot): void {
  const code = snap.didCreate
    ? `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
async function main() { await prisma.autoScheduleSettings.deleteMany({ where: { userId: '${REAL_USER_ID}' } }); console.log('deleted'); }
main().finally(() => prisma.$disconnect());`.trim()
    : `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
async function main() {
  await prisma.autoScheduleSettings.update({
    where: { userId: '${REAL_USER_ID}' },
    data: {
      taskBlocksFeedId: ${snap.originalFeedId ? `'${snap.originalFeedId}'` : "null"},
      workHourStart: ${snap.workHourStart},
      workHourEnd: ${snap.workHourEnd},
      workDays: ${JSON.stringify(snap.workDays)},
      bufferMinutes: ${snap.bufferMinutes},
    },
  });
  console.log('restored');
}
main().finally(() => prisma.$disconnect());`.trim();
  const r = runDbScript(code);
  if (!r.ok) throw new Error(`restoreTaskBlocksFeed failed:\n${r.stderr}`);
}

/** Inspect a commitment's events + the gs:reflow temp block, straight from DB. */
function dbInspect(commitmentId: string) {
  const r = runDbScript(
    `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
async function main() {
  const events = await prisma.commitmentEvent.findMany({ where: { commitmentId: '${commitmentId}' }, orderBy: { start: 'asc' } });
  const reflow = await prisma.calendarEvent.findMany({ where: { feedId: '${TASK_BLOCKS_FEED_ID}', description: { startsWith: 'gs:reflow:' } } });
  console.log(JSON.stringify({
    events: events.map(e => ({ id: e.id, scheduledDate: e.scheduledDate, start: e.start, end: e.end, status: e.status, googleEventId: e.googleEventId })),
    reflow: reflow.map(c => ({ id: c.id, title: c.title, description: c.description, start: c.start, end: c.end, externalEventId: c.externalEventId })),
  }));
}
main().finally(() => prisma.$disconnect());
`.trim()
  );
  if (!r.ok) throw new Error(`dbInspect failed:\n${r.stderr}`);
  const j = lastJson<{
    events: Array<{
      id: string;
      scheduledDate: string;
      start: string;
      end: string;
      status: string;
      googleEventId: string | null;
    }>;
    reflow: Array<{
      id: string;
      title: string;
      description: string;
      start: string;
      end: string;
      externalEventId: string | null;
    }>;
  }>(r.stdout);
  if (!j) throw new Error(`dbInspect: no JSON. stdout=${r.stdout}`);
  return j;
}

/**
 * Find a move target that genuinely satisfies moveOccurrence's own validation
 * (no feed block / scheduled task / non-cancelled commitment overlap, and the
 * target day holds no non-cancelled occurrence of `commitmentId`). The real
 * Task Blocks feed is mirrored far into the future, so a hardcoded "empty"
 * wall-clock time is not reliable — compute one.
 */
function findConflictFreeStart(
  commitmentId: string,
  durationMin: number,
  minDay: number,
  maxDay: number
): string {
  const r = runDbScript(
    `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error'] });
const DUR = ${durationMin} * 60000;
const ov = (s,e,bs,be) => s.getTime() < be.getTime() && bs.getTime() < e.getTime();
async function main() {
  const cal = await prisma.calendarEvent.findMany({ where: { feedId: '${TASK_BLOCKS_FEED_ID}' } });
  const tasks = await prisma.task.findMany({ where: { userId: '${REAL_USER_ID}', scheduledStart: { not: null }, scheduledEnd: { not: null } } });
  const ces = await prisma.commitmentEvent.findMany({ where: { status: { in: ['planned','materialized'] } } });
  for (let d = ${minDay}; d <= ${maxDay}; d++) {
    for (const h of [8,9,10,11,12,13,14,15]) {
      const start = new Date(); start.setUTCDate(start.getUTCDate() + d); start.setUTCHours(h,0,0,0);
      const end = new Date(start.getTime() + DUR);
      const dayStart = new Date(start); dayStart.setUTCHours(0,0,0,0);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const sameDayCE = ces.some(c => c.commitmentId === '${commitmentId}' && c.scheduledDate >= dayStart && c.scheduledDate < dayEnd);
      if (sameDayCE) continue;
      const clash =
        cal.some(c => ov(start,end,c.start,c.end)) ||
        tasks.some(t => ov(start,end,t.scheduledStart,t.scheduledEnd)) ||
        ces.some(c => ov(start,end,c.start,c.end));
      if (!clash) { console.log(JSON.stringify({ start: start.toISOString() })); return; }
    }
  }
  console.log(JSON.stringify({ start: null }));
}
main().finally(() => prisma.$disconnect());
`.trim()
  );
  if (!r.ok) throw new Error(`findConflictFreeStart failed:\n${r.stderr}`);
  const j = lastJson<{ start: string | null }>(r.stdout);
  if (!j || !j.start)
    throw new Error(`findConflictFreeStart: none found. stdout=${r.stdout}`);
  return j.start;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

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

function isoWeekKey(d: Date): string {
  // ISO week label "GGGG-Www" — used only to assert same-week makeup.
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── Test ──────────────────────────────────────────────────────────────────────

test.describe("Phase C — skip/reflow/makeup/move live contract", () => {
  test.setTimeout(240_000);

  const TS = Date.now();
  const LABEL = `E2E TEMP Adjust ${TS}`;
  let settingsSnap: SettingsSnapshot | null = null;

  test.afterAll(async ({ playwright }) => {
    console.log("\n[afterAll] ===== CLEANUP START =====");
    const errors: string[] = [];
    let failed = false;

    if (createdCommitmentId || createdTaskId) {
      let req: APIRequestContext | null = null;
      try {
        req = await buildAuthedCtx(playwright);
        if (createdCommitmentId) {
          const del = await req.delete(
            `${BASE}/api/commitments/${createdCommitmentId}`
          );
          if (del.status() !== 204) {
            errors.push(
              `DELETE commitment → HTTP ${del.status()}`
            );
            failed = true;
          } else {
            console.log("[afterAll] commitment deleted (revoke cascade)");
          }
        }
        if (createdTaskId) {
          const del = await req.delete(`${BASE}/api/tasks/${createdTaskId}`);
          if (del.status() !== 204) {
            errors.push(`DELETE task → HTTP ${del.status()}`);
            failed = true;
          } else {
            console.log("[afterAll] task deleted");
          }
        }
      } catch (e) {
        errors.push(`afterAll API cleanup exception: ${e}`);
        failed = true;
      } finally {
        await req?.dispose();
      }
    }

    // gs:reflow temp block is NOT a CommitmentEvent → revoke can't remove it.
    const cleanup = runScript([
      "scripts/e2e-reflow-cleanup.ts",
      REAL_USER_ID,
    ]);
    if (!cleanup.ok) {
      errors.push(`e2e-reflow-cleanup failed: ${cleanup.stderr}`);
      failed = true;
    } else {
      console.log(`[afterAll] reflow cleanup: ${cleanup.stdout.trim()}`);
    }

    try {
      if (settingsSnap) restoreTaskBlocksFeed(settingsSnap);
      console.log("[afterAll] AutoScheduleSettings restored");
    } catch (e) {
      errors.push(`restore settings exception: ${e}`);
      failed = true;
    }

    console.log("[afterAll] ===== CLEANUP END =====\n");
    if (failed) {
      throw new Error(
        "CLEANUP FAILED — possible residue on the real Task Blocks calendar.\n" +
          `Commitment: ${createdCommitmentId}  Task: ${createdTaskId}\n` +
          errors.map((e) => `  - ${e}`).join("\n") +
          "\nACTION REQUIRED: verify/delete manually in Google Calendar."
      );
    }
    console.log("[afterAll] Zero residue confirmed.");
  });

  // Wire (and snapshot) BEFORE the test body. If wiring lived inside the
  // test and an earlier step threw, afterAll would have no snapshot and the
  // real user would be left at the widened settings permanently.
  test.beforeAll(() => {
    settingsSnap = wireTaskBlocksFeed();
  });

  test("skip frees the hour → low-energy work reflows INTO it; makeup same ISO week; move conflict typed", async ({
    playwright,
  }) => {
    const req = await buildAuthedCtx(playwright);
    try {
      // Auth.
      const authCheck = await req.get(`${BASE}/api/auto-schedule-settings`);
      expect(authCheck.status(), "JWT cookie not accepted").toBe(200);

      // 1. Commitment: weekly Tue/Thu, 120m, protected emoji. A wide freed
      //    interval gives the work scheduler ample room (a 30-min task in a
      //    120-min eligible block with zero buffer is trivially placeable —
      //    removes any tight-fit / slot-granularity ambiguity).
      const postRes = await req.post(`${BASE}/api/commitments`, {
        data: {
          label: LABEL,
          emoji: PROTECTED_EMOJI,
          durationMin: 120,
          rrule: "FREQ=WEEKLY;BYDAY=TU,TH",
          preferredHour: 16,
        },
      });
      const postText = await postRes.text();
      expect(postRes.status(), `POST /api/commitments: ${postText}`).toBe(201);
      const commitment = JSON.parse(postText).commitment;
      createdCommitmentId = commitment.id;

      // 2. Earliest materialized occurrence.
      const get1 = await req.get(`${BASE}/api/commitments`);
      const c1 = (await get1.json()).commitments.find(
        (c: { id: string }) => c.id === createdCommitmentId
      );
      expect(c1?.events?.length, "must have occurrences").toBeGreaterThan(0);
      const occ0 = [...c1.events].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      )[0];

      // 2.5 Move it to a CONTROLLED, DB-computed conflict-free daytime UTC
      //     window. The materializer auto-places on the first free UTC slot
      //     from DAY_START_HOUR=6 (~06:00Z), which in the user's
      //     negative-offset timezone is the middle of the local night — a
      //     window the work scheduler will not fill, so the reflow proof
      //     would test an unreachable interval. findConflictFreeStart returns
      //     a genuinely free slot at a daytime UTC hour (8–15), inside
      //     DAY_START..EVENING_CUTOFF → genuinely schedulable, the conditions
      //     a real skip-then-reflow hits. (Move is itself under test; this
      //     doubles as a valid-move assertion.)
      // Near window (within the work scheduler's horizon) so the reflow
      // proof can actually place a task into the freed interval.
      const ctrlStart = findConflictFreeStart(createdCommitmentId!, 120, 5, 25);
      const moveCtrl = await req.post(
        `${BASE}/api/commitments/${createdCommitmentId}/move`,
        { data: { occurrenceId: occ0.id, newStart: ctrlStart } }
      );
      const moveCtrlText = await moveCtrl.text();
      expect(
        moveCtrl.status(),
        `controlled move: ${moveCtrlText}`
      ).toBe(200);
      const moved0 = JSON.parse(moveCtrlText);
      expect(moved0.moved).toBe(true);
      const occ = { id: occ0.id, start: moved0.start, end: moved0.end };
      const freedStart = new Date(occ.start);
      const freedEnd = new Date(occ.end);
      console.log(
        `[test] occ ${occ.id} moved to controlled window ${occ.start}–${occ.end}; will skip it`
      );

      // 3. Low-energy autoscheduled task whose window IS exactly the freed
      //    interval (duration 30 ≪ 120). Independent of any other real block.
      const taskRes = await req.post(`${BASE}/api/tasks`, {
        data: {
          title: `E2E TEMP Task ${TS}`,
          status: "todo",
          isAutoScheduled: true,
          duration: 30,
          startDate: freedStart.toISOString(),
          dueDate: freedEnd.toISOString(),
          priority: "high",
          energyLevel: "low",
        },
      });
      const taskText = await taskRes.text();
      expect(
        [200, 201].includes(taskRes.status()),
        `POST /api/tasks: ${taskText}`
      ).toBe(true);
      createdTaskId = JSON.parse(taskText).id;

      // 4. Baseline: that interval is the 💪🏽 PROTECTED commitment block →
      //    schedule-all cannot place the task there → parked.
      const sched0 = await req.post(`${BASE}/api/tasks/schedule-all`);
      expect(sched0.status()).toBe(200);
      const t0 = await (
        await req.get(`${BASE}/api/tasks/${createdTaskId}`)
      ).json();
      expect(
        t0.scheduledStart,
        `BASELINE: task must be parked while the interval is a protected commitment block, got scheduledStart=${t0.scheduledStart}`
      ).toBeFalsy();
      console.log("[test] baseline OK — task parked (interval is protected)");

      // 5. Skip (default reflow:"work", setting skipReflowBlockType="light").
      const skipRes = await req.post(
        `${BASE}/api/commitments/${createdCommitmentId}/skip`,
        { data: { occurrenceId: occ.id } }
      );
      const skipText = await skipRes.text();
      expect(skipRes.status(), `skip: ${skipText}`).toBe(200);
      const skipJson = JSON.parse(skipText);
      expect(skipJson.skipped).toBe(true);
      console.log(
        `[test] skip OK — makeup=${JSON.stringify(skipJson.makeup)}`
      );

      // ── Deterministic-core assertions FIRST (these are the Phase C
      //    contract; ordered before the scheduler-integration proof so a
      //    placement-heuristic miss can't mask a core regression). ──────────
      const insp = dbInspect(createdCommitmentId!);

      // 6a. Skipped occurrence cancelled + NOT resurrected by the recompute.
      const skipped = insp.events.find((e) => e.id === occ.id);
      expect(skipped?.status, "skipped occ must be cancelled").toBe(
        "cancelled"
      );

      // 6b. gs:reflow temp 🪶 block written over the freed interval.
      const temp = insp.reflow.find(
        (r) => r.description === `gs:reflow:${occ.id}`
      );
      expect(temp, "gs:reflow temp block must exist").toBeTruthy();
      expect(temp!.title).toBe("🪶 Light Work");
      expect(new Date(temp!.start).getTime()).toBe(freedStart.getTime());
      expect(new Date(temp!.end).getTime()).toBe(freedEnd.getTime());
      expect(
        temp!.externalEventId,
        "temp block must have a real GCal id"
      ).toBeTruthy();

      // 6c. Makeup: a NEW materialized occurrence, same ISO week, other day.
      expect(skipJson.makeup.status, "makeup should materialize").toBe(
        "materialized"
      );
      const makeupStart = new Date(skipJson.makeup.start);
      expect(isoWeekKey(makeupStart)).toBe(isoWeekKey(freedStart));
      expect(
        new Date(
          Date.UTC(
            makeupStart.getUTCFullYear(),
            makeupStart.getUTCMonth(),
            makeupStart.getUTCDate()
          )
        ).getTime()
      ).not.toBe(
        new Date(
          Date.UTC(
            freedStart.getUTCFullYear(),
            freedStart.getUTCMonth(),
            freedStart.getUTCDate()
          )
        ).getTime()
      );
      const makeupEv = insp.events.find(
        (e) =>
          e.status === "materialized" &&
          new Date(e.start).getTime() === makeupStart.getTime()
      );
      expect(
        makeupEv,
        "makeup CommitmentEvent must be materialized"
      ).toBeTruthy();
      console.log(
        `[test] core OK — cancelled + temp 🪶 block + makeup ${skipJson.makeup.start} (same ISO week, diff day)`
      );

      // 6d. REFLOW PROOF (scheduler integration): the displaced work now
      //     lands INSIDE the freed interval, which only became schedulable
      //     because skip dropped the eligible 🪶 temp block there. This is
      //     the path B2 never exercised.
      const t1 = await (
        await req.get(`${BASE}/api/tasks/${createdTaskId}`)
      ).json();
      console.log(
        `[test] post-skip task scheduledStart=${t1.scheduledStart} scheduledEnd=${t1.scheduledEnd} (freed ${occ.start}–${occ.end})`
      );
      expect(
        t1.scheduledStart,
        "REFLOW: task must now be scheduled into the freed interval"
      ).toBeTruthy();
      const ts = new Date(t1.scheduledStart).getTime();
      const te = new Date(t1.scheduledEnd).getTime();
      expect(
        ts >= freedStart.getTime() && te <= freedEnd.getTime(),
        `REFLOW: task ${t1.scheduledStart}–${t1.scheduledEnd} must sit inside freed ${occ.start}–${occ.end}`
      ).toBe(true);
      console.log("[test] REFLOW PROVEN — work filled the freed interval");

      // 7. Move a still-materialized future occurrence to a DB-computed
      //    conflict-free slot (the real feed is mirrored far ahead, so the
      //    target must be computed against actual data) → 200 moved.
      const future = insp.events.find(
        (e) =>
          e.status === "materialized" &&
          new Date(e.start).getTime() > Date.now() &&
          e.id !== makeupEv!.id
      );
      expect(future, "need another materialized occurrence to move").toBeTruthy();
      // Far window (beyond the 14-day materialization horizon) so no
      // occurrence of this commitment exists that day — moveOccurrence's
      // same-day guard is satisfied by construction.
      const freeStart = findConflictFreeStart(
        createdCommitmentId!,
        120,
        60,
        240
      );
      const mv = await req.post(
        `${BASE}/api/commitments/${createdCommitmentId}/move`,
        { data: { occurrenceId: future!.id, newStart: freeStart } }
      );
      const mvText = await mv.text();
      expect(mv.status(), `valid move: ${mvText}`).toBe(200);
      expect(JSON.parse(mvText).moved).toBe(true);
      console.log(`[test] valid move OK → ${freeStart}`);

      // 7b. Move that occurrence onto the makeup occurrence (another active
      //     commitment block) → 409 typed conflict, no mutation.
      const conflict = await req.post(
        `${BASE}/api/commitments/${createdCommitmentId}/move`,
        {
          data: {
            occurrenceId: future!.id,
            newStart: makeupStart.toISOString(),
          },
        }
      );
      expect(conflict.status(), "move onto active commitment → 409").toBe(409);
      expect((await conflict.json()).code).toBe("move_conflict");
      console.log("[test] move conflict typed-rejected (409 move_conflict)");

      console.log("\n[test] ===== ALL PHASE C ASSERTIONS PASSED =====\n");
    } finally {
      await req.dispose();
    }
  });
});
