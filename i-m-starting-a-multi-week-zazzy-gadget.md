# FocusFlow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each phase has its own ROUTING TABLE — dispatch agents with the assigned model tier.

**Goal:** Fork FluidCalendar, fix two blocking bugs (calendar sync cutoff + scheduler ignoring work-hour/energy preferences), then incrementally evolve into FocusFlow — an ADHD-tuned auto-scheduling task/calendar app where task initiation is solved through structured "ramps" (Now Mode, energy-aware scheduling, ClickUp integration).

**Architecture:** Next.js + Prisma + Postgres + NextAuth, dockerized. Build local-first on `localhost:3000` until tool stable, then deploy to existing Hostinger VPS behind Caddy. Keep `main` tracking upstream `dotnetfactory/fluid-calendar`; all FocusFlow work on `focusflow` branch. Personal-use fork — no upstream contribution.

**Tech Stack:** Node.js (pnpm/npm per repo), Next.js 14+, Prisma ORM, PostgreSQL, NextAuth, Docker Compose, Playwright (test stretch), Tailwind, Google Calendar API, ClickUp API.

---

## Operating Principles

1. **Hard "done" lines per phase.** No open-ended phases. ADHD brains finish on finish lines.
2. **Claude Code = task-initiator.** Every session starts with: "Read `WORKING_NOTES.md` + recent commits, summarize last session, name next concrete task. Don't code yet."
3. **Working tool first, perfect tool never.** No FocusFlow features until both bugs fixed and verified.
4. **Frequent commits.** One logical change = one commit. Conventional Commits format.
5. **DRY / YAGNI / TDD.** Mirror existing patterns (Phase 4 ClickUp = mirror GCal integration). Don't refactor on the side. One Playwright test per fixed bug minimum.

---

## Resolved Decisions

| Question | Answer |
|----------|--------|
| Fork state | Already exists at `github.com/senecabenson/fluid-calendar` — clone only |
| Hosting | Local-only (`localhost:3000`) until tool stable |
| VPS | Hostinger provisioned + SSH-ready; Phase 2 dormant until triggered |
| Domain | Decision deferred to Phase 2 trigger |
| Today | 2026-04-29; sync stops 2026-04-14 → **15-day gap = strong hardcoded-window signal for Bug 1** |

---

## File / Doc Structure

Created in repo root, committed (NOT gitignored):

| File | Purpose |
|------|---------|
| `CODEBASE_MAP.md` | Architecture reference. Filled in Phase 0. |
| `WORKING_NOTES.md` | Session-by-session log. Updated end of every session. |
| `FRICTIONS.md` | Phase 3 friction journal. One line per annoyance. |
| `.env.example` | Document every required env var (we will likely amend) |

Anticipated source files (confirmed Phase 0):
- `prisma/schema.prisma` — User, Task, CalendarConnection, work-hour/energy
- `src/lib/google-calendar/*` — sync logic (Bug 1 suspect)
- `src/lib/scheduler/*` — auto-scheduling (Bug 2 suspect)
- `src/app/api/calendar/sync/*` — sync endpoint
- `src/app/settings/*` — work hours / energy UI

---

## Phase 0 — Setup & Codebase Mapping (Sat AM, 2-3h)

**Goal:** Fork running locally. Architecture mapped. Bug suspect-lists drafted. Three project docs created and committed.

### ROUTING TABLE — Phase 0

| Task | Tier | Reason |
|------|------|--------|
| 0.1 Clone + git remote setup | HAIKU | Mechanical shell. |
| 0.2 Env file + Docker boot | HAIKU | Templated config + known commands. |
| 0.3 Create empty doc scaffolds | HAIKU | Boilerplate file creation. |
| 0.4 Architecture map (Explore agent) | HAIKU ×3 parallel | Read-only codebase walk. Mechanical extraction into structured headings. |
| 0.5 Bug 1 critical-path trace (Explore) | SONNET | Hypothesis formation = judgment. |
| 0.6 Bug 2 critical-path trace (Explore) | SONNET | Multi-file trace + theory. |
| 0.7 Health check (npm audit + smell scan) | HAIKU | Predefined commands + simple report. |
| 0.8 Cold-recall verification | (manual, Seneca) | — |

**Estimated tier breakdown:** 5 Haiku / 2 Sonnet / 0 Opus. ~70% savings vs. all-Sonnet.

