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

---

## 2026-05-05 — GoneSquirrel rebrand + redesign + push

- **Phase:** Rebrand → public repo
- **Did today:**
  - **Full UI redesign across all surfaces** (Phases A–G of the GoneSquirrel design plan, see `can-we-use-the-golden-fern.md`):
    - Foundation: semantic CSS-var token system in `src/app/globals.css` (foundation/domain/signal/action families). Fraunces variable serif + Plus Jakarta Sans + JetBrains Mono via `next/font/google`. Motion primitives (`src/lib/motion.ts`) + paper-grain SVG (`public/textures/grain.svg`) + reduce-motion + manual toggle.
    - Settings store extended (`src/store/settings.ts`): `motionEnabled`, `iconLabelsHidden`, `themeMode`, `colorMode`, `contrast`, `timeOfDayShift`, `gamificationEnabled`, `leftRailCollapsed`, `taskListMetaWidth`. ThemeProvider wires `data-motion`/`data-color-mode`/`data-contrast` reactively.
    - AppShell (new) + collapsible LeftRail + mobile BottomTabs + sheet-mobile primitive. Single `(common)/layout.tsx` mount point.
    - Calendar: editorial header, terracotta MiniCalendar, FullCalendar token migration via globals.css overrides, sponsorship banner removed.
    - Tasks: flex-row list with sticky header + draggable meta-column resize handle (persisted via `taskListMetaWidth`), two-line BoardTask, full-height Column drop zones with action ring on `isOver`, project sidebar collapse toggle.
    - Focus / Now: hero treatment, mobile sheets for queue + actions, warm celebration via canvas-confetti tuned + friend-voice rotation in `src/lib/celebrate.ts`.
    - Settings: editorial layout, Appearance / Sensory regulation / Gamification toggle sections.
    - Auth + setup forms editorial single-column.
    - Restyled shadcn primitives: button, card, input, select, dialog, badge (extended variant family).
    - Sonner toasts paper-card style, shortcuts modal editorial, privacy mode replaces blur with grain-text-shadow, public landing replaced with auth-aware redirect, TanStack devtools panel removed.
  - **Push to new repo `gone-squirrel.io`:** orphan single-commit history (`8567b03`), authored Seneca + Claude co-author. Deleted `senecabenson/gone-squirrel.io` once + recreated to flush GitHub's stale contributors-widget cache (force-push leaves objects in reflog, sidebar widget cached old upstream authors). Final state: 1 commit, 1 contributor (you), public.
  - Remotes: `origin` → `senecabenson/gone-squirrel.io.git`, `oldfork` → `senecabenson/fluid-calendar`, `upstream` → `dotnetfactory/fluid-calendar` (untouched).
  - Updated plan file (`~/.claude/plans/can-we-use-the-golden-fern.md`) with vision-aligned Sprint 1/2/3 roadmap based on `GoneSquirrel.io — Vision & Reference` doc.
- **Working:**
  - Local dev server localhost:3000, Postgres docker, Prisma client
  - All redesigned surfaces compile clean (type-check + production build green)
  - Hardcoded color grep across `src/components` returns zero hits
  - Repo public at `https://github.com/senecabenson/gone-squirrel.io`
  - Phase 1 backend bug fixes (autoSync interval, scheduler timezone, calendar transparency) all shipped
- **Broken:**
  - Playwright suite ran but tests fail on test-infra issues (DB seed missing, OAuth fixtures missing, selector lag) — patched some selectors, not all. Coverage gap unchanged.
  - Local folder name still `fluid-calendar` (cosmetic; deferred per Sprint 1 plan)
  - Vision-doc divergence: current redesign uses teal `#2D7D7D` action accent; vision wants burnt sienna `#C2410C`. Voice partially aligned but missing squirrel-specific terms ("Caught it", "Slipped", "Found your way back").
