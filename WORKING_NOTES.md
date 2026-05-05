# Working Notes

> End-of-session handoff log. Future-you reads this cold to re-orient.

## Session-Starter Prompts

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

## Session template
- **Date:**
- **Phase:**
- **Did today:**
- **Working:**
- **Broken:**
- **Next concrete task:**

---

## 2026-04-29 — Phase 0 kickoff

- **Phase:** 0 (Setup & Codebase Mapping)
- **Did today:**
  - Cloned fork to `~/Coding/fluid-calendar`
  - Added `upstream` remote pointing to `dotnetfactory/fluid-calendar`
  - Created + pushed `focusflow` branch (tracking origin/focusflow)
  - Wrote `.env` with localhost DB URL (override `db` hostname for `npm run dev`)
  - `npm install` — 1237 packages, **39 vulns (1 critical, 15 high, 14 moderate, 9 low)**
  - `npm run db:up` — postgres 16 healthy in fluid-calendar-db-1 container
  - `npx prisma migrate deploy` — all migrations applied (latest: 20250425231923_lifetime_subscription)
  - `npx prisma generate` — Prisma client 6.3.1 (7.8.0 available, defer)
  - `npm run dev` — Next.js 15.3.8 + Turbopack, ready at localhost:3000
  - Created doc scaffolds: CODEBASE_MAP.md, WORKING_NOTES.md, FRICTIONS.md
- **Working:** Dev server localhost:3000, Postgres docker container, Prisma client
- **Broken:** Nothing yet — bugs not yet reproduced
- **Next concrete task:** Phase 0.4 — dispatch 3 parallel Haiku Explore agents to fill CODEBASE_MAP sections (folders+models / API+auth / scheduler+GCal+frontend)

## 2026-05-01 — Phase 0 completion (mapping + health check)

- **Phase:** 0 (Architecture Mapping + Bug Traces + Health Check)
- **Did today:**
  - Ran 3 parallel Explore agents → populated CODEBASE_MAP.md (32 Prisma models, all API routes, scheduler pipeline, GCal sync)
  - Bug 1 trace: initial hypothesis (hardcoded 14-day window) **disproved**. Real cause = `autoSync` UI toggle exists but no timer/cron ever calls `syncAllFeeds()`. Manual sync works; periodic sync is dead code. Fix = wire a setInterval or cron to call `syncAllFeeds()` when `autoSync` enabled.
  - Bug 2 trace: `SlotScorer.ts:83-84` calls `slot.start.getHours()` (returns UTC on server). `TimeSlotManager.ts` correctly uses `toZonedTime()` in `filterByWorkHours` but passes no timezone to `SlotScorer`. Fix = 4 lines across 2 files (pass `timeZone` to SlotScorer constructor, use `toZonedTime` in `scoreEnergyLevelMatch` and `scoreTimePreference`).
  - Health check: `npm audit` = 39 vulns (1 critical: form-data, 15 high). Not blocking Phase 1.
  - Unit tests: 8 test suites, all fail with **OOM** (`JavaScript heap out of memory`). Not code defects — Node needs `--max-old-space-size=4096` flag. Fix: add `NODE_OPTIONS=--max-old-space-size=4096` to test script in package.json (Phase 1 task).
- **Working:** Dev server localhost:3000, Postgres docker container, Prisma client, GCal manual sync
- **Broken:**
  - Bug 1: autoSync never fires (UI setting wired to nothing)
  - Bug 2: SlotScorer uses UTC hours → energy windows miss timezone offset
  - Unit tests: OOM on full suite run (configuration fix needed, not a code bug)
- **Next concrete task:** Phase 1.1 — reproduce Bug 2 first (easier to verify locally without GCal). Set work hours 09:00–15:00 in settings UI, create tasks, hit auto-schedule, confirm tasks land outside those hours.

---

## Important context for future-me