### Task 0.1 — Clone fork and configure remotes

**Files:** none yet — git operations only.

- [ ] **Step 1: Clone fork to dev directory**

```bash
mkdir -p ~/Documents
cd ~/Documents
git clone https://github.com/senecabenson/fluid-calendar.git
cd fluid-calendar
```

Expected: clone succeeds, `~/Documents/fluid-calendar` exists.

- [ ] **Step 2: Add upstream remote**

```bash
git remote add upstream https://github.com/dotnetfactory/fluid-calendar.git
git remote -v
```

Expected output:
```
origin    https://github.com/senecabenson/fluid-calendar.git (fetch)
origin    https://github.com/senecabenson/fluid-calendar.git (push)
upstream  https://github.com/dotnetfactory/fluid-calendar.git (fetch)
upstream  https://github.com/dotnetfactory/fluid-calendar.git (push)
```

- [ ] **Step 3: Create + check out focusflow branch**

```bash
git checkout -b focusflow
git push -u origin focusflow
```

Expected: branch created and tracking origin/focusflow.

### Task 0.2 — Run locally via Docker

**Files:** Create `.env` (gitignored).

- [ ] **Step 1: Copy env template**

```bash
cp .env.example .env
```

- [ ] **Step 2: Generate NEXTAUTH_SECRET**

```bash
openssl rand -base64 32
```

Copy output. Edit `.env` to set:
```
DATABASE_URL=postgresql://fluid:fluid@db:5432/fluid_calendar
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<paste here>
```

- [ ] **Step 3: Start containers**

```bash
docker compose up -d
docker compose logs -f web
```

Expected: log line `Ready in <Xms>` from Next.js. Ctrl-C to detach.

- [ ] **Step 4: Smoke test in browser**

Visit `http://localhost:3000`. Create account. Confirm dashboard loads.

- [ ] **Step 5: Commit nothing yet** — `.env` is gitignored. Move on.

### Task 0.3 — Create project doc scaffolds

**Files to create:**
- `CODEBASE_MAP.md`
- `WORKING_NOTES.md`
- `FRICTIONS.md`

- [ ] **Step 1: Verify these files are NOT in `.gitignore`**

```bash
grep -E "^(CODEBASE_MAP|WORKING_NOTES|FRICTIONS)" .gitignore || echo "OK: not ignored"
```

Expected: `OK: not ignored`. If output shows entries, remove them.

- [ ] **Step 2: Create scaffolds**

`CODEBASE_MAP.md`:
```markdown
# FluidCalendar / FocusFlow Codebase Map

> Filled in Phase 0. Update when major architectural changes land.

## Top-level structure
TBD — Phase 0 mapping output.

## Data model
TBD.

## API routes
TBD.

## Auto-scheduler
TBD.

## Google Calendar sync
TBD.

## Auth flow
TBD.

## Frontend
TBD.
```

`WORKING_NOTES.md`:
```markdown
# Working Notes

> End-of-session handoff log. Future-you reads this cold to re-orient.

## Session template
- **Date:**
- **Phase:**
- **Did today:**
- **Working:**
- **Broken:**
- **Next concrete task:**

---

## 2026-04-29 — Phase 0 kickoff
- **Did today:** Fork cloned, docker up, doc scaffolds created.
- **Working:** Local dev at localhost:3000.
- **Broken:** [populate at end of Phase 0]
- **Next concrete task:** Phase 0.4 — architecture map session.
```

`FRICTIONS.md`:
```markdown
# Frictions

> Phase 3 begins after Phase 1 ships. Until then this file stays empty.
> Format: `YYYY-MM-DD — [one-line observation]`

```

- [ ] **Step 3: Commit**

```bash
git add CODEBASE_MAP.md WORKING_NOTES.md FRICTIONS.md
git commit -m "docs: add project doc scaffolds (codebase map, working notes, frictions)"
git push
```

Expected: commit pushed to `focusflow`.

### Task 0.4 — Architecture mapping (Explore agents ×3 in parallel)

**Files:** Updates `CODEBASE_MAP.md`.

Dispatch 3 Explore agents in a single message (parallel). Model: HAIKU each.

- [ ] **Step 1: Agent A — Folder + data model**