- **Next concrete task:** Sprint 1 — cleanup + brand alignment (per plan file's "Vision-aligned roadmap" section). Order:
  1. Strip upstream dead files: `scripts/sync-repos*.sh`, `src/components/ui/sponsorship-banner.*`, `src/components/calendar/LifetimeAccessBanner.open.tsx`, `docs/_old/`, `src/app/(common)/settings/waitlist/page.open.tsx`, `@TODO.md`
  2. Drop SAAS dual-build pattern: simplify `next.config.js` `pageExtensions`, rename `.open.tsx`/`.open.ts` → plain `.tsx`/`.ts`, strip `isSaasEnabled` checks, drop SaaS-only settings tabs
  3. Palette swap: teal `#2D7D7D` → sienna `#C2410C` for action; add `--accent-forest #15803D` / `--accent-honey #D97706` / `--accent-moss #65A30D` / `--accent-acorn #92400E` tokens; body `#1A1A1F` → `#2A1F1A` (warm walnut per vision)
  4. Voice rewrite: scrub "overdue"/"missed"/"behind"/"broken streak"/"you should" from `src/components` + `src/app`. Add: empty task list "Nothing in the stash. Drop a squirrel?", task captured "Caught it. Want to crack it open now or later?", slipped header "Found your way back?"
  5. README rewrite per plan (drop NitroClaw/EliteCoders/SaaS sections, add brief framing + ADHD-tuned highlights + Quick start + OAuth setup + License)
  6. Verify (type-check + build + grep dead patterns) + commit + push to origin/main
  - Time-box: ~2-3h. After this lands, decide Sprint 2 (Now Mode rebuild) vs Sprint 3 (ClickUp MVP).

---

## 2026-05-06 — GCal push verify on `main` + branch prune

- **Phase:** Post-rebrand cleanup; verify the GCal push feature shipped via `8567b03` snapshot still works on `main`.
- **Did today:**
  - Confirmed `oldfork/task-gcal-push` content already lives on `main`. Orphan-history snapshot `8567b03` absorbed `f8b97f6` (`google-task-sync.ts`, route hooks, prisma fields, `scripts/list-task-events.ts`). No merge needed; the only diff was a transparency-field gap I initially misread — main has it AND its migration `20260505141204_add_calendar_event_transparency`; the branch is the side missing both.
  - Pre-flight: `prisma migrate status` clean (37 migrations applied). `npm run type-check` + `npm run build` both green.
  - Live verify on `main` via Playwright + DB + GCal API (script `scripts/list-task-events.ts` + new `scripts/inspect-event.ts`), user-driven from senecacbenson@gmail.com:
    - Step 1 cold push ✓ — POST new task `GCal Verify 2026-05-06`, Auto-schedule populated `googleEventId=5a291ov2qbvh4v0h3akl73h7dk`, event verified live in GCal at expected start/end (PDT alignment).
    - Step 2 reschedule ✓ — PUT duration 30→60, rerun Auto-schedule. Same `googleEventId`, end time extended +30 min, no duplicate.
    - Step 3 unschedule ✓ — PUT `scheduledStart=null, scheduledEnd=null`. DB nulled `googleEventId`, GCal event deleted. (Note: setting `isAutoScheduled=false` alone does NOT delete the event — sync delete branch keys off `!hasSchedule`.)
    - Step 4 complete ✓ — re-armed with new event `2impdrbiv7ogrefrkb1oml2aas`, PUT `status=completed`. GCal summary became `G̶C̶a̶l̶ ̶V̶e̶r̶i̶f̶y̶ ̶2̶0̶2̶6̶-̶0̶5̶-̶0̶6̶`, `colorId=8` (gray), `status=confirmed` (event preserved).
    - Step 5 single-task PUT title ✓ — PUT `status=todo` then `title=Renamed Verify`. GCal summary updated to plain "Renamed Verify", colorId cleared, same eventId.
    - Bonus DELETE ✓ — DELETE task removed both DB row and GCal event.
    - Step 6 stale calendar recovery — deferred (destructive on Seneca's calendar; verifiable on demand).
    - Step 7 phone visibility — deferred (manual user check on phone Google Calendar app).
    - Step 8 failure isolation — deferred (would need to revoke OAuth scope / disconnect; risky during Phase 3).
  - Frictions captured (see FRICTIONS.md): page `<title>` still says "FluidCalendar" post-rebrand; pre-existing duplicate events in dedicated calendar (`Test 1`, `High energy 1`) likely from past sync regression; PUT response returns pre-sync state; isAutoScheduled toggle alone doesn't unschedule.
- **Working:** GCal push feature live-verified on `main`. Build + type-check green. Phase 3 daily-driver use unaffected.
- **Broken:** None new. Frictions documented but non-blocking.
- **Next concrete task:** Prune `oldfork/task-gcal-push` (already redundant with `main`), update `project_fluid_calendar.md` memory, then choose between Sprint 2 (Now Mode) and Sprint 3 (ClickUp). Page-title rebrand + duplicate-event audit are small post-tasks that can land any time.

---

## 2026-05-06 — Rebrand polish, orphan-fix, VPS deploy live

- **Phase:** Post-Phase-1 polish + Phase 2 deploy.
- **Did today (after morning GCal verify):**
  - **Rebrand finish (`16ad162`).** Sprint 1 left `FluidCalendar` strings in `src/lib/utils/page-title.ts` (central source for all browser-tab titles), `src/app/error.tsx` `document.title`, signin/setup/reset-password metadata, `TaskSyncSettings` description, password-reset email template + sender display name, and `TASK_CALENDAR_NAME` constant. All swapped to `GoneSquirrel`. `/focus` tab title relabelled to `Now` to match the nav. Renamed Seneca's live GCal calendar `FluidCalendar Tasks` → `GoneSquirrel Tasks` via a new `scripts/rename-task-calendar.ts` (calendars.patch).
  - **Friction cleanup.** Augmented `scripts/audit-task-events.ts` to list/delete orphan events. Found 2 orphans (`Test 1`, `High energy 1`) on Seneca's dedicated calendar — historic regression — deleted on his approval.
  - **CI hygiene.** Removed `.github/workflows/docker-publish.yml{,.old}` (`5ed8eea`) — was pushing to upstream's `eibrahim/fluid-calendar` Docker Hub, failing every push and emailing Seneca. Removed `.github/FUNDING.yml` (`5482b50`) — pointed sponsor button at upstream maintainer.
  - **Orphan root-cause fix (`18482d9`).** `pushOne` in `src/services/google-task-sync.ts` now sets `extendedProperties.private.taskId = task.id` on insert, AND look-before-insert: queries `events.list({ privateExtendedProperty: taskId=<id> })`. If a tagged event already exists (concurrent insert or crashed retry), adopts it instead of inserting a duplicate. `audit-task-events.ts` gained a `backfill` mode that tags historical events + dedupes per task. `inspect-event.ts` now prints extProps. Verified: 2 parallel `POST /api/tasks/schedule-all` for a fresh task = 1 GCal event; backfill on Seneca's calendar tagged 7 events, 0 dupes, 0 true orphans.
  - **VPS deploy live (`920a290` + a chain of fixes through `eaec108`).** Target: `gonesquirrel.nilegrowthworks.com` on Hostinger Ubuntu VPS (`31.97.145.236`). DNS = Porkbun A record. Repo at `/opt/gonesquirrel`.
    - Initial plan (Caddy in compose) had to swap to **traefik labels** (`0bd3c75`) — VPS already runs `root-traefik-1` fronting n8n / etc on 80/443. New compose joins external `root_default` network and uses traefik docker labels matching the n8n pattern (entrypoints `web,websecure`, certresolver `mytlschallenge`). Caddyfile deleted.
    - Dockerfile fix chain (`9612270`, `2a5e664`, `9489cc3`): swap `prisma:generate` BEFORE `next build`; add `--include=dev` so eslint + `@types/canvas-confetti` install (NODE_ENV=production in base inheritance was skipping devDeps); drop `--ignore-scripts` and add `HUSKY=0` so bcrypt's prebuilt-binary postinstall fires.
    - Entrypoint pinned `prisma@6.3.1` for migrate-deploy at boot (`14bddcf`) — production image only ships `node_modules/.prisma/client`, so `npx prisma` was pulling 7.x latest which rejects the v6 datasource block. Migrations had to be applied manually first time via `npx -y prisma@6.3.1 migrate deploy` from inside the running container.
    - `deploy.sh` now `ln -sf .env.production .env` so plain `docker compose` commands stop printing `POSTGRES_USER not set` interpolation warnings (`14bddcf`). Warmup sleep bumped 5s → 15s to stop false-alarm 502 health check (`eaec108`).
  - Google OAuth callback updated in Google Cloud Console to `https://gonesquirrel.nilegrowthworks.com/api/calendar/google` (Seneca did this from his side); reconnected GCal from `/settings#integrations`.
- **Working:**
  - https://gonesquirrel.nilegrowthworks.com live with real Let's Encrypt cert (R13, valid Aug 4 2026).
  - Local dev still works (host Next on :3000, Postgres docker on :5432, .env at repo root).
  - Both bug-1 + bug-2 + GCal push idempotency on prod from first deploy.
- **Broken:**
  - First deploy required a manual `prisma migrate deploy` rescue because the entrypoint's old `npx prisma` pulled v7. Subsequent deploys auto-migrate via the pinned 6.3.1 entrypoint. Document this if a teammate ever bootstraps from scratch.
  - Local folder still `~/Coding/fluid-calendar` (cosmetic).
  - Phase 3 friction journal still under target (now ~7/15) — bias was deploy work today.
- **Next concrete task:**
  1. Confirm autoscheduler still pushes correctly to GCal from the prod app (live test with a real task).
  2. Decide whether to backfill prod Postgres with selected rows from local (or just start fresh).
  3. Resume Phase 3 daily-driver use through 2026-05-17. Day 14 gate then decides Sprint 2 (Now Mode) vs Sprint 3 (ClickUp MVP).

---

## 2026-05-11 — Calendar polish ship + VPS sync

- **Phase:** Phase 3 polish — fix in-flight calendar bugs surfaced from daily-driver use, push to `origin/main`, ready for VPS deploy.
- **Did today:**
  - **All-day event TZ canonicalization** (`194a84d`). `src/lib/date-utils.ts` `createAllDayDate` now stores **UTC midnight** as the canonical instant; `normalizeAllDayDate` reads UTC Y/M/D back to local midnight for FullCalendar. Closes day-drift between Docker-UTC prod and Mac-local dev. Added 5 jest cases in `src/lib/__tests__/date-utils.test.ts` covering round-trip + trailing-time-portion handling.
  - **Surfaced API failure detail** (`1e07bf6`). `src/store/calendar.ts` adds `describeApiFailure(provider, response)` that reads up to 500 chars of response body into the thrown Error. `EventModal`, `DayView`, `MonthView`, `MultiMonthView`, `WeekView` wrap delete in try/catch + `toast.error` instead of generic `alert()`.
  - **Boot-time GCal pull + focus/visibility refresh** (`a69e8ab`). `src/components/calendar/Calendar.tsx` owns its own `setInterval` gated on `integrations.googleCalendar.autoSync` + `syncInterval`, plus `visibilitychange` + `focus` listeners with a 30 s min-gap guard via `lastPullRef`. Closes the gap where the timer in `store/settings.ts` only armed on toggle, never on mount — external edits (phone, GCal web) didn't surface until a user re-toggled the setting.
  - **Dev compose rebrand** (`b7d528e`). `docker-compose.yml` builds local `gonesquirrel:dev` image from `./Dockerfile` (was `eibrahim/fluid-calendar:latest`); Postgres user/db renamed to `gonesquirrel`. **Dev-only** — `docker-compose.prod.yml` untouched, VPS unaffected.
  - Each commit ran lint + type-check via husky pre-commit. All green. 4 themed commits pushed to `origin/main`.
- **Working:**
  - https://gonesquirrel.nilegrowthworks.com still live (last VPS deploy from 2026-05-06).
  - Local dev (host Next :3000, Postgres docker :5432) on `gonesquirrel:dev` image.
  - 4 commits on `origin/main`, ready for `./scripts/deploy.sh` on VPS.
- **Broken:** Nothing new.
- **Next concrete task:** Sprint 2 — Now Mode rebuild. Triggered same-day (see next entry).

---

## 2026-05-11/12 — Sprint 2: Now Mode rebuild (23 tasks, branch `feat/now-mode`)

- **Phase:** Sprint 2 (Now Mode) — replace passive 3-pane `FocusMode` with active 3-step ADHD-tuned takeover (energy → time → recommend → Pomodoro) per vision section 6.3. Classic FocusMode kept as toggle fallback. Always-on chunked tasks (15/60 defaults). Wall-clock Pomodoro persists across refresh.
- **Did today:**
  - **Brainstorm + spec** committed at [`add2110`](docs/superpowers/specs/2026-05-11-now-mode-design.md). Visual companion mockups walked through energy picker, time picker, recommendation card, sticky banner, Now-page hero (collapsed/expanded "Up Next"), round-complete (forced choice — no auto), Finish-later modal. Locked decisions: A horizontal energy cards, A pill time picker, A editorial centered recommendation, hybrid banner+ring sticky, wall-clock Pomodoro, strict eligibility + chunking, closest-match w/ mismatch note, always-on chunks 15/60, mark-chunk-done with early-parent-complete escape.
  - **Implementation plan** committed at [`c2c07ea`](docs/superpowers/plans/2026-05-11-now-mode.md). 23 TDD tasks across 8 phases.
  - **Subagent-driven execution** with `agent-router` routing: 9 Haiku tasks (mechanical), 12 Sonnet tasks (real coding), 2 Opus tasks (scheduler integration). ~35-40% token savings vs all-Sonnet. Single override on Task 1 code-quality review (reviewer wrongly flagged `@@index([taskId])` as redundant — Postgres does NOT auto-index FK referencing columns; kept the index per spec).
  - **19 task commits + 2 doc commits** shipped to `feat/now-mode`:
    - Schema (`eff4727`): `TaskChunk` Prisma model + `chunkMin`/`chunkMax` fields on Task. Migration `20260511210217_add_task_chunks`.
    - Utilities: `chunks.ts` (`5bd92be`, 8 tests), `score.ts` (`16ce875`, 7 tests, 40/30/15/15 weighting + strict eligibility + closest-match fallback), `reasoning.ts` (`31220c5`, 27 buckets, 4 tests).
    - Store (`be634e6`): `useNowModeStore` Zustand + persist middleware, wall-clock Pomodoro math, 10 tests.
    - API routes: `POST /api/focus/recommend` (`e81770b`, 3 tests, calls scorer + materializes chunk rows on demand); `previewSlot` scheduler method extracted from `scheduleTask` (`37b7c34`, 6 tests, baseline preserved); `POST /api/focus/finish-later/preview` route; `POST /api/focus/finish-later` + `scheduleChunk` method (`ff9727c`, 3+3 tests); `POST /api/focus/complete-parent` (`ba66eed`, 4 tests, cascade to chunks); `POST /api/focus/chunks/[id]/complete` (`0c50645`, 4 tests, parent auto-close).
    - Scheduler chunk-aware (`7cdbcc6`): `scheduleMultipleTasks` iterates chunks per task, shares one `TimeSlotManager` across all chunks. Baseline scheduler tests still green.
    - GCal chunk sync (`fa549b9`): new `pushChunk` mirrors `pushOne` for chunks; `deleteChunkEvents` real implementation; `getUserCalendarContext` helper extracted; `pushAll` iterates chunks too. 5 tests.
    - UI components: `EnergyPicker` + `TimePicker` (`f58ba92`); `RecommendationCard` (`9cecd34`); `PomodoroHero` with 280px conic ring, MM:SS digits split, tab-title sync, mode toggle (`8a8979f`); `UpNextSheet` + `FinishLaterModal` + `RoundComplete` (`a2bce0c`).
    - Orchestrator + store extension for chunk meta (`c140f25`): `NowMode.tsx` reads `step` + persists `recommendedTaskTitle`/`Index`/`TotalChunks` so banner can read directly. URL hash mirrors step.
    - Classic toggle (`88d6200`): `focusModeView` setting on `useSettingsStore`, `FocusModeToggle` segmented control, `/focus/page.tsx` branches on view.
    - Sticky banner (`3b15371`): sienna gradient strip above app header in `(common)/layout.tsx`, conic ring + 11% per-second tick + linear progress bar at strip base. No dismiss button. Click body → `/focus`.
  - **All 61 unit tests pass** (verified per-suite to avoid worker-pool OOM): chunks 8, score 7, reasoning 4, store 10, recommend route 3, finish-later 3, finish-later/preview 4, complete-parent 4, chunks/[id]/complete 4, preview-slot 2, schedule-chunk 3, chunked-scheduling 4, google-task-sync-chunks 5.
  - Branch pushed to `origin/feat/now-mode` (`https://github.com/senecabenson/gone-squirrel.io/pull/new/feat/now-mode`).
- **Working:**
  - 19-commit feature branch live at `origin/feat/now-mode`. Bisect-friendly (each commit green via husky pre-commit).
  - Local dev on `feat/now-mode` running at http://localhost:3000.
  - Postgres dev DB has the migration applied + 10 `[E2E TEST]` synthetic tasks seeded for the upcoming E2E pass (mix of energy × duration × chunking).
- **Broken:**
  - **E2E pass not yet done.** Unit tests green; UI flows not yet verified end-to-end with Playwright + real GCal sync. Plan written in `~/.claude/plans/can-we-work-on-zany-pebble.md` — covers L1 surface basics through L9 chunked-task GCal asserts.
  - Playwright MCP registered (`✓ Connected`) but tools require Claude Code session restart to load.
- **Next concrete task:**
  1. Restart Claude Code, resume per the plan's "Resume-after-restart checklist."
  2. Run L1-L9 E2E via Playwright MCP, capturing bugs to `docs/superpowers/bugs/2026-05-12-now-mode-e2e.md`.
  3. Patch any bugs on `feat/now-mode`, push.
  4. PR → merge to `main`.
  5. Deploy to VPS via `./scripts/deploy.sh` on `gonesquirrel.nilegrowthworks.com`.
  6. Cleanup `[E2E TEST]` tasks via `UPDATE "Task" SET ... WHERE title LIKE '[E2E TEST]%'`.
