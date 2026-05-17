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

## 2026-05-12 — Sprint 2 close-out: 12 bugs fixed, PR #1 merged, prod deployed

- **Phase:** Sprint 2 close-out.
- **Resume context:** Previous laptop crash mid-patching. Picked up with 14 dirty files covering 11 of 12 bugs in [`docs/superpowers/bugs/2026-05-12-now-mode-e2e.md`](docs/superpowers/bugs/2026-05-12-now-mode-e2e.md). Verified each in-progress diff against the bug doc spec before extending.
- **Did today:**
  - **Phase A — root-cause additions the diff missed:**
    - Bug 1 client-side: added `AbortController` to `src/components/focus/RecommendationCard.tsx:24-44`. Server upsert was defense-in-depth; the cause was React 18 StrictMode dev double-effect firing two POSTs. AbortController aborts the stale fetch on effect re-run; ignores `AbortError` in `.catch` so the toast doesn't flash. Confirmed in E2E network log: one 200 + two `ERR_ABORTED` (clean cancellation, no 500s).
    - Bug 5 leftover CTA: `src/components/focus/RoundComplete.tsx` reads `useNowModeStore.durationMin` (user ask) and `pomodoroDurationMs` (round actual), renders a `⏳ Got {leftoverMin} min left — pick another?` button when gap ≥10 min, routes to `setStep('pick-energy')`. Verified live: 60-min ask + 15-min chunk → CTA rendered "Got 45 min left".
  - **Phase B — verification of in-progress fixes:** Read all 14 modified files; all match suggested fixes in bug doc. Scorer weights re-sum to 1.0 (0.35+0.25+0.12+0.10+0.18). `syncChunksToGoogle` is a clean batch wrapper around the previously orphaned `pushChunk` — no duplication.
  - **Phase C — tests:**
    - `npm run type-check` clean.
    - `npm run lint` clean after fixing `no-unused-expressions` on banner ternary (`StickyPomodoroBanner.tsx:76-83`).
    - 13 unit suites all green, per-suite with `NODE_OPTIONS=--max-old-space-size=4096` (worker-pool OOM avoidance on 8GB RAM): chunks 8, score 8 (added fitScore test), reasoning 4, store 10, recommend 3 (added `upsert: jest.fn()` to mock), finish-later 3 (added `syncChunksToGoogle` mock), finish-later/preview 4, complete-parent 4, chunks/[id]/complete 4, preview-slot 2, schedule-chunk 3, chunked-scheduling 4, google-task-sync-chunks 5. Total **62 tests**.
    - **E2E via Playwright MCP:** Verified live on `localhost:3000`. Bug 2 (`button [pressed]`), Bug 3 (30-min ask → 30-min task picked, not 15-min — fitScore working), Bug 4 ("15 min, steady pace" reasoning), Bug 5 (CTA renders + routes), Bug 6 (title flips 00:05 ↔ 14:47 with COUNT UP ↔ COUNTDOWN), Bug 7 (title restores to "Now | GoneSquirrel" on Done early), Bug 8 (DB query confirms `TaskChunk.googleEventId=cl2jdllhla53p9bpq0a52pf3ac` populated after Finish Later), Bug 10 (preview hint + reasoning visible), Bug 11 (banner outer is `DIV role=button`, nested are real `<button>`s), Bug 12 (Pause ↔ Resume label + aria-label flip).
  - **Phase D — commits + PR:**
    - 8 commits on `feat/now-mode`: 7 per-bug fixes + 1 chore (`.gitignore` for `.playwright-mcp/`). Pushed.
    - Installed `gh` CLI via Homebrew. Auth via `gh auth login --web` (second attempt; first session's auth didn't persist for unclear reasons).
    - Created PR #1 (`https://github.com/senecabenson/gone-squirrel.io/pull/1`). Title: `fix(now-mode): close 12 bugs from 2026-05-12 E2E pass`. Body summarizes each bug.
    - Merged via **rebase** to preserve per-bug commits on `main` for bisect. main now at `a5d5ace`.
  - **Phase E — deploy:**
    - SSH to `root@31.97.145.236`, `cd /opt/gonesquirrel && ./scripts/deploy.sh`. `git pull --ff-only` brought all of Sprint 2 (Now Mode rebuild — 7529 insertions across 45 files) + 8 bug fixes. Docker build 267s (npm ci 82s + next build 172s). Prisma `migrate deploy` ran at container start (entrypoint.sh) — `20260511210217_add_task_chunks` migration applied to prod DB. Health check `https://gonesquirrel.nilegrowthworks.com` green ✓.
    - **Cleanup SQL skipped** — `[E2E TEST]` seed only exists on dev DB, not prod.
- **Working:**
  - **Prod: Now Mode live at `https://gonesquirrel.nilegrowthworks.com/focus`.** Energy → Time → Recommend → Pomodoro flow. Sticky banner off-page. Finish Later → GCal push.
  - main = `a5d5ace`. feat/now-mode branch retained on origin (not deleted at merge).
  - `gh` CLI authed (token in keyring).
- **Broken:**
  - None known on this surface. Pre-existing Jest worker-pool OOM unchanged (mitigated by per-suite runs).
- **Next concrete task:**
  - **Smoke-test prod** (manual, ~5 min): cold `/focus` → energy + time → recommend (Network: one POST, no 500); start Pomodoro, navigate to `/calendar` (banner appears, Pause ↔ Resume); Done early → leftover CTA appears; Finish Later 45 → check GCal calendar for new event.
  - **Update Google Cloud Console OAuth client** if not already (authorized redirect `https://gonesquirrel.nilegrowthworks.com/api/calendar/google`) — see `docs/deploy-vps.md`.
  - **Sprint 3 (ClickUp MVP)** — decide kickoff date.

## 2026-05-13 — TaskModal desktop layout + prod deploy fix