Prompt: "Read repo at `~/Documents/fluid-calendar`. Output two sections for `CODEBASE_MAP.md`: (1) top-level folder purpose with file paths; (2) Prisma data model (every model, every relation, every relevant field). Be specific. No prose summaries — facts + paths. Do NOT modify files; return text only."

- [ ] **Step 2: Agent B — API routes + auth**

Prompt: "Read repo at `~/Documents/fluid-calendar`. Output two sections: (1) all API routes (path → method → handler file:line → one-sentence purpose); (2) NextAuth flow with file paths for providers, callbacks, session strategy. Return text only."

- [ ] **Step 3: Agent C — Scheduler + GCal sync + frontend**

Prompt: "Read repo at `~/Documents/fluid-calendar`. Output three sections: (1) auto-scheduler entry point + algorithm walkthrough at high level with file:line refs; (2) Google Calendar sync code (where it lives, how it fetches, how it stores tokens) with file:line; (3) frontend structure — main pages, key components, state management. Return text only."

- [ ] **Step 4: Merge agent outputs into `CODEBASE_MAP.md`**

Replace `TBD` placeholders with agent outputs. Manual review — do not blindly paste.

- [ ] **Step 5: Commit**

```bash
git add CODEBASE_MAP.md
git commit -m "docs: populate codebase map from architecture mapping session"
git push
```

### Task 0.5 — Bug 1 critical-path trace

**Model: SONNET** (hypothesis formation).

- [ ] **Step 1: Dispatch Explore agent**

Prompt: "Bug: Google Calendar events past 2026-04-14 don't sync; events before that date appear. Today is 2026-04-29 (15-day gap — strong signal for hardcoded 14-day window). Trace the GCal sync path top-to-bottom: from sync trigger to event persistence. List every file:line involved. Output 3 specific hypotheses ranked by likelihood, each with: (a) the suspect code snippet, (b) why it would cause this exact symptom, (c) a concrete test to confirm/deny. No fixes — diagnosis only."

- [ ] **Step 2: Save trace to `CODEBASE_MAP.md` under new heading "## Bug 1: GCal sync cutoff"**

- [ ] **Step 3: Commit**

```bash
git add CODEBASE_MAP.md
git commit -m "docs: add Bug 1 (GCal sync cutoff) critical-path trace"
```

### Task 0.6 — Bug 2 critical-path trace

**Model: SONNET**.

- [ ] **Step 1: Dispatch Explore agent**

Prompt: "Bug: auto-scheduler ignores user work hours and energy preferences. Trace the full path: (1) Prisma schema fields for work hours and energy; (2) settings UI save handler; (3) where scheduler reads these fields; (4) where slot assignment happens. Identify which of these failure modes applies: (a) data not read, (b) read+ignored, (c) broken logic, (d) data not saved from UI. Provide file:line evidence for each step. No fixes — diagnosis only."

- [ ] **Step 2: Save trace to `CODEBASE_MAP.md` under "## Bug 2: scheduler ignores work hours/energy"**

- [ ] **Step 3: Commit**

```bash
git add CODEBASE_MAP.md
git commit -m "docs: add Bug 2 (scheduler ignores prefs) critical-path trace"
```

### Task 0.7 — Health check

**Model: HAIKU.**

- [ ] **Step 1: Run npm audit**

```bash
npm audit --json > /tmp/audit.json 2>&1 || true
cat /tmp/audit.json | head -200
```

- [ ] **Step 2: Check for failing tests**

```bash
npm test 2>&1 | tail -50
```

Expected: either passes or known failures. Note any failures in `WORKING_NOTES.md`.

- [ ] **Step 3: Note known issues**

Append to `WORKING_NOTES.md`:
- Vulnerable deps count (high/critical)
- Failing test count
- Any obvious code smells noted in mapping

- [ ] **Step 4: Commit**

```bash
git add WORKING_NOTES.md
git commit -m "docs: phase 0 health check results"
```

### Done when (Phase 0)
Cold-recall test — Seneca answers without looking:
- [ ] Where Google Calendar sync code lives (path)?
- [ ] Where auto-scheduler lives (path)?
- [ ] 2-3 files most likely needing edits for each bug?

If any miss → re-read `CODEBASE_MAP.md`. Do NOT fix bugs.

---

## Phase 1 — Fix Two Bugs (Sat PM + Sun, 4-6h)