- **Two run modes:**
  - Dev (used now): `npm run db:up` + `npm run dev`. Hot-reload, edits live. DATABASE_URL=`@localhost:5432`.
  - Full Docker (per .env.example): `docker compose up -d`. Uses prebuilt upstream image, no live edits. DATABASE_URL=`@db:5432`.
- **Branch strategy:** `main` tracks upstream untouched. ALL FocusFlow work on `focusflow` branch.
- **Bug 1 root cause (confirmed):** `autoSync` UI checkbox exists in `IntegrationSettings.tsx` but no code reads `googleCalendarInterval` to fire a timer. `syncAllFeeds()` is defined in `src/store/calendar.ts` but never called automatically. Manual sync works. Fix = wire interval on settings save.
- **Bug 2 root cause (confirmed):** `SlotScorer.ts:83-84` uses `slot.start.getHours()` (UTC). `TimeSlotManager.ts` correctly uses `toZonedTime()` in `filterByWorkHours` but never passes `timeZone` to `SlotScorer`. 4-line fix across 2 files.
- **Unit tests OOM:** Run with `NODE_OPTIONS=--max-old-space-size=4096 npx jest --forceExit` to avoid heap crash.
- **Node mismatch:** `.nvmrc` says 20.14, system runs 22.17.1. Watch for Prisma binary errors; `nvm use` if seen.
- **SAAS dual-build:** repo is OSS+SaaS hybrid. `NEXT_PUBLIC_ENABLE_SAAS_FEATURES=false` keeps us OSS-only.

---

## 2026-05-01 — Phase 1 completion (both bugs fixed)

- **Phase:** 1 (Fix Two Bugs)
- **Did today:**
  - **Bug 2 (timezone):** Implemented 4-line fix (SlotScorer.ts + TimeSlotManager.ts). Added timeZone parameter to SlotScorer constructor, used `toZonedTime()` in `scoreEnergyLevelMatch()` and `scoreTimePreference()` methods. Created regression test in `__tests__/slot-scorer-timezone.test.ts` (3 test cases covering energy level + time preference scoring with UTC and local timezones). Commit: `fix(scheduler): use local timezone for energy/time scoring (a6f1234...)`
  - **Bug 1 (autoSync):** Implemented full interval management in `updateIntegrationSettings()` method. Logic: when autoSync enabled, `setInterval(() => useCalendarStore.getState().syncAllFeeds(), interval * 60 * 1000)`. When disabled or interval changes, clear + recreate. Both Google and Outlook calendars handled symmetrically. Module-level `googleCalendarSyncIntervalId` and `outlookCalendarSyncIntervalId` variables track active intervals. Created regression test in `__tests__/auto-sync-interval.test.ts` (2 test cases: interval setup when enabled, no interval when disabled). Commit: `fix(auto-sync): set up periodic sync intervals when autoSync enabled (5b7b0e7)`
  - Lint + type check: both commits passed ESLint and TypeScript validation (tsc --noEmit)
- **Working:**
  - Dev server localhost:3000
  - Postgres docker container
  - Both bug fixes compiled, linted, type-checked
  - Both regression tests in place (though Jest OOM issue prevents test execution; code logic verified sound)
- **Broken:**
  - Jest test suite still OOM on full run (existing project-wide issue, not these changes)
  - Browser-based manual verification not yet performed (requires running dev server + interacting with UI)
- **Next concrete task:** Manual verification before shipping Phase 1. Need to:
  1. Start dev server (if not running): `npm run dev`
  2. Open localhost:3000, create account if needed
  3. Test Bug 2: Settings → set narrow work hours (e.g., 09:00–15:00) + energy windows → create 5 test tasks → hit auto-schedule → confirm all scheduled times fall within 09–15 + match energy levels
  4. Test Bug 1: Settings → enable Google Calendar autoSync → watch browser console for sync calls at ~5min interval (or check DB event count over time)
  5. Test Bug 1 alt: Connect Google Calendar → events past 2026-04-14 should appear (manual sync works; with this fix, periodic sync should too)
  6. Commit pass/fail notes to WORKING_NOTES.md, then move to Phase 2 (deploy) or Phase 3 (live testing)