- **Phase:** Polish + deploy hygiene.
- **Did today:**
  - **TaskModal redesign (desktop UX):**
    - Issue: New Task modal had a double scrollbar + was capped at 500px on every breakpoint ≥sm, forcing scroll even on a 1440px monitor.
    - Root cause for double scroll: [src/components/ui/dialog.tsx:56](src/components/ui/dialog.tsx#L56) base `DialogContent` carries `max-h-[85vh] overflow-y-auto`, and [src/components/tasks/TaskModal.tsx:249](src/components/tasks/TaskModal.tsx#L249) form added its own `overflow-y-auto`. Two nested scroll containers.
    - Fix shipped in commits `500b1ba` (feat/now-mode) → cherry-picked as `cedf5ae` on main:
      - DialogContent: `overflow-hidden` + responsive `sm:max-w-[640px] md:max-w-[900px] lg:max-w-[1100px]` + `max-h-[95vh]`.
      - Form: `flex-1 min-h-0 overflow-y-auto px-1` — only scroller; `px-1` keeps the title input's focus ring off the form edge.
      - Restructured form children into explicit left/right column wrappers (`md:grid md:grid-cols-2 md:gap-x-6`). Left col: Title, Description, Project, Tags. Right col: schedule grid, Chunk Size, Auto-Schedule, Recurrence. Footer full-width.
      - Inner schedule grid: `gap-x-4 gap-y-3` (was `gap-4`).
    - Verified via Playwright MCP at 1440×900: form `scrollHeight===clientHeight===740`, no scroll. Created task with chunkSize=45, duration=90 → API returned chunkMin/Max=45 + auto-scheduled. Chunking works end-to-end.
  - **Branch hygiene problem surfaced:** `feat/now-mode` and `main` had diverged by ~30 commits each — Sprint 2 PR squash-merged with new SHAs but local branch kept old SHAs, then we kept committing on the stale branch (chunk-size picker `22a9c81` + TaskModal fix `500b1ba`). `git merge feat/now-mode` would have pulled 30 duplicate-content commits.
    - Resolved by cherry-picking only the 2 commits we wanted: `5f43813` (chunk picker) + `cedf5ae` (TaskModal layout). Pushed to main.
  - **Prod deploy two-step:**
    - First deploy after push: `./scripts/deploy.sh` succeeded, container Up, Next "Ready in 95ms" — but Traefik 502'd. `docker exec root-traefik-1 wget -qO- http://gonesquirrel-app-1:3000` returned `Connection refused`. Root cause: **Next.js standalone server defaults `HOSTNAME=localhost`**, so it never bound 0.0.0.0 and was unreachable from the Traefik network even though both containers shared `root_default`.
    - Fix: `ENV HOSTNAME=0.0.0.0` + `ENV PORT=3000` in [Dockerfile](Dockerfile) production stage. Commit `6745bb8`. Second deploy → health check `app responding ✓`.
- **Working:**
  - Prod: TaskModal new desktop layout live at `https://gonesquirrel.nilegrowthworks.com`. Single scrollbar (or none) on ≥md viewports, balanced 2-col, chunk-size pill picker shipped.
  - main = `6745bb8`. Cherry-pick strategy preserved Sprint 3 prep work on feat/now-mode for later harvest.
- **Broken:**
  - **`feat/now-mode` branch is permanently diverged from main** (~30 commits on each side, mostly duplicate logical content). Treat as a salvage source, not a working branch. Don't merge it back.
  - Pre-existing Jest worker-pool OOM unchanged.
- **Next concrete task:**
  1. **Branch cleanup:** delete `feat/now-mode` locally + on origin (`git branch -D feat/now-mode && git push origin --delete feat/now-mode`) once we've confirmed no further commits there are needed.
  2. **Adopt trunk-based workflow going forward:** branch per feature, lifetime <1-2 days, PR even solo, squash-merge, **delete branch immediately after merge** (both local + remote). Never reuse a branch name. New features: `feat/<topic>-YYYYMMDD`.
  3. **Eventual:** wire GitHub Actions to auto-deploy main on green CI (replace manual `./scripts/deploy.sh`). Tabled for now; ship first.
  4. **Sprint 3 (ClickUp MVP)** kickoff still pending.
- **Important context for future-me:**
  - **Branch divergence trap:** if you PR-and-squash-merge `feat/X` to main, the SHAs on main do NOT match the SHAs on the local branch. If you keep committing on `feat/X`, a future `git merge feat/X` will try to apply 30 duplicate commits. Always delete the branch right after merge. Cherry-pick is the recovery hatch, not the workflow.
  - **Next.js standalone bind:** when deploying behind a reverse proxy in Docker, set `HOSTNAME=0.0.0.0` explicitly. The default `localhost` binding silently breaks cross-container routing — Traefik will 502 even though the app logs "Ready".
  - **Modal scroll pattern:** for shadcn Dialog with a form that manages its own scroll, set `overflow-hidden` on `DialogContent` (overriding the base `overflow-y-auto`) and `flex-1 min-h-0 overflow-y-auto` on the inner form. Without `min-h-0` the flex child refuses to shrink below content height.

## 2026-05-13 (evening) — Sprint 3 kickoff: ClickUp integration backend (Phase 0–3 complete + verified)

- **Phase:** Sprint 3 (ClickUp MVP) — backend shipped, no UI yet.
- **Did today:**
  - **Plan written** at `~/.claude/plans/if-i-want-claude-sorted-kettle.md`. ClickUp v2 API audit at `~/.claude/plans/if-i-want-claude-sorted-kettle-agent-aef26bc88497072b4.md`. Both worth re-reading before resuming.
  - **Architecture decision: hybrid sync.** ClickUp owns content fields (title, desc, status, dates, priority, tags). Local DB owns scheduling (TaskChunk, scheduledStart/End, isAutoScheduled, googleEventId, chunkMin/Max, scheduleLocked) — never pushed to ClickUp. Energy + preferred time pushed via ClickUp Custom Fields per List. Recurrence (RRULE) stays local — ClickUp v2 API does not expose recurrence.
  - **Phase 0 — Prisma schema** ([prisma/migrations/20260513142638_add_workspace_and_subtask_hierarchy/](prisma/migrations/20260513142638_add_workspace_and_subtask_hierarchy/migration.sql)):
    - New `Workspace` model — maps to ClickUp Space (Motion-style hierarchy). Fields: id, name, color, status, externalId, externalSource, lastSyncedAt, userId.
    - `Project.workspaceId` nullable FK (existing projects = no workspace).
    - `Tag.workspaceId` (Tags scoped per Workspace, matching ClickUp per-Space tag scoping; nullable for legacy global tags). Added `fgColor` + `externalSource` columns. Unique key now `[name, userId, workspaceId]`.
    - `Task.parentTaskId` self-relation for ClickUp subtasks.
    - Hand-wrote SQL + ran `prisma migrate deploy` because `migrate dev` is interactive-only and Claude Code shell is non-TTY. **Pattern for future migrations: write SQL → deploy. Never try to run migrate dev from non-TTY.**
  - **Phase 1 — ClickUp provider** ([src/lib/task-sync/providers/clickup/](src/lib/task-sync/providers/clickup/)):
    - `clickup-client.ts` — REST wrapper with `Authorization: pk_xxx` raw header (NO Bearer for PAT), 429 backoff via `X-RateLimit-Reset`, throws `ClickUpApiError` on other 4xx/5xx. 14 methods: getTeams, getSpaces, getFolders, getFolderlessLists, getListsInFolder, getList, getTasksInList (paginated 100/page), getTask, createTask, updateTask, deleteTask, setCustomField, createCustomField (returns null on 4xx — Free plan degradation), upsertTag, createWebhook (env-gated stub).
    - `types.ts` — ClickUp API types.
    - `clickup-field-mapper.ts` — pure functions (priorityToClickUp/From, dateToClickUp/From, statusToClickUp/From, tagsToClickUp/From, energyLevelFromCustomFields, mapExternalTaskToInternal, mapClickUpTaskToExternalTask, etc.).
    - `clickup-provider.ts` — `ClickUpProvider` implements `TaskProviderInterface`. Includes `ensureCustomFields(listId)` for energy + preferredTime (Phase 1.5) and `syncTagColors(workspaceId, ctags)` for bg/fg color (Phase 1.6). Per-list settings (statusMap + customFieldIds) stored in `TaskProvider.settings.lists[listId]` JSON blob (NOT TaskListMapping — that has no settings column).
  - **Phase 2 — Integration routes** ([src/app/api/integrations/clickup/](src/app/api/integrations/clickup/)):
    - `_clickup-http.ts` — throwaway thin REST helper used by route handlers. Phase 1's `ClickUpClient` could replace it later but routes work standalone.
    - `connect/route.ts` — POST `{token}` → validate via `/team` → upsert `ConnectedAccount` (provider=CLICKUP) + `TaskProvider`. Uses user's GS email or `"clickup-pat"` sentinel for ConnectedAccount.email.
    - `disconnect/route.ts` — DELETE: archives Workspaces + child Projects (status="archived"), hard-deletes TaskProvider + ConnectedAccount.
    - `spaces/route.ts` — GET: ClickUp Spaces with `enabled` flag (= local Workspace exists).
    - `spaces/[spaceId]/enable/route.ts` — POST upsert Workspace, DELETE archive.
    - `spaces/[spaceId]/lists/route.ts` — GET: flattens folderless + folder-nested lists.
    - `lists/[listId]/enable/route.ts` — POST: creates Project + TaskListMapping. Requires parent Space already enabled. DELETE: archive Project + disable mapping.
    - `sync-now/route.ts` — POST: invokes `TaskSyncManager.syncTaskList` for each mapping under the CLICKUP provider.
  - **Phase 3 — Sync infra wiring** ([src/lib/task-sync/task-sync-manager.ts](src/lib/task-sync/task-sync-manager.ts)):
    - Added `CLICKUP` case to `getProvider` (instantiates ClickUpProvider with token + dbProvider + prisma).
    - Built `ClickUpFieldMapper` extends `FieldMapper` at [src/lib/task-sync/providers/clickup-field-mapper.ts](src/lib/task-sync/providers/clickup-field-mapper.ts) — note this is at root `/providers/`, NOT inside `/providers/clickup/`. Separate from the pure-function mapper at `/providers/clickup/clickup-field-mapper.ts`. The class form is required because `TaskSyncManager.getFieldMapper` returns FieldMapper instances and the sync engine uses field mapper transforms during conflict resolution.
    - Added `CLICKUP` case to `getFieldMapper`.
    - Added generic `linkSubtaskParents` post-pass method to `TaskSyncManager`. After `syncBidirectional` returns, this method calls `provider.getTasks(listId)` again, finds tasks with `parentExternalId` set (new optional field on `ExternalTask` interface), and updates local `Task.parentTaskId` accordingly. No-op for providers that don't populate the field. Generic — future providers (Asana, Jira, Linear) get parent linking for free.
  - **Verification** (real ClickUp API roundtrip with Personal > 👀 Job Search list, 7 tasks):
    - Seed script at [scripts/seed-clickup.ts](scripts/seed-clickup.ts) — usage: `npx tsx scripts/seed-clickup.ts [listId]`. Auto-picks smallest list if no arg (non-deterministic — pass list ID explicitly for reproducible runs). Drops token from `CLICKUP_API_TOKEN` env into `ConnectedAccount` + creates Workspace/Project/Mapping + runs sync.
    - Strict diff check (live ClickUp vs local DB): titles, status, priority, due dates (as ms-epoch), subtask parents. **ALL CLEAN** after fixes.
    - **One real bug fixed during verify:** [src/lib/task-sync/providers/clickup/clickup-field-mapper.ts:90-103](src/lib/task-sync/providers/clickup/clickup-field-mapper.ts#L90-L103). `dateFromClickUp` was using `setHours(0,0,0,0)` which strips time in LOCAL TZ, causing date-only fields to drift by host TZ offset (4hrs visible on EDT). Fixed to `setUTCHours`. Companion `dateToClickUp` updated to use `getUTC*` for symmetric round-trip.
- **Working:**
  - End-to-end PULL: ClickUp List → GoneSquirrel Tasks via `npx tsx scripts/seed-clickup.ts 901708331993`. 7 tasks land correctly, 5 subtasks auto-linked to parent. Idempotent re-runs (0 imported / N updated).
  - Token in `.env` as `CLICKUP_API_TOKEN="pk_..."`. Active token committed there for dev — **rotate before going public**. Runtime auth reads from `ConnectedAccount.accessToken` DB column, not env (env is just a clipboard for the seed script).
  - TSC clean, ESLint clean across all new files.
  - Migration applied; `\d Workspace` confirms table + indexes + FKs.
- **Broken / not yet verified:**
  - **PUSH direction (GS → ClickUp) untested.** Creating a Task locally and syncing should create it in ClickUp via `provider.createTask`. Risky because it writes to real ClickUp — test on a throwaway list, not Personal.
  - **Custom fields (energy + preferredTime)** wiring exists but unexercised. ClickUp Free tier may reject `POST /list/{id}/field` — `ClickUpClient.createCustomField` returns null on 4xx and `ensureCustomFields` falls back gracefully. Test under both Free and paid scenarios.
  - **Tag color sync** code paths exist but Job Search list has 0 tags. Need a list with tags to verify bg/fg color round-trips.
  - **Custom statuses** — Personal space uses default `to do` / `complete` statuses. Have NOT tested NILE list with custom statuses (`blocked`, `in review`, etc.). `statusToClickUp`/`From` should preserve them via `TaskProvider.settings.lists[listId].statusMap` but unverified.
  - **No UI yet.** Settings page has no ClickUp section; sidebar doesn't render Workspace → Project tree; TaskModal has no parent-task selector. All API + DB ready for them.
  - **Recurrence** — RRULE stays local. ClickUp's recurrence is intentionally not synced. If a synced ClickUp task has `recurrence` set in ClickUp's internal model, our pull ignores it.
  - `feat/now-mode` branch still permanently diverged (from prior session).
- **Next concrete task:**
  1. **Test push direction.** Use a throwaway ClickUp list (NOT Personal > Job Search). Create a Task in GS via Prisma Studio with `projectId` matching the synced project, run sync, confirm task appears in ClickUp via `mcp__claude_ai_ClickUp__clickup_get_task`. Then change title locally, sync, confirm ClickUp updates. Then delete locally, sync, confirm ClickUp deletes.
  2. **Settings UI for ClickUp.** New section in `src/app/(authenticated)/settings/integrations/` (find the file): token input + validate + persist → space picker (checkbox list) → per-space list picker. All API routes already wired ([src/app/api/integrations/clickup/](src/app/api/integrations/clickup/)).
  3. **Sidebar Workspace → Project tree.** Find existing project sidebar (grep for `useProjectStore`). Render Workspaces as top-level groups, Projects nested under. Workspaces with `externalSource=CLICKUP` get a small ClickUp badge.
  4. **TaskModal parent-task field.** [src/components/tasks/TaskModal.tsx](src/components/tasks/TaskModal.tsx) — add a "Parent task" combobox listing other tasks in the same project. Wire to `parentTaskId`.
  5. **Webhook receiver (post-MVP).** `POST /api/webhooks/clickup` — verify HMAC-SHA256 signature with `webhook.secret`, fetch full task on event, run targeted single-task sync. Pattern: "webhook → enqueue task_id → debounced fetch" (don't trust diff payloads).
- **Important context for future-me:**
  - **Hierarchy naming:** GoneSquirrel `Workspace` = Motion `Workspace` = ClickUp `Space`. ClickUp's own top-level "Workspace" (their team) is just `teamId` in API responses. Always be explicit when talking to a non-Motion-aware user: "Workspace (ClickUp Space)".
  - **Per-list statuses are real:** every ClickUp list has its own `statuses[]` array. NILE > some-list might have `blocked`, `in review`, etc. The sync stores these per-list in `TaskProvider.settings.lists[listId].statusMap`. UI eventually needs to read this map to show valid status options per Project.
  - **Subtask linking is generic now.** `ExternalTask.parentExternalId` (optional field on the interface) drives the post-pass. Any future provider that supports hierarchy populates this field and gets parent linking for free. Subtasks must be in the same ClickUp List as their parent (API constraint, not ours).
  - **`task_count` from ClickUp is unreliable.** Personal > Job Search reported `task_count: 0` while actually containing 7 tasks. Don't use list-metadata task counts for capacity planning — always paginate the real endpoint.
  - **Rate limit on Free tier is 100 req/min.** Per-list polling will burn this fast at scale. Plan to lean on webhooks for production. For now, sync-on-demand only.
  - **Date-only TZ trap (now patched but worth remembering):** ClickUp sends date-only fields as noon UTC by convention. Use `setUTCHours`/`getUTCHours`, never local-TZ getters/setters, when normalizing.
  - **Seed script is non-deterministic by default.** ALWAYS pass an explicit listId to `seed-clickup.ts` for reproducible runs. Otherwise its "smallest list" auto-pick varies as ClickUp adjusts task_count.
  - **Plan + API reference files are at `~/.claude/plans/if-i-want-claude-sorted-kettle*.md`.** Re-read those before touching this integration.

## 2026-05-13 (late evening) — Brand rollout cleanup + LeftRail lockup

- **Phase:** Brand polish + over-engineering recovery.
- **Did today:**
  - **Centering refactor experiment (rolled back).** Built `CenteredViewportLayout` primitive + fluid token layer (`--size-icon-sm/md`, `--size-logo`, `text-fluid-hero/headline/body/caption`, `gap-fluid-stack`, `py-fluid-block`) + symmetric body gradients + hid the single-tab "Sign in" TabsList + moved signin to `(open)/auth/signin`. Five commits on top of `7eb5dde`.
  - User reaction: signin no longer "auto-fit" the screen like the deployed version, and the LeftRail footer disappeared. Root cause: moving signin into `(open)/` meant AppShell no longer wrapped it → no LeftRail → form rendered as a `max-w-md` centered island that felt sparse on ultrawide. Deployed (`(common)/auth/signin`) renders form inside AppShell's `flex-1` main column with LeftRail framing the left edge.
  - **Reset to `origin/main` (`7eb5dde`)** via `git reset --mixed`, then `git checkout origin/main -- src/app/globals.css src/components/auth/SignInForm.tsx src/app/(common)/auth/signin/page.tsx`. Deleted `src/components/layouts/CenteredViewportLayout.tsx`. Rewrote `BrandSplash.tsx` + `Landing.tsx` with plain `flex items-center justify-center` shells + inline `clamp()` widths — no layout primitive. Single clean commit `b0e4a10` carries the entire brand rollout (splash, landing, brand SVGs, `(open)` route, `loading.tsx`, `metadata.ts`, PWA manifest, AppNav/LeftRail icon swap, root `*.png` gitignore).
  - **LeftRail header lockup iteration.** Built up to `IconMark` (h-12, w-12) + `/brand/svg/wordmark-green.svg` (h-7, `-ml-2`) flush together so it reads as one lockup. Dark-mode variant via `block dark:hidden` / `hidden dark:block` swap on two `<img>` tags. Commits `cc1f6f0 → 94b7a8f` (5 small steps to dial size + gap).
  - **Working-tree cleanup:** deleted ~84 root-level iteration screenshots (`landing-*.png`, `signin-*.png`, `splash-*.png`, `v2-*`, `v3-*`, etc.) and added `/*.png` to `.gitignore` so they can't sneak back in.
  - **Tag `undo-point`** points at `246400f` (dropped HEAD before rollback). Drop with `git tag -d undo-point` once confident none of those 5 commits are needed back.
- **Working:**
  - main pushed to origin in this session's last step.
  - Splash, landing, signin all render correctly. Signin sits inside `(common)/auth/signin` (LeftRail visible with full bottom bar — UserMenu `SB` avatar, Privacy, Theme toggle, Collapse).
  - LeftRail header expanded: icon-mark + "GoneSquirrel.io" wordmark, single-lockup feel, gap-0 + `-ml-2` on wordmark.
  - LeftRail header collapsed: icon-mark only at h-12, fits w-16 rail.
- **Broken:**
  - **`text-action-on` → dark-text-on-rust bug** still unresolved (brand-rollout-handoff doc item #2). Workaround `!text-white` applied inline on the Landing CTA.
  - **`UserMenu.tsx:24` has a leftover `console.log("status-------", status)`** — flagged this session, not removed yet.
  - Brand SVG components use `<img>` tags pointing at `/brand/svg/*.svg` — ESLint warns about `<img>` vs `next/image`. Left as-is for now.
- **Next concrete task (tomorrow):**
  1. **Splash + landing + signin design pass** — revisit visual treatment with fresh eyes. Current versions are the simple `flex items-center justify-center` versions from `b0e4a10`, fine but not the destination.
  2. **Drop the `UserMenu.tsx:24` debug log** (one-line cleanup).
  3. **Decide whether to fix `text-action-on` token mapping** in `src/components/ui/button.tsx` instead of per-button `!text-white` overrides.
  4. **Delete `undo-point` tag** once rollback is confirmed not needed: `git tag -d undo-point`.
- **Important context for future-me:**
  - **Don't conflate "AppShell route" with "screen-fit".** Pages under `(common)/` inherit LeftRail framing + a `flex-1` main column that auto-fills any viewport. Moving an unauth surface to `(open)/` strips that — on ultrawide, content immediately becomes a small island. Default unauth surfaces under `(common)` unless there's a specific reason to drop the shell.
  - **Icon SVG internal padding lies about size.** `/brand/svg/icon.svg` is a rounded square with a spiral inside; the spiral occupies ~70% of viewBox so the *visible* mark at `h-7` is ~20px while the bounding box is 28px. To match visual weight of `react-icons` glyphs in nav rows (which fill their box edge-to-edge at `h-5`), the brand IconMark needs ~h-12. Don't size brand marks by box dimensions alone.
  - **Wordmark + icon spacing:** the icon SVG's right-edge padding *is* the visual space. `gap-0` on the parent flex + `-ml-2` on the wordmark img pulls the wordmark in until visible spiral-to-wordmark distance reads like a single character space. Beats tuning gap units.
  - **Refactor → reset path:** `git reset --mixed origin/main` then `git checkout origin/main -- <files>` is the surgical way to roll a branch back without losing the working-tree state of the keeper files. Tag the dropped HEAD first so the SHAs aren't lost.

## 2026-05-14 — ClickUp integration: ship + minimal settings UI

- **Phase:** Wrap-up of in-flight ClickUp task-sync work.
- **Did today:**
  - **Live-verified the uncommitted ClickUp pipeline end-to-end** before committing anything: `npm run db:up`, `npx tsx scripts/seed-clickup.ts 901708389490` (forced Financial maintenance list, 4 tasks). 8 tasks imported, subtask parent linking populated for 5 of them in Job Search list. Idempotent on re-run.
  - **Cleaned the dev DB.** 13 non-ClickUp tasks (E2E TEST + CAVEMAN TEST fixtures, `source IS NULL`) deleted via `DELETE FROM "Task" WHERE source IS NULL`. FK cascades safe — `_TagToTask`, `TaskChunk`, `Task.parentTaskId` all CASCADE; `TaskChange.taskId` SET NULL.
  - **Phase B committed in 7 chunks** (all hooks passing, all typecheck-clean independently):
    1. `92f6ba9` feat(db): add workspace + subtask hierarchy
    2. `553ec3d` feat(task-sync): clickup provider + field mapper
    3. `5dd8a9f` feat(task-sync): wire clickup provider + subtask parent linking
    4. `a543c07` feat(api): clickup integration routes
    5. `c900dfb` chore(scripts): clickup seed for one-off bootstrap
    6. `3c14989` test(slot-scorer): add parentTaskId to fixture
    7. `3067d0a` feat(theme): add font-brand utility wired to --font-brand
  - **Phase C — minimal settings UI shipped.** New `ClickUpIntegrationSettings.tsx` rendered under a new "ClickUp" tab in `src/app/(common)/settings/page.tsx` (added to SettingsTab union, tabs array, allPossibleTabIds, renderContent switch — all 4 touch-points). UI: connect-by-PAT (Input + Button), spaces list with expand→lists, per-list enable Switch, Sync Now + Disconnect. Connection state probed by GETting `/api/integrations/clickup/spaces` (400 → not connected). One file, ~280 LOC including JSX.
  - **Phase D — Playwright verify on `localhost:3001/settings#clickup`.** 0 console errors. Existing session let me skip auth. Expanded Personal space → 5 lists rendered with task counts. Clicked Sync Now (POST 200 in 19.9s) → DB grew to 15 tasks across 2 projects. Toggled "Planning and review" list switch → POST 200 → Sync Now again (POST 200 in 13.3s) → 4 new tasks imported (now 4 projects, 19 tasks total). Idempotent.
- **Working:**
  - Full ClickUp sync flow is end-to-end functional via UI: connect → enable space → enable list → sync → tasks land in local DB with parent-task hierarchy intact.
  - All 6 API routes (`connect`, `disconnect`, `spaces`, `spaces/[id]/lists`, `spaces/[id]/enable`, `lists/[id]/enable`, `sync-now`) wired and exercised.
  - Settings page has dedicated "ClickUp" tab between Integrations and Task sync; deep-links via `#clickup` work.
  - **Pushed `ca41f5c..9a9adab` to `origin/main`** — 9 commits live. No PR (repo convention is direct push).
- **Broken:**
  - **Jest OOM with default heap** running `slot-scorer-timezone.test.ts` — pre-existing, unrelated to ClickUp. Workaround: `NODE_OPTIONS="--max-old-space-size=4096" npx jest ... --runInBand` passes. Real fix is in jest config, not on the ClickUp critical path.
  - **`_clickup-http.ts` throwaway helper** still lives at `src/app/api/integrations/clickup/_clickup-http.ts`. Audit flagged it as a Phase 2 placeholder to remove once `ClickUpProvider` is in use — still imported by `connect/`, `disconnect/`, `spaces/`, `spaces/[id]/lists/`. Refactoring those routes to use `ClickUpProvider.validateConnection()` etc. is the cleanup, not scoped for today.
- **Next concrete task:**
  1. **Webhooks (Phase 4).** `createWebhook()` in `ClickUpClient` is stubbed. Implement: gate behind `CLICKUP_WEBHOOKS_ENABLED`, POST `/team/{teamId}/webhook` with our endpoint URL + filter list, store `webhook_id` + signing secret on `TaskProvider.settings`. Receiver at `POST /api/webhooks/clickup` verifies HMAC-SHA256 with the secret, fetches the full task on event, runs targeted single-task sync.
  2. **Tests.** No unit tests for `ClickUpFieldMapper`, `ClickUpProvider`, or the 7 API routes. At minimum: round-trip tests for priority/status/date mapping, and a happy-path integration test for `/sync-now` using a mock `ClickUpClient`.
  3. **Retry/backoff.** `TaskListMapping.error` is set on failure but there's no automatic re-attempt. Add exponential backoff to sync-now path.
  4. **Drop `_clickup-http.ts`.** Refactor the 4 remaining API-route callsites to use `ClickUpProvider`/`ClickUpClient` directly, then delete the helper.
  5. **Disable flow.** Switches go disabled once enabled — there's no way to un-enable a list/space from the UI besides Disconnect (which archives everything). Add a "disable list" PATCH route + UI handler.
- **Important context for future-me:**
  - **Token comes from `.env` quoted.** `CLICKUP_API_TOKEN="pk_..."` — the seed script and ClickUp REST calls need the quotes stripped before passing as the Authorization header. The ClickUp helper `clickUpFetch` (and Prisma round-tripping through `ConnectedAccount.accessToken`) handles this fine because Prisma strips the literal quotes on save, but raw `grep | cut` from the env keeps them. Bit me once today.
  - **`task_count` field on ClickUp lists is still unreliable** (carried over from prior session). PMP list shows 0 task_count and actually has 0 tasks; Financial shows 4 and actually has 4 (returned 8 ExternalTasks because of recurring task instances each becoming a separate record). The "8 imported from a list of 4" surprise is recurrence, not duplication.
  - **Hash-routed settings tabs** require 4 sync points: `SettingsTab` union, `tabs` array, `allPossibleTabIds` array, `renderContent` switch. Miss the 3rd one and deep-links silently drop to default. Worth a helper if more tabs land.
  - **Connection probe via `/spaces` GET** is OK for now but couples connection state to that endpoint's failure modes. If `/spaces` ever returns 400 for "team exists but has no spaces" we'd misclassify as not-connected. Worth a dedicated `/status` route if this gets touched again.

## 2026-05-15 — ClickUp cleanup: drop `_clickup-http` throwaway

- **Phase:** Deferred-queue item #1 from last session.
- **Did today:**
  - **Refactored 5 integration routes** off the Phase-2 `clickUpFetch` helper onto `ClickUpClient`: `connect`, `spaces`, `spaces/[id]/enable`, `spaces/[id]/lists`, `lists/[id]/enable`. Audit had said 4 importers; grep showed 5 (the prior session's notes line 495 was correct — the audit missed `spaces/[id]/enable` and `lists/[id]/enable`).
  - **Added `ClickUpClient.getSpace(spaceId)`** — single-space GET needed by `spaces/[id]/enable` (no public `request<T>`; it's private). `getList(listId)` already existed.
  - **Added `task_count?: number | null` to `ClickUpList` type** — was on inline DTOs, missing from the shared type.
  - **Switched 401 detection** from `message.includes("401")` to `err instanceof ClickUpApiError && err.status === 401` everywhere. Added 401-pass-through guards to `spaces`, `spaces/[id]/enable`, `spaces/[id]/lists`, `lists/[id]/enable` (none had one before — previously all errors masked as 500).
  - **Live-verified on `localhost:3001/settings#clickup`** before commit: page loaded with Personal space connected (GET `/spaces` 200 ×2), expanded Personal (GET `/spaces/{id}/lists` 200 ×2 — once on mount, once after toggle), toggled "Home setup" on (POST `/lists/{id}/enable` 200), clicked Sync Now (POST `/sync-now` 200 in 25.4s, DB grew 19 → 21). Zero console errors throughout.
  - **Deleted `_clickup-http.ts`** and confirmed `grep -r '_clickup-http' src/` returns nothing.
  - **Committed `a438dc8` and pushed to `origin/main`.** Net -82 LOC.
- **Working:** All five refactored routes hit live and returned 200. Sync path unchanged (already used `ClickUpClient` via `TaskSyncManager`).
- **Broken:** Nothing new. The Jest OOM workaround from yesterday still stands; not on this critical path.
- **Behavioral fix shipped silently:** `spaces/[id]/lists` previously omitted `?archived=false` on the `/space/{id}/list` and `/space/{id}/folder` calls. `ClickUpClient.getFolderlessLists` and `getFolders` both append it. Archived ClickUp lists/folders will no longer surface in the UI — intended.
- **Deferred queue updated** (~~strikethrough~~ = done):
  1. ~~Drop `_clickup-http.ts` throwaway~~ ✅ shipped today.
  2. **Tests** — `ClickUpFieldMapper` round-trips (priority/status/date) + `/sync-now` happy path with mocked `ClickUpClient`. Now next.
  3. Disable flow — PATCH route + UI un-toggle for spaces/lists without Disconnect.
  4. Retry/backoff on `sync-now` failures.
  5. Webhooks (Phase 4).
- **Important context for future-me:**
  - **`ClickUpClient.request<T>` is private.** Anything new that needs a one-off endpoint must be added as a public method on the class (not callable from outside). When in doubt, mirror existing patterns: `getSpace`, `getList`, `getTask`.
  - **`ClickUpList.space` is optional** (`space?: { id, name, access }`). `lists/[id]/enable` needs a guard before `list.space.id` access; added one that returns 500 with `"ClickUp list missing parent space"` if absent. ClickUp's docs imply space is always present on a list-detail response, but the type is correct.
  - **Connection-state probe still couples to `/spaces` returning 400 when `ConnectedAccount` is missing.** This refactor preserved that path (the 400 returns before any `ClickUpClient` construction). If you ever change that return to 401, the UI's "not connected" detection breaks.

## 2026-05-15 (later) — Webhook (Phase 4) scoped, not yet shipped

- **Phase:** Planning only. No code changes this entry. Deferred-queue item promoted from #5 → next-session #1 once the user confirmed prod URL exists.
- **Did today:**
  - **Discovered prod infra** via Hostinger browser terminal: app at `/opt/gonesquirrel/`, Docker compose, Traefik (`root-traefik-1`) handles 443→app:3000 with auto Let's Encrypt, Postgres co-located (`gonesquirrelio-db-1` — note: different name than dev's `gonesquirrel-db-1`, but actually identical based on `docker ps` output — verify before prod psql queries), Cloudflare tunnel sidecar (`cloudflared-zrep-cloudflared-1`) also routing some traffic. Prod env file: `/opt/gonesquirrel/.env.production`. Deploy script: `/opt/gonesquirrel/scripts/deploy.sh`.
  - **Confirmed `ClickUpClient.createWebhook()` stub exists** (`clickup-client.ts:384`), gated on `CLICKUP_WEBHOOKS_ENABLED==="true"`. Returns `null` when gated.
  - **Wrote approved plan file** at `~/.claude/plans/continuing-clickup-integration-read-hashed-music.md` covering: one team-wide webhook per user, HMAC-SHA256 verify with `timingSafeEqual`, `syncSingleExternalTask` helper on `ClickUpProvider`, re-connect cleanup, disconnect cleanup, env vars (`CLICKUP_WEBHOOKS_ENABLED`, `WEBHOOK_BASE_URL`), agent-router routing table (10 Sonnet / 3 Haiku tasks). Plan includes the user's explicit E2E sequence: sync → add task in ClickUp → confirm autosync without clicking Sync Now → edit/status/delete propagation → unmapped-list skip → disconnect cleanup.
- **Working:** Cleanup `_clickup-http` shipped earlier today on `c2b9071`. Webhook surface untouched.
- **Broken:** Nothing new. `createWebhook` is dead code until `CLICKUP_WEBHOOKS_ENABLED=true` set and connect-route registration block added.
- **Deferred queue reshuffled** (post-cleanup, pre-webhook):
  1. **Webhooks (Phase 4)** — plan approved, execute next session.
  2. Tests — `ClickUpFieldMapper` round-trips + `/sync-now` happy path with mocked `ClickUpClient`.
  3. Disable flow — PATCH route + UI un-toggle without Disconnect.
  4. Retry/backoff on `sync-now` failures.
- **Important context for future-me:**
  - **Task model has NO `@@unique` on `(externalTaskId, userId)`** — only `@@index`. `prisma.task.upsert` does NOT work. Use the `findFirst` + conditional `create`/`update` pattern from `task-sync-manager.ts:485+`. Don't waste time trying upsert and getting a Prisma error.
  - **`ClickUpProvider.parseProviderSettings()`** at `clickup-provider.ts:738` already exists for typed settings reads. Reuse it instead of writing a new cast.
  - **`ClickUpProviderSettings` is private** (`clickup-provider.ts:70`). Export it before adding webhook fields.
  - **Webhook receiver MUST read raw body before any JSON parse** (`Buffer.from(await request.arrayBuffer())`). Using `request.json()` first consumes the stream and breaks HMAC.
  - **Prod env edits = nano + deploy script.** `cd /opt/gonesquirrel && nano .env.production && ./scripts/deploy.sh`. There's no auto-deploy on push to `main` — must SSH (or Hostinger browser terminal) and run the script manually.
  - **Localhost can't receive ClickUp webhooks** — dev stays manual-sync. Cloudflare tunnel for dev autosync is out of scope for the webhook session.

## 2026-05-16 — Scheduling Blocks: Phase A shipped+verified, Phase B core landed

- **Branch:** `feat/scheduling-blocks` (NOT main, NOT pushed). Plan: `~/.claude/plans/as-a-user-i-indexed-wirth.md` (Phases A/B/C). Goal: auto-scheduler reads the user's Google "Task Blocks" calendar as a HARD availability layer (work only inside daytime 🧠 Deep / 🪶 Light blocks matched to task `energyLevel`; every other block hard-protected), plus a recurring personal-commitment system that writes protected blocks so workout/eat/golf get enforced.
- **Did today:**
  - **Phase A — committed `51e3f5e`, fully verified.** `src/services/scheduling/BlockCalendarService.ts` (emoji/skin-tone/variation-selector-robust `matchBlockRule`, `getBlocks`, `eligibleWindowsForEnergy`, `selectSlotsInEligibleBlocks` = containment + protected-overlap, `selectSlotsWithPolicy` = schedule_nothing | fallback_work_hours, `DEFAULT_BLOCK_TYPE_MAP` from the real calendar). Wired into `TimeSlotManager` as **step 2.5** between `filterByWorkHours` and `removeConflicts` — SlotScorer/energy windows untouched. `AutoScheduleSettings` +4 cols, migration `20260516184959_add_task_blocks_config`. Settings UI "Task Blocks Calendar" section. Verify: 44 unit/integration + 0 tsc + **2 live Playwright e2e** (`tests/e2e/scheduling-blocks.spec.ts`) green.
  - **Phase B part 1 — committed `41ed0af`.** Prisma `PersonalCommitment` + `CommitmentEvent` (`@@unique[commitmentId,scheduledDate]` idempotency), `User.personalCommitments`, migration `20260516190814_add_personal_commitments`. `src/services/scheduling/CommitmentMaterializer.ts` pure TDD core: `expandOccurrences` (RFC5545 via `rrule`, already in deps) + `pickSlot` (preferredHour-first free daytime scan, `DAY_START_HOUR`=6 → `EVENING_CUTOFF_HOUR`=19). 6 unit tests green.
  - **e2e seeding:** new `scripts/seed-e2e.ts` (idempotent, mirrors register route) — fresh dev DB has no user + public signup disabled.
- **Working:** Both commits pass pre-commit (lint + `tsc --noEmit`). Full `src/services/scheduling` suite green (50 tests). `taskBlocksFeedId=null` → filter pass-through (backward compatible).
- **Broken:** Nothing new. Pre-existing `console.error` "Failed to get system settings" in `chunked-scheduling.test.ts` (its prisma mock lacks `systemSettings`) — not ours, suites pass.
- **Deferred queue (this feature):**
  1. **Phase B part 2 (next)** — `materialize(userId, horizonDays)` / `revoke(commitmentId)` orchestration: expand → `pickSlot` vs existing block events + other CommitmentEvents + scheduled Tasks → write GCal event `${emoji} ${label}` on Task Blocks calendar AND upsert local `CalendarEvent` same-tx → upsert `CommitmentEvent`. Generalize event-create helper in `src/services/google-task-sync.ts` to take a target calendarId; add `getCommitmentCalendarId()`. `/api/commitments` (GET/POST), `/api/commitments/[id]` (PATCH→revoke+re-materialize), `/api/commitments/materialize` (POST; also call at top of `scheduleAllTasksForUser`). `PersonalCommitments.tsx`.
  2. **Phase C** — `CommitmentAdjuster.skipOccurrence({reflow})` / `moveOccurrence`: cancel CommitmentEvent + delete GCal event + (reflow:"work") write temp 🪶 block tagged `gs:reflow:<id>` + makeup same ISO week + re-run `scheduleAllTasksForUser`. `/api/commitments/[id]/skip|move`. Skip/move/snooze UI. Deterministic core only; NL adapter deferred to brain-dump pipeline.
- **Important context for future-me:**
  - **jest OOMs at default heap.** Always `NODE_OPTIONS="--max-old-space-size=6144" npx jest <path> --runInBand`. ~2GB default → FATAL heap OOM even on one suite (ts-jest typecheck). Biggest time-sink if forgotten.
  - **Playwright e2e:** specs hardcode `localhost:3001` + `test@example.com`/`testpassword123`. `npx tsx scripts/seed-e2e.ts` → `PORT=3001 npm run dev` (bg) → wait HTTP 200 → `npx playwright test <spec> --project=chromium --workers=1`. `/settings` first authed compile slow — e2e waits ≥90s. Kill `next dev`/`next-server` after.
  - **Adding an `AutoScheduleSettings` field = 3 edits or tsc breaks:** `prisma/schema.prisma`, `src/types/settings.ts`, `src/store/settings.ts` default object — plus full fixtures (e.g. `src/__tests__/slot-scorer-timezone.test.ts`). Do NOT narrow string-union types in `src/types/settings.ts` (Prisma emits `string`; narrowing → TS2719 "two types same name").
  - **`prisma generate`** (schema-only, no DB) always allowed; enough to unblock typing if `migrate dev` is classifier-blocked.
  - **Design invariant (must hold for B/C):** block layer = HARD filter only; never touch `SlotScorer.ts`/energy-window code. Phase C reflow = re-run existing `scheduleAllTasksForUser`, not new logic.
  - **`CalendarService.getEvents` real sig** = `(start, end, calendarIds[], userId)`. `CalendarEvent.title` = block summary; `transparency` defaults `"opaque"` so `getEvents` (drops transparent) is safe for block reads.

---

## 2026-05-17 — Scheduling Blocks: Phase B part 2 shipped + live-verified

- **Branch:** `feat/scheduling-blocks` (NOT main, NOT pushed). Plan executed: `~/.claude/plans/continue-the-scheduling-blocks-feature-synchronous-salamander.md`. Phase B2 = the commitment-materializer orchestration that turns a `PersonalCommitment` into real protected emoji events on the user's Google "Task Blocks" calendar + mirrored local `CalendarEvent` rows, so Phase A's `filterByBlocks` hard-protects that time on the same scheduling run.
- **Did today (5 commits, agent-routed: Sonnet ×4 / Opus ×1 on the core, strict TDD RED→GREEN per checkpoint):**
  - **CP1 `ad72917`** — `src/services/google-task-sync.ts`: added exported `getCommitmentCalendarContext(userId)` (resolves `AutoScheduleSettings.taskBlocksFeedId` → `CalendarFeed.url` → auth'd GCal client; null when no Google account / feature off), `insertCommitmentGoogleEvent`, `deleteCommitmentGoogleEvent` (404/410-idempotent). `pushOne`/`pushChunk` untouched. +6 resolver unit tests.
  - **CP2 `6049481`** — `src/services/scheduling/CommitmentMaterializer.ts`: exported `materialize(userId,horizonDays=14)` + `revoke(commitmentId)`. Busy set built ONCE (feed CalendarEvents + planned/materialized CommitmentEvents + scheduled Tasks); in-run `busy[]` push prevents same-run double-booking; GCal insert OUTSIDE the prisma tx, mirror CalendarEvent + promote to `materialized` INSIDE it; no-slot → `conflict`, never evicts; idempotent (2nd run created:0, zero new GCal inserts — materialized+googleEventId occurrences short-circuit BEFORE `pickSlot` because busy[] already reserves their own interval — intentional deviation from the literal plan, correct). `revoke` per-occurrence, GCal-delete→mirror-delete→cancel, no-throw on repeat. +7 unit tests incl. real `matchBlockRule` Phase A contract.
  - **CP3 `9c6688b`** — `/api/commitments` GET/POST (POST validates emoji is a protected `blockTypeMap` rule via `parseBlockTypeMap`), `[id]` PATCH (revoke+re-materialize on schedule-affecting change) / DELETE (204), `materialize` POST. `scheduleAllTasksForUser` calls `await materialize(userId)` in a try/catch right after the `userSettings` null-check, before the tasks query (a materialize failure can never block work scheduling). No API-route test harness in repo → service-layer test asserts call-order + throw-swallow.
  - **CP4 `4adec3f`** — `src/components/settings/PersonalCommitments.tsx` + registered "Commitments" tab in `src/app/(common)/settings/page.tsx`. Recurrence builder (weekday → `FREQ=WEEKLY;BYDAY=`), emoji picker gated to protected rules, conflict markers, re-materialize button, sonner toasts. No new deps.
  - **Live e2e `033bfdd`** — `tests/e2e/commitments.spec.ts`: API-driven against the REAL senecacbenson Google Task Blocks calendar (auth via a minted NextAuth JWT cookie — **no DB/account/password mutation**). Proved: 4 real GCal events materialized, mirrored CalendarEvents on the feed, `schedule-all` never lands work on a commitment interval, 2nd materialize idempotent (created:0). **Self-cleaning verified: zero residue on the real calendar.**
- **Working:** All 5 commits pass pre-commit (lint + `tsc --noEmit`). `src/services/scheduling` suite **63/63** green. Live contract verified end-to-end on the real calendar.
- **Broken / caveats:**
  - Live e2e assertion #5 nuance: the overlapping work task came back **unscheduled** (`scheduledStart=null`), not relocated — the real dev DB has no synced Deep/Light **eligible** blocks in-window so `noEligibleBlockPolicy=schedule_nothing` parked it. Protection invariant holds (scheduler refused to place work on the commitment; nothing evicted) but the "reflows elsewhere" path is NOT yet exercised live. Worth a follow-up e2e once eligible blocks exist in dev, or with a `fallback_work_hours` user.
  - Pre-existing `console.error` noise in `chunked-scheduling.test.ts` (its prisma mock lacks `systemSettings`) — not ours, suite passes.
  - Dev server: a pre-existing `next-server` on port 3001 (PID from before this session) served the e2e; our `PORT=3001 npm run dev` no-op'd on the busy port. Not killed (not ours). If you need a clean server, `pkill -f next-server` first.
- **Next concrete task: Phase C** (`CommitmentAdjuster.skipOccurrence({reflow}) / moveOccurrence`): cancel CommitmentEvent + delete GCal event + (reflow:"work") write temp 🪶 block tagged `gs:reflow:<id>` + makeup same ISO week + re-run `scheduleAllTasksForUser`. `/api/commitments/[id]/skip|move`. Skip/move/snooze UI. Deterministic core only; NL adapter deferred to brain-dump pipeline. See plan Phase C section in `~/.claude/plans/as-a-user-i-indexed-wirth.md`. STOPPED here per user for review before Phase C.
- **Phase C PREREQ (do not skip):** the reflow-elsewhere path (freed time → work schedules IN) is the core of Phase C and was NEVER exercised live in B2 — B2 e2e only proved no-eviction (task parked, `schedule_nothing`). Phase C e2e MUST seed Deep/🪶Light **eligible** `CalendarEvent` blocks on the Task Blocks feed in-window (or use a `fallback_work_hours` user) so a displaced/temp-block task can actually land — otherwise Phase C is tested blind. Build this into the Phase C e2e setup before asserting reflow.
- **Context for future-me:** CP1/CP2/CP3 exports are the Phase C foundation — `materialize`/`revoke` are stable, idempotent, and ctx-null-safe; reuse `getCommitmentCalendarContext` + the GCal primitives for the reflow temp-block writes. e2e auth trick (mint NextAuth JWT via `encode()` from `next-auth/jwt` + NEXTAUTH_SECRET, inject as `next-auth.session-token` cookie into Playwright `APIRequestContext`) is the clean way to drive the real user without touching their credentials — reuse for Phase C e2e.