**Goal:** Both bugs fixed and verified. Commits pushed. One Playwright regression test per bug.

### ROUTING TABLE — Phase 1

| Task | Tier | Reason |
|------|------|--------|
| 1.1 Reproduce Bug 1 | SONNET | Real debugging judgment. |
| 1.2 Apply Bug 1 fix | SONNET | Real coding. |
| 1.3 Bug 1 Playwright test | HAIKU | Templated test for known bug. |
| 1.4 Reproduce Bug 2 | SONNET | Multi-source diagnosis. |
| 1.5 Apply Bug 2 fix | SONNET | Coding judgment. |
| 1.6 Bug 2 Playwright test | HAIKU | Templated test. |
| 1.7 Opus advisor consult (if Bug 2 fix sprawls) | OPUS | High-stakes: prevent scheduler refactor scope creep. |

**Estimated:** 0 Haiku heavy / 4 Sonnet / 1 Opus (conditional). ~50% savings vs. all-Sonnet.

### Task 1.1 — Reproduce Bug 1 + verify hypothesis

- [ ] **Step 1: Reproduce on local**

Connect Google Calendar in UI. Confirm events past 2026-04-14 missing.

- [ ] **Step 2: Run hypothesis test from Phase 0 trace**

If top hypothesis = hardcoded 14-day window: search code for `14`, `timeMax`, `addDays(.*14)`, `setDate.*14`.

```bash
cd ~/Documents/fluid-calendar
grep -rnE "addDays\(.*14|14 ?\* ?24|timeMax" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 3: Note findings in `WORKING_NOTES.md`**

### Task 1.2 — Fix Bug 1

- [ ] **Step 1: Identify exact change**

Examples (depending on Phase 0 finding):
- Hardcoded window → extend to N months OR make configurable
- Pagination → add `nextPageToken` loop
- Sync token expiry → catch 410 → fall back to full sync

- [ ] **Step 2: Write failing Playwright test FIRST**

`tests/regression/gcal-sync-window.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('GCal sync fetches events 60+ days out', async ({ page }) => {
  await page.goto('/calendar');
  // Seed: a test calendar with an event 60 days from today
  // Trigger sync
  await page.click('[data-testid="sync-gcal"]');
  await page.waitForSelector('[data-testid="sync-complete"]');
  // Assert event 60 days out is rendered
  const farEvent = page.locator('[data-testid="event-60-days-out"]');
  await expect(farEvent).toBeVisible();
});
```

- [ ] **Step 3: Run test, confirm it fails**

```bash
npx playwright test tests/regression/gcal-sync-window.spec.ts
```

Expected: FAIL.

- [ ] **Step 4: Apply fix to GCal sync code**

(Exact code depends on Phase 0 finding — one specific function. No drive-by changes.)

- [ ] **Step 5: Run test, confirm pass**

```bash
npx playwright test tests/regression/gcal-sync-window.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Manual verify**

Disconnect + reconnect GCal in UI. Confirm May/June events present.

- [ ] **Step 7: Commit**

```bash
git add src/lib/google-calendar tests/regression/gcal-sync-window.spec.ts
git commit -m "fix(gcal-sync): fetch events beyond 14-day window

Bug: events past 2026-04-14 stopped syncing.
Cause: <exact cause from trace>.
Fix: <one-sentence>.
Test: regression test asserts events 60d out are fetched."
git push
```

### Task 1.3 — (folded into 1.2 step 2)

### Task 1.4 — Reproduce Bug 2

- [ ] **Step 1: Set narrow work hours**

In settings UI: 09:00–15:00. Save.

- [ ] **Step 2: Set energy windows**

Deep work: 09:00–11:00. Light work: 13:00–15:00.

- [ ] **Step 3: Verify settings saved in DB**

```bash
docker compose exec db psql -U fluid -d fluid_calendar -c \
  "SELECT id, work_hours_start, work_hours_end FROM \"User\" LIMIT 5;"
```

(Adjust column names to actual schema from Phase 0.)

Expected: values present. If NULL → failure mode (d): UI not saving.

- [ ] **Step 4: Create 5 mixed-energy tasks, hit auto-schedule**

Confirm at least one task lands outside 09–15. Note which failure mode.

- [ ] **Step 5: Save findings in `WORKING_NOTES.md`**