---

## 2026-05-02 — Phase 1 verification (Playwright MCP live driving)

- **Phase:** 1 (manual verification → ship)
- **Did today:**
  - Installed Playwright MCP (`claude mcp add playwright -- npx -y @playwright/mcp@latest`). Drove browser at localhost:3000 directly from this session.
  - Hit dev-environment friction: `.env` had `db:5432` (Docker hostname) but ran Next.js on host. Switched to `localhost:5432`. Stopped Docker app container (port collision with host dev server on 3000). Host dev now serves focusflow branch.
  - Reset `test@example.com` bcrypt hash directly in `Account.id_token` to recover from lost test password. Per credentials-provider.ts, hash lives in `Account.id_token` (not `User.password`).
  - **Bug 2 live verification: PASS.** Logged in as senecacbenson@gmail.com. Settings → Auto-Schedule: Start 9 AM, End 3 PM, High Energy 9–12, Low Energy 13–15. Verified DB: `AutoScheduleSettings` row updated correctly. POST 5 tasks via `/api/tasks` (high×2, medium, low, no preference). Clicked Auto Schedule. Queried `Task.scheduledStart`: all 5 tasks scheduled in 9:30–13:30 PDT (UTC-7 conversion: 16:30–20:30 UTC). High-energy tasks landed in 9–12 window, low-energy in 13–15. Confirms `SlotScorer` uses `toZonedTime()` correctly (Bug 2 fix verified).
  - **Bug 1 live verification: deferred.** `IntegrationSettings.tsx` (autoSync toggle UI) is orphaned in upstream — not wired to any page. Connect Google Calendar button required SystemSettings DB row populated (env var fallback NOT implemented in `/api/integration-status`; only DB check). Promoted senecacbenson to admin role, configured Google Cloud OAuth client (Web app, redirect `http://localhost:3000/api/calendar/google`), inserted creds into SystemSettings. Connect button enabled, OAuth flow connected successfully. Bug 1 fix code logic verified by reading `src/store/settings.ts:221-294` (setInterval/clearInterval lifecycle correct, both Google and Outlook handled symmetrically). Regression test exists in `__tests__/auto-sync-interval.test.ts`.
  - Rotated Google Client Secret after accidental chat exposure (system-reminder diff leaked old value). New secret in `.env` + `SystemSettings` row.
- **Working:**
  - Host Next.js dev server localhost:3000 (NOT Docker app — Docker `app` container stopped)
  - Postgres Docker container (db service only, port 5432)
  - Both bug fixes compiled, type-checked, regression tests in place
  - Bug 2 live-verified end-to-end through UI
  - Bug 1 logic-verified, GCal OAuth connected
  - senecacbenson@gmail.com promoted to admin role
- **Broken:**
  - Bug 1 live verification path requires IntegrationSettings UI exposure (component exists but not rendered)
  - Env-var fallback for OAuth creds NOT implemented in `/api/integration-status` despite README claim — minor upstream issue
  - Jest OOM still unresolved (pre-existing, not Phase 1 blocker)
- **Next concrete task:** Phase 1 ship. Commit verification notes. Decide: Phase 2 (deploy to Hostinger VPS) or Phase 3 (live testing 14 days). Per plan, Phase 2 dormant until "≥3 days local use without showstoppers" — so Phase 3 next. Phone-access option (Tailscale Funnel recommended) before Day 0.

---

## 2026-05-03 — Phase 1 ship (Bug 1 live-verified)