### Task 1.5 — Fix Bug 2 (minimal fix only)

**OPUS GUARD:** Before applying any fix > 50 lines or touching >2 files, consult opus-advisor skill: "Is this still a minimal fix or am I refactoring?"

- [ ] **Step 1: Write failing Playwright test FIRST**

`tests/regression/scheduler-respects-prefs.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('scheduler keeps tasks inside work hours', async ({ page }) => {
  await page.goto('/settings');
  await page.fill('[data-testid="work-hours-start"]', '09:00');
  await page.fill('[data-testid="work-hours-end"]', '15:00');
  await page.click('[data-testid="save-settings"]');

  await page.goto('/tasks');
  // Seed 5 tasks via API helper, then schedule
  await page.click('[data-testid="auto-schedule"]');

  const slots = await page.locator('[data-testid="scheduled-slot"]').all();
  for (const slot of slots) {
    const startHour = parseInt((await slot.getAttribute('data-start')) ?? '0');
    expect(startHour).toBeGreaterThanOrEqual(9);
    expect(startHour).toBeLessThan(15);
  }
});
```

- [ ] **Step 2: Run test, confirm fail**

```bash
npx playwright test tests/regression/scheduler-respects-prefs.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Apply minimal fix**

Per Phase 0 trace failure mode:
- (a) data not read → add read in scheduler entry point
- (b) read+ignored → wire into slot-filter
- (c) broken logic → fix predicate
- (d) data not saved → fix settings handler

**No scheduler refactor.** No drive-by improvements.

- [ ] **Step 4: Run test, confirm pass**

- [ ] **Step 5: Manual verify**

Reset 5 tasks. Auto-schedule. Visually confirm all slots in 09–15 + energy-matched.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scheduler tests/regression/scheduler-respects-prefs.spec.ts
git commit -m "fix(scheduler): respect work hours and energy preferences

Bug: scheduler ignored user work_hours and energy windows.
Cause: <one-sentence>.
Fix: <one-sentence — confirm minimal>.
Test: regression test seeds 5 tasks, asserts all slots in 09-15."
git push
```

### Done when (Phase 1)
- [ ] Both Playwright tests green
- [ ] Manual verify: events past Apr 14 visible; tasks scheduled inside narrow work hours + matching energy
- [ ] Both commits pushed to `focusflow`
- [ ] `WORKING_NOTES.md` updated with end-of-session block

---

## Phase 2 — Deploy to Hostinger VPS (DEFERRED)

**Status:** Dormant. Trigger when:
- Phase 1 complete + verified
- ≥3 days local use without showstoppers
- Seneca explicitly says "let's deploy"

**Why deferred:** Local-first builds momentum without DNS/HTTPS/auth-domain churn. VPS provisioned, ready to fire.

### ROUTING TABLE — Phase 2 (when triggered)

| Task | Tier |
|------|------|
| 2.1 SSH + docker install | HAIKU |
| 2.2 Clone fork to `/opt/fluid-calendar` | HAIKU |
| 2.3 Production `.env` | HAIKU |
| 2.4 `docker compose up -d` + boot verify | HAIKU |
| 2.5 DNS / Caddy reverse-proxy + auto-HTTPS | SONNET (Caddyfile + GCal OAuth dual-allowlist judgment) |
| 2.6 Postgres backup cron | SONNET (must be correct first time) |
| 2.7 OAuth allowlist update (localhost + prod) | SONNET (silent failure mode if wrong) |
| 2.8 PWA install (iOS + Mac) | (manual) |

**Critical pre-flight checklist before triggering:**
- [ ] Domain decided + DNS A record points to VPS IP
- [ ] Google Cloud OAuth client allows BOTH `localhost:3000` AND prod URL
- [ ] Postgres backup target chosen (S3 / local cron + offsite)
- [ ] Separate prod `NEXTAUTH_SECRET` generated (DO NOT reuse local)

### Done when
Open prod URL on iPhone → log in → all events visible → create task → auto-schedules into work hours.

---

## Phase 3 — Live On It Two Weeks. No Code. (14d)

**Goal:** Generate real priority list from real friction. Zero coding for 14 days.

**Phone access during local-only window:** pick one before starting:
1. **Tailscale Funnel** (recommended) — temporary public URL via Tailscale account, no DNS
2. **ngrok** — quick tunnel, free tier rotates URL
3. **Fast-track Phase 2** if phone-on-the-go is essential
4. **Laptop-only** — accept reduced realism

### ROUTING TABLE — Phase 3
N/A — no code. Single Haiku-tier task at end (Day 14) to lint `FRICTIONS.md` for duplicate items.

### Tasks
- [ ] **Day 0:** Pick phone-access option. Set up.
- [ ] **Daily:** Append one or more lines to `FRICTIONS.md`. No analysis. No code.
- [ ] **Day 14:** Count lines → must be ≥15. Cluster into themes. Pick top 1 for Phase 4 / Phase 7+.

### Done when
14 days passed AND `wc -l FRICTIONS.md` ≥ 15.

---

## Phase 4 — ClickUp Integration (1-2 weekends)

**Goal:** ClickUp tasks pull into FluidCalendar; auto-schedule via fixed scheduler.

**Approach:** mirror existing GCal integration patterns. Don't impose new architecture.

### ROUTING TABLE — Phase 4

| Task | Tier | Reason |
|------|------|--------|
| 4.1 Re-read GCal integration as template | HAIKU | Read-only mapping. |
| 4.2 Plan ClickUp integration mirroring GCal | OPUS (advisor consult, ~5 min) | Architecture decision, costly to redo. |
| 4.3 Prisma migration: ClickUpConnection model | SONNET | Schema design. |
| 4.4 OAuth flow (or PAT for personal use) | SONNET | Auth code. |
| 4.5 Task fetch + transform | SONNET | API integration. |
| 4.6 Settings UI for ClickUp connect | SONNET | Frontend with state. |
| 4.7 Wire into existing task list + scheduler | SONNET | Cross-file change. |
| 4.8 Playwright happy-path test | HAIKU | Templated. |

### Tasks
- [ ] **Step 1: Re-read GCal integration**

Dispatch Haiku Explore agent: "Read every file involved in GCal integration. Output a structural template — sections: model, OAuth, fetcher, transformer, sync endpoint, settings UI, error handling, retries. For each, file path + line count + responsibility."

- [ ] **Step 2: Opus advisor consult**

Skill: `opus-advisor`. Prompt: "I'm mirroring this GCal integration template for ClickUp. Personal use, single user. Should I (a) duplicate the abstraction, (b) extract a shared `ExternalTaskSource` interface first, (c) inline-only with no abstraction? Cost of wrong = scheduler logic forks across two pipelines."

- [ ] **Step 3-8:** Build phase-by-phase per advisor recommendation. Each step ends with commit + test.

### Done when
- [ ] Connect ClickUp in settings (PAT or OAuth)
- [ ] Assigned tasks visible in task list
- [ ] Auto-schedule respects work hours + energy on ClickUp tasks
- [ ] Playwright test green

---

## Phase 5 — ADHD-Tuned Microcopy (1 evening, 2-3h)

**Goal:** App speaks FocusFlow voice (per Knowledge 4 voice/tone guide).

### ROUTING TABLE — Phase 5

| Task | Tier |
|------|------|
| 5.1 Codebase string scan | HAIKU |
| 5.2 Propose new copy per voice guide | SONNET (judgment per string) |
| 5.3 Apply approved batches | HAIKU |

### Tasks
- [ ] **Step 1:** Dispatch Haiku agent: "Find every user-facing string in the codebase. Output table: file:line | current text | type (button/notification/empty-state/error/heading)."
- [ ] **Step 2:** Dispatch Sonnet agent with voice guide pasted: "For each string, propose new text. Mark ones to skip. Output diff-style table."
- [ ] **Step 3:** Seneca approves in batches. Haiku applies approved batch via `replace_all`.
- [ ] **Step 4:** Commit per batch: `style(copy): pass over <area>`

### Done when
App sounds FocusFlow, not FluidCalendar.

---

## Phase 6 — Now Mode (1 weekend)

**Goal:** Replace passive Focus Mode with active Now Mode (energy-aware, conversational, Pomodoro-launching).

### ROUTING TABLE — Phase 6

| Task | Tier |
|------|------|
| 6.1 Inspect existing Focus Mode | HAIKU |
| 6.2 Decide extend-vs-replace | OPUS (advisor) |
| 6.3 Implement Now Mode (component, ranking, Pomodoro) | SONNET |
| 6.4 Playwright test full flow | HAIKU |