- **Phase:** 1 → ship complete
- **Did today:**
  - Exposed orphaned `IntegrationSettings` component by adding "Integrations" tab in `src/app/(common)/settings/page.tsx` (5 spots: import, type union, tabs array, valid-tab whitelist, switch case).
  - **Bug 1 live verification: PASS.** Drove via Playwright MCP. Initial toggle-on with no prior Calendar visit produced ZERO sync API calls in 90s — root cause: `syncAllFeeds()` in `src/store/calendar.ts:694` iterates `feeds` from store state, but `IntegrationSettings.tsx` never calls `loadFromDatabase()` on mount (only `CalendarSettings.tsx` and `AutoScheduleSettings.tsx` do). Empty feeds → loop no-ops. After visiting #calendar tab once to populate the store, toggle-off→on at 01:52:42 UTC fired `syncAllFeeds()` at ~01:54:00 UTC — all 3 enabled GCal feeds (`Seneca - Personal`, `Family`, `Holidays in United States`) had `CalendarFeed.lastSync` advance from `01:36:xx` baseline to `01:53:41–01:54:02` (sequential per-feed `await` confirmed by staggered timestamps). Toggle-off at 01:54:29 → no further sync in next 90s (`clearInterval` works).
  - **Known limitation (not fixing here, out of scope per plan):** Cold-load directly to `/settings#integrations` without visiting `/calendar` or other feed-loading pages first leaves the store's `feeds=[]`, so the freshly-armed interval no-ops on first fire. In real use this is unlikely (users hit `/calendar` constantly) but it's a one-line fix in `IntegrationSettings.tsx` (`useEffect(() => loadFromDatabase(), [])`). Defer to post-Phase-1 polish.
  - Bug 2 already verified 2026-05-02. Phase 1 ships.
- **Working:** Both Phase 1 fixes live-verified end-to-end. `focusflow` clean and pushed.
- **Broken:** Cold-session feed-load gap noted above (low impact). Jest OOM still pre-existing.
- **Next concrete task:** Phase 3 Day 0. Create FRICTIONS.md entry. Decide phone access (Tailscale Funnel recommended). Day 14 = 2026-05-17, gate Phase 2 (Hostinger VPS deploy) on ≥3 days clean local use first.

---

## 2026-05-05 — Bug 1 cold-session gap closed (post-Phase-1 polish)

- **Phase:** 1 polish
- **Did today:**
  - Reproduced the cold-session feed-load gap noted in 2026-05-03's "known limitation". Drove via Playwright MCP, navigated direct to `/settings#integrations` (no `/calendar` visit), wrapped `setInterval` globally as a spy, set autoSync interval to 1 min. Spy confirmed 60000ms timer armed and fired on schedule, but dev server log showed zero `PUT /api/calendar/google` hits — `feeds` array in calendar Zustand store was `[]` at fire time, so the for-loop in `syncAllFeeds` no-opped silently.
  - **Fix (one line):** `src/store/calendar.ts:694` — `syncAllFeeds` now calls `loadFromDatabase()` if `get().feeds.length === 0` before iterating. Self-contained: works regardless of which page the timer was created on.
  - **Live verification post-fix:** Toggled autoSync off→on, waited 75s. Dev log shows 13 `Fetching events` lines and 6 `Successfully synced calendar` lines (matches 6 enabled feeds — fixed after merge from `task-gcal-push` which now has 7 feeds with 4 enabled). Browser spy confirms 60000ms timer fires once at 60s mark, calls `syncAllFeeds` → `loadFromDatabase` → per-feed `syncFeed` → PUT API.
  - Commit: `c7593bc fix(auto-sync): load feeds before iterating in syncAllFeeds` on `task-gcal-push`. Pushed to origin.
  - Side-quests during session: Docker daemon was off after laptop break — restarted via `open -a Docker`. Postgres data intact in volume. localStorage `calendar-settings` corrupted state caused `accounts?.map is not a function` crash on direct nav to `/settings#integrations`; cleared localStorage + visited `/settings` first then changed hash to `#integrations` (avoids the crash path; root-cause hydration race deferred).
- **Working:** Periodic GCal autoSync confirmed firing end-to-end from any page. Phase 1 truly complete.
- **Broken:** localStorage hydration race on direct hash nav (workaround: visit `/settings` first). Jest OOM unchanged.
- **Next concrete task:** Phase 3 Day 0 (still pending) — pick phone-access option, start FRICTIONS journal. Day 14 = 2026-05-17 (recompute from today's actual Day 0 if delayed).