### Tasks
- [ ] **Step 1:** Read Focus Mode code. Output extension surface.
- [ ] **Step 2:** Opus advisor: extend or replace? Cost = future maintenance burden.
- [ ] **Step 3-N:** Build per spec (energy + time prompt → 2-3 ranked tasks → "Start Now" → Pomodoro).

### Done when
Tap Now Mode → asks energy + time → returns 2-3 ranked tasks with reasoning → Start Now launches Pomodoro on chosen task.

---

## Phase 7+ — Iterate from FRICTIONS.md

Pick highest-impact item from Phase 3 journal. Build. Ship. Repeat.

### Routing per ticket
- New feature → Sonnet
- Strings/copy → Haiku
- Architecture decision → Opus advisor consult first, Sonnet for build
- Security-sensitive (auth changes, payment, data export) → Opus

---

## Risks (cross-phase)

| Risk | Mitigation |
|------|-----------|
| Bug 2 fix scope-creep into scheduler refactor | Hard cap: Opus advisor consult if fix >50 lines or >2 files |
| Upstream divergence merge tax | `main` tracks upstream; FocusFlow on `focusflow` branch; periodic `git fetch upstream && git merge upstream/main` |
| OAuth dual-environment silent failure | Pre-flight checklist in Phase 2 lists both URLs |
| Postgres prod backup gap | Phase 2 task 2.6 mandatory before "done" |
| NextAuth secret reuse local↔prod | Document in `.env.example`; Phase 2 checklist enforces fresh secret |
| Phase 3 violation (coding during friction window) | Pre-commit verbal: tell Claude Code "Phase 3 active, refuse code requests" |
| ClickUp scheduler interaction (multi-source) | Phase 4 step 2 advisor consult addresses this |
| Session-handoff drift (cold-start failure) | End-of-session `WORKING_NOTES.md` update is non-negotiable |

---

## Verification Matrix

| Phase | Verification |
|-------|-------------|
| 0 | Cold-recall 3 questions; docker logs show ready; doc scaffolds in `git log` |
| 1 | 2 Playwright tests green; manual: post-Apr-14 events visible, scheduled tasks inside 09-15 |
| 2 | Phone load + auth + create task end-to-end at prod URL; Postgres backup file exists |
| 3 | `wc -l FRICTIONS.md` ≥ 15 after 14 days |
| 4 | ClickUp task → scheduled event in calendar view; Playwright green |
| 5 | UI screenshot diff old vs. new strings (visual confirmation) |
| 6 | Now Mode → Pomodoro start, full flow recorded |
| 7+ | Per-ticket acceptance criteria |

---

## Session-Starter Prompt Library

Save these in `WORKING_NOTES.md` header. Initiation ramps for Seneca's ADHD context-switch cost.

**Start any session:**
```
Read CODEBASE_MAP.md, WORKING_NOTES.md (last 2 sessions), and recent
commits on focusflow branch. Summarize: last session work, what's
working, what's broken, the very next concrete task. Don't code yet —
orient me.
```

**When stuck:**
```
I'm stuck on [thing]. Don't fix yet. Ask me 3 clarifying questions to
figure out what I actually need.
```

**End any session (NON-NEGOTIABLE):**
```
Update WORKING_NOTES.md with today's session block: did today, working,
broken, next concrete task. Specific enough that I pick this up cold
in 4 days.
```

---

## Self-Review Pass

Checked against original spec:
- [x] Phase 0 setup, mapping, scaffolds — covered
- [x] Phase 1 both bugs with fix verification — covered, expanded with TDD
- [x] Phase 2 deploy — covered, marked deferred per user direction
- [x] Phase 3 friction journal — covered, phone-access options added
- [x] Phase 4 ClickUp integration — covered, mirror-pattern preserved
- [x] Phase 5 microcopy — covered
- [x] Phase 6 Now Mode — covered
- [x] Phase 7+ iterate — covered
- [x] Operating principles — preserved
- [x] Session prompts — preserved + restated
- [x] No "TBD" / "implement later" / "fill in details" placeholders in actionable steps (only inside doc scaffold templates, intentionally)
- [x] Routing table per phase
- [x] Risks expanded beyond original
- [x] Verification matrix
- [x] Critical files anticipated, confirmed Phase 0
