# FluidCalendar / FocusFlow Codebase Map

> Filled in Phase 0. Update when major architectural changes land.

---

## 1. Top-level folder purpose

| Path | Purpose |
|------|---------|
| `prisma/` | Postgres schema (32 models) + migrations |
| `src/` | Next.js App Router app source |
| `src/app/` | Pages (under `(common)` layout group: calendar, tasks, settings, focus, setup, auth) + API routes |
| `src/app/api/` | Backend route handlers (`route.ts` files) |
| `src/components/` | React UI by feature: auth, calendar, dnd, focus, navigation, projects, providers, settings, setup, tasks, ui (primitives) |
| `src/lib/` | Utilities: auth, calendar, commands, email, logger, saas, services, stripe, task-sync, utils, waitlist |
| `src/services/` | Domain services (notably `services/scheduling/`) |
| `src/hooks/` | Custom React hooks (useAdmin, usePageTitle, useCommands) |
| `src/store/` | Zustand stores (calendar, focusMode, settings, task, project, etc.) |
| `src/types/` | TypeScript type defs |
| `src/__tests__/` | Jest unit + integration tests |
| `tests/` | Playwright E2E suite |
| `public/` | Static assets |
| `docker/` | Docker build config |
| `docs/` | Project documentation |
| `.github/` | CI workflows |
| `next.config.js` / `next.config.ts` | Next.js config |
| `tsconfig.json` | TypeScript compiler options |
| `jest.config.js` | Jest config |
| `playwright.config.ts` | Playwright config |
| `package.json` | Dependencies + scripts |
| `docker-compose.yml` | Local dev (Postgres + optional prebuilt app image) |
| `Dockerfile` | Production image |
| `tailwind.config.ts` | Tailwind theme |
| `migrate.js` | Migration runner script |
| `entrypoint.sh` | Container entry script |

---

## 2. Prisma data model

> Schema source: `prisma/schema.prisma`. ~32 models. Key models for FocusFlow work in **bold**.

### Auth
- **User** — id, name, email (unique), emailVerified, image, role; relations: accounts, sessions, calendars, autoScheduleSettings, userSettings, calendarSettings, notificationSettings, integrationSettings, dataSettings, tasks, projects, connectedAccounts, tags, JobRecord, taskProviders, TaskChange, PasswordReset, subscription
- **Account** — NextAuth standard (provider, providerAccountId, access_token, refresh_token, expires_at, etc.)
- **Session** — sessionToken (unique), userId, expires
- **VerificationToken** — identifier, token (unique), expires
- **PasswordReset** — userId, token (unique), expiresAt, usedAt
- **ConnectedAccount** — provider, email, accessToken, refreshToken, expiresAt; **the GCal/Outlook OAuth account record** (caldavUrl/Username for CalDAV); FK userId; relations: calendars, TaskProvider; @@unique([userId, provider, email])

### Calendar
- **CalendarFeed** — id, name, url, type (LOCAL/GOOGLE/OUTLOOK/CALDAV), color, enabled; **`lastSync`**, **`syncToken`**, **`error`**, channelId, resourceId, channelExpiration, caldavPath, ctag; FK userId, accountId
- **CalendarEvent** — feedId, externalEventId, title, description, start, end, location, isRecurring, recurrenceRule, allDay, status, sequence, created, lastModified, organizer (json), attendees (json), isMaster, masterEventId, recurringEventId; indexed on [feedId], [start, end], [externalEventId], [masterEventId], [recurringEventId]
- **CalendarSettings** — workingHoursEnabled (default false), workingHoursStart, workingHoursEnd, workingHoursDays, defaultDuration, defaultColor, defaultReminder, refreshInterval; **note: `workingHours*` here are STRING ("09:00") — separate from AutoScheduleSettings.workHourStart (Int hour)**

### Tasks / Projects
- **Project** — name, description, color, status (active/archived), externalId, externalSource, lastSyncedAt; FK userId; @@index([status]), @@index([externalId, externalSource])
- **Task** — title, description, status (todo/in_progress/completed), dueDate, **`startDate`**, duration (Int), priority, **`energyLevel`** (morning/afternoon/evening), preferredTime, **`isAutoScheduled`**, **`scheduleLocked`**, **`scheduledStart`**, **`scheduledEnd`**, **`scheduleScore`**, lastScheduled, postponedUntil, isRecurring, recurrenceRule, lastCompletedDate, completedAt, externalTaskId, source, lastSyncedAt, externalListId, externalCreatedAt, externalUpdatedAt, syncStatus, syncError, syncHash, skipSync; FKs userId, projectId
- **Tag** — name, color, FK userId; M:N to Task

### Scheduler settings (BUG 2 epicenter)
- **AutoScheduleSettings** — userId @unique; **`workDays`** (String, likely JSON-encoded weekday list), **`workHourStart`** (Int, 0-23), **`workHourEnd`** (Int, 0-23), `selectedCalendars`, `bufferMinutes`, **`highEnergyStart`**/**`highEnergyEnd`**, **`mediumEnergyStart`**/**`mediumEnergyEnd`**, **`lowEnergyStart`**/**`lowEnergyEnd`** (Int hours), `groupByProject` (default false)

### Other settings
- **UserSettings** — theme, defaultView, timeZone, weekStartDay, timeFormat
- **NotificationSettings** — emailNotifications, dailyEmailEnabled, eventInvites, eventUpdates, eventCancellations, eventReminders, defaultReminderTiming
- **IntegrationSettings** — googleCalendarEnabled/AutoSync/Interval (default 3600s), outlookCalendarEnabled/AutoSync/Interval
- **DataSettings** — autoBackup, backupInterval, retainDataFor
- **SystemSettings** (singleton) — googleClientId/Secret, outlookClientId/Secret/TenantId, logLevel, logRetention, logDestination, publicSignup, disableHomepage, resendApiKey

### External-system sync
- **TaskProvider** — userId, type ('outlook'/'google'/etc.), name, enabled, syncEnabled, syncInterval, lastSyncedAt, accessToken, refreshToken, expiresAt, accountId (FK ConnectedAccount), defaultProjectId, settings (json); @@unique([userId, type])
- **TaskListMapping** — providerId, projectId, externalListId, externalListName, direction (sync/one-way/two-way), isDefault, syncEnabled, isAutoScheduled, lastSyncedAt, syncStatus, lastError; @@unique([providerId, externalListId])
- **TaskChange** — taskId, providerId, mappingId, changeType (CREATE/UPDATE/DELETE), changeData (json), synced, timestamp, userId

### Misc
- **Log** — timestamp, level, message, metadata, source, expiresAt
- **JobRecord** — queueName, jobId, name, data, status (PENDING/ACTIVE/COMPLETED/FAILED/DELAYED/PAUSED), result, error, attempts, maxAttempts, startedAt, finishedAt, userId; @@unique([queueName, jobId])
- **Subscription** — plan (FREE/LIFETIME), status (ACTIVE/PAYMENT_PENDING/PAYMENT_FAILED), stripeCustomerId, stripePaymentIntentId, amount, discountApplied
- **Waitlist** / **PendingWaitlist** / **BetaSettings** — SaaS waitlist (irrelevant to OSS build)

---

## 3. API routes

> All under `src/app/api/**/route.ts` (Next.js App Router). Methods exported per file.

### Auth
| Route | Methods | File:line |
|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | `src/app/api/auth/[...nextauth]/route.ts:33` — NextAuth handler |
| `/api/auth/register` | POST | `src/app/api/auth/register/route.ts:11` — email/password register |
| `/api/auth/public-signup` | GET | `src/app/api/auth/public-signup/route.ts` |
| `/api/auth/check-admin` | GET | `src/app/api/auth/check-admin/route.ts` |
| `/api/auth/reset-password/request` | POST | `src/app/api/auth/reset-password/request/route.ts` |
| `/api/auth/reset-password/reset` | POST | `src/app/api/auth/reset-password/reset/route.ts` |

### Google Calendar (BUG 1 epicenter)
| Route | Methods | File:line |
|---|---|---|
| `/api/calendar/google` | GET, POST, **PUT** | `src/app/api/calendar/google/route.ts` — **PUT 449-626 = sync entry**, GET = OAuth callback, POST = add calendar |
| `/api/calendar/google/[id]` | PATCH, DELETE | `src/app/api/calendar/google/[id]/route.ts` |
| `/api/calendar/google/events` | POST, PUT, DELETE | `src/app/api/calendar/google/events/route.ts` |
| `/api/calendar/google/available` | GET | `src/app/api/calendar/google/available/route.ts` |
| `/api/calendar/google/auth` | GET | `src/app/api/calendar/google/auth/route.ts` — initiate OAuth |

### Outlook Calendar
`/api/calendar/outlook` (GET), `/sync` (GET/POST/PUT), `/events` (POST/PUT/DELETE), `/available` (GET), `/auth` (GET).

### CalDAV
`/api/calendar/caldav` (POST), `/sync` (POST/PUT), `/events` (POST/PUT/DELETE), `/available` (GET), `/auth` (POST), `/test` (POST).

### Tasks
| Route | Methods | File:line |
|---|---|---|
| `/api/tasks` | GET, POST | `src/app/api/tasks/route.ts:19` |
| `/api/tasks/[id]` | GET, PUT, DELETE | `src/app/api/tasks/[id]/route.ts` |
| `/api/tasks/schedule-all` | POST | `src/app/api/tasks/schedule-all/route.ts:10` — **scheduler entry** |
| `/api/tasks/normalize-recurrence` | POST | `src/app/api/tasks/normalize-recurrence/route.ts` |

### Task sync (third-party providers)
`/api/task-sync/providers` (GET/POST), `/[id]` (GET/PATCH/DELETE), `/[id]/lists` (GET), `/mappings` (GET/POST), `/[id]` (GET/PATCH/DELETE).

### Events
`/api/events` (GET/POST/PATCH/DELETE), `/[id]` (GET/PATCH/DELETE).

### Projects + Tags
`/api/projects`, `/[id]`, `/api/tags`, `/[id]` — standard CRUD.

### Feeds
`/api/feeds` (GET/POST/PUT/PATCH/DELETE), `/[id]` (GET/PATCH/DELETE), `/[id]/sync` (POST).

### Settings
`/api/system-settings`, `/user-settings`, `/calendar-settings`, **`/auto-schedule-settings`** (GET/PATCH), `/data-settings`, `/notification-settings`, `/integration-settings`, `/settings/homepage-disabled`.

### Misc
`/api/logs` (GET/DELETE), `/sources`, `/settings`, `/batch`, `/cleanup`. `/api/import/tasks`, `/api/export/tasks`. `/api/setup`, `/setup/check`. `/api/integration-status`. `/api/accounts` (GET/DELETE).

---

## 4. NextAuth flow

- **Config:** `src/lib/auth/auth-options.ts`
- **Handler:** `src/app/api/auth/[...nextauth]/route.ts:1-33`
- **Strategy:** JWT (no DB session adapter). MaxAge: 365 days (`auth-options.ts:139`).
- **Providers:**
  - **Google OAuth 2.0** — `auth-options.ts:38-50`. Scopes: `email`, `calendar`, `calendar.events`, `tasks`. Offline access enabled. Client ID/Secret from env or `SystemSettings` DB row.
  - **Azure AD (Outlook)** — `auth-options.ts:51-60`. Tenant + Client from env or DB.
  - **Credentials (email/password)** — `auth-options.ts:62-91`. Calls `authenticateUser()` in `src/lib/auth/credentials-provider.ts` (bcrypt verify).
- **Callbacks:**
  - `jwt` — `auth-options.ts:94-114`. Stores accessToken, refreshToken, expiresAt, provider, role on token at sign-in.
  - `session` — `auth-options.ts:115-128`. Attaches tokens + role to client session.
- **Pages:** signin `src/app/(common)/auth/signin/page.tsx`, reset-password `src/app/(common)/auth/reset-password/page.tsx`.
- **Helpers:**
  - `getGoogleCredentials()` — `src/lib/auth.ts:3-22`
  - `getOutlookCredentials()` — `src/lib/auth.ts:24-52`

---

## 5. Auto-scheduler

- **API entry:** `src/app/api/tasks/schedule-all/route.ts:10` — `POST` calls `scheduleAllTasksForUser(userId)`.

### Algorithm walkthrough
1. `src/app/api/tasks/schedule-all/route.ts:21` — auth + invoke service
2. `src/services/scheduling/TaskSchedulingService.ts:92-150` — fetch unscheduled tasks for user, exclude `scheduleLocked`
3. `src/services/scheduling/TaskSchedulingService.ts:125-171` — score each task by best slot in 7-day window, parallel batches of 8
4. `src/services/scheduling/TaskSchedulingService.ts:175-181` — sort tasks by best score (desc)
5. `src/services/scheduling/TaskSchedulingService.ts:190-211` — schedule each in order: `TimeSlotManager.findAvailableSlots()` → pick best → update task (`scheduledStart`, `scheduledEnd`, `isAutoScheduled=true`, `scheduleScore`) → add to conflicts list

### Where work hours are read (BUG 2 candidate sites)
- `src/services/scheduling/TimeSlotManager.ts:54-60` — `TimeSlotManagerImpl` accepts `AutoScheduleSettings` (`workHourStart`/`workHourEnd` Int 0-23)
- `src/services/scheduling/SchedulingService.ts:88-111` — settings loaded from Prisma `AutoScheduleSettings` OR fallback to Zustand `useSettingsStore().autoSchedule` ⚠️ dual-source path = likely root cause area

### Where energy preferences are read
- `src/services/scheduling/SlotScorer.ts:1-40` — `SlotScorer` ctor receives settings with `highEnergyStart/End`, `mediumEnergyStart/End`, `lowEnergyStart/End`
- `src/lib/autoSchedule.ts` — `getEnergyLevelForTime()` maps current time → energy level matched to task `energyLevel`

### Slot assignment
- `src/services/scheduling/TaskSchedulingService.ts:257-288` — `findAvailableSlots()` returns ranked slots; best chosen; `prisma.task.update()`
- `src/services/scheduling/TimeSlotManager.ts:78+` — generate candidates + rank via `SlotScorer.scoreSlot()` (factors: energy match, priority, buffer, project grouping)

### Tests
- ❌ No dedicated scheduler tests in `src/__tests__/` — **coverage gap**

---

## 6. Google Calendar sync

### Files involved
- `src/lib/google-calendar.ts` — Google Calendar client factory + event CRUD
- `src/lib/google.ts` — OAuth2 client + token mgmt entry
- `src/lib/token-manager.ts` — token persist + refresh (singleton via `TokenManager.getInstance()`)
- `src/app/api/calendar/google/route.ts` — sync entry + OAuth callback (GET) + add calendar (POST) + sync calendar (PUT)
- `src/app/api/calendar/google/events/route.ts` — event CRUD endpoints
- `src/app/api/calendar/google/auth/route.ts` — OAuth initiation
- `src/app/api/calendar/google/available/route.ts` — list available calendars

### Sync entry point
- `src/app/api/calendar/google/route.ts:449-626` — `PUT` handler: receives `feedId`, fetches all events from Google, persists in DB.

### How events are fetched
- `src/app/api/calendar/google/route.ts:53-65` — `fetchAllEvents()` helper calls `calendar.events.list()` in `do...while` loop on `nextPageToken`
- Invoked at `:488` with: `calendarId: feed.url`, `timeMin/timeMax`, `singleEvents: true`, `orderBy: 'startTime'`

### Date-window handling (BUG 1 critical)
- `src/app/api/calendar/google/route.ts:250-251` and `:490-491`
- `timeMin = current year Jan 1`, `timeMax = next year Jan 1` → **2026-01-01 → 2027-01-01 covers all of 2026**. Sync should include events past Apr 14.
- ⚠️ Bug 1 is **NOT** a hardcoded 14-day window. Likely culprits instead:
  - `lastSync` field on `CalendarFeed` last updated 2026-04-14 → auto-sync hasn't fired since
  - `syncToken` (incremental sync) — present on `CalendarFeed` model — may have expired/410'd silently
  - Auto-sync interval (`IntegrationSettings.googleCalendarInterval`, default 3600s) — is the sync job actually running? Check `JobRecord` table
- Hypothesis updated for Phase 0.5 trace.

### Pagination
- `:59-63` — `do...while (pageToken)` loop. Looks correct.

### Token storage + refresh
- Prisma model: **ConnectedAccount** (provider, accessToken, refreshToken, expiresAt) — referenced `:193-198`
- Storage: `:106-116` — `TokenManager.getInstance().storeTokens(accountId, tokens)`
- Refresh: `src/lib/google-calendar.ts:25-31` — `getGoogleCalendarClient()` checks expiry, calls `tokenManager.refreshGoogleTokens()` if within 5-min window

### Tests
- `src/__tests__/google-provider.test.ts` (Google Task Provider, not Calendar)
- `src/__tests__/calendar-google-auth-route.test.ts` (auth route)
- `src/__tests__/google-integration.test.ts`

---

## 7. Frontend structure

### Pages
| Route | File |
|---|---|
| `/calendar` (default) | `src/app/(common)/calendar/page.tsx` |
| `/tasks` | `src/app/(common)/tasks/page.tsx` |
| `/settings` | `src/app/(common)/settings/page.tsx` (tab hub: accounts, user, calendar, auto-schedule, task-sync, notifications, etc.) |
| `/focus` | `src/app/(common)/focus/page.tsx` (Phase 6 Now Mode replacement target) |
| `/setup` | `src/app/(common)/setup/page.tsx` |
| `/auth/signin` | `src/app/(common)/auth/signin/page.tsx` |

### Key components
- `src/components/settings/AutoScheduleSettings.tsx` — **Bug 2 UI epicenter**: work-hours sliders, weekday checkboxes, calendar select, energy-window sliders
- `src/components/settings/UserSettings.tsx` — timezone, time format, week start
- `src/components/settings/CalendarSettings.tsx` — feed mgmt
- `src/components/settings/IntegrationSettings.tsx` — sync provider toggles
- `src/components/calendar/*` — calendar UI
- `src/components/tasks/*` — task list/board
- `src/components/ui/*` — Radix UI wrappers (button/select/switch/dialog/...)

### State management
- **Zustand 4.5** with `persist` middleware
- Stores at `src/store/`:
  - `useSettingsStore()` — global settings (autoSchedule, integrations, user prefs)
  - `useCalendarStore()` — feeds + events
  - `useTaskStore()`, `useProjectStore()`, `useFocusModeStore()`, etc.

### Settings UI for work hours / energy
- Component: `src/components/settings/AutoScheduleSettings.tsx:56-100+`
- API: `src/app/api/auto-schedule-settings/route.ts` (GET/PATCH)
- Persisted: Prisma `AutoScheduleSettings`

---

## Bug 1: GCal sync cutoff (events past 2026-04-14)

### Root cause: `autoSync` is a dead UI feature
- Settings UI (`src/components/settings/IntegrationSettings.tsx:56-83`) renders `autoSync` checkbox + `syncInterval` input. Saves to DB via `updateIntegrationSettings`.
- Defaults: `autoSync: true`, `syncInterval: 5` (`src/store/settings.ts:77`).
- **Zero code in `src/` reads these settings to fire a timer.** No `setInterval`, cron, BullMQ, or background job wires `autoSync`.
- Only trigger: manual button in `src/components/calendar/FeedManager.tsx:36` → calls `syncFeed(id)` (`src/store/calendar.ts:638`) → PUT `/api/calendar/google` (`src/app/api/calendar/google/route.ts:449-626`).
- PUT handler does **full delete-and-replace** (no incremental syncToken usage on Google path), with `timeMin/timeMax` = full year window.
- Result: last manual click was ~2026-04-14, no events synced since.

### Diagnostic for Phase 1 confirmation
```sql
SELECT id, name, "lastSync" FROM "CalendarFeed" WHERE type = 'GOOGLE';
```
Expected: `lastSync` ≈ 2026-04-14. Manual click on UI sync button → events post-Apr-14 appear immediately.

### Rejected hypotheses
- **H2 syncToken stuck/expired** — REJECTED. PUT handler at `:488-494` does not pass `syncToken` to Google API. No incremental logic exists on Google path.
- **H3 cron/queue down** — REJECTED. There is no cron/queue system in this codebase (no Redis/BullMQ in non-SaaS build). The system was never built; it's not down.
- **H4 frontend filter hides future events** — REJECTED. `src/app/api/events/route.ts:23-37` returns all events unfiltered by date. UI window filter (`src/store/calendar.ts:155-232`) is correct.

### Lower-confidence secondary risks (worth Phase 1 quick check)
- **Token refresh failure silently 500s** — `src/lib/token-manager.ts:46` `refreshGoogleTokens`. If Google revoked refresh token after long inactivity, `getGoogleCalendarClient` returns null, route at `:614` only catches 401 GaxiosError; generic Error("Failed to refresh tokens") falls to 500 → UI shows "Failed to sync calendar" (could be missed by user).
- **30s Prisma transaction timeout** (`route.ts:606`) — large recurring-event load could time out + roll back, leaving feed empty. Same external symptom.

### Fix options for Phase 1
- **Minimal:** none required for the bug itself. A single manual sync click recovers events. But user wants `autoSync` to actually work.
- **Real fix (recommended):** implement client-side `setInterval` driven by `IntegrationSettings.googleCalendarInterval` that calls `syncAllFeeds()`. Lives in a top-level provider. ~20-30 lines.
- **Alt:** server-side polling endpoint + Vercel/cron. Heavier; defer until Phase 2 deploy.

### Suspect files for Phase 1 edits
- `src/store/calendar.ts` — `syncAllFeeds` defined `:694`, never called externally. Wire to interval.
- `src/components/providers/` — likely home for a top-level `<AutoSyncProvider />` or hook
- Maybe a new file `src/hooks/useAutoSync.ts`

---

## Bug 2: scheduler ignores work hours/energy

### Findings: TWO simultaneous bugs

#### Bug 2a — Timezone bug in `SlotScorer` (CRITICAL, correctness)
- `src/services/scheduling/SlotScorer.ts:83-84` — `scoreEnergyLevelMatch()` calls `getEnergyLevelForTime(slot.start.getHours(), this.settings)`.
- `slot.start` is a UTC `Date`. `.getHours()` returns hour in **server's local timezone** — on Docker container, that's UTC. User's `highEnergyStart`/`End` are stored as local hours (e.g., 9-11).
- Result: if user UTC-5, 9am local = 14:00 UTC. `getEnergyLevelForTime(14, settings)` checks against ranges configured for local hours → returns wrong energy level (or none).
- Same bug in `scoreTimePreference()` at `:108` — `const hour = slot.start.getHours();` no zone conversion.
- **Contrast:** `TimeSlotManager.filterByWorkHours()` (`:279-303`) **does** correctly call `toZonedTime(slot.start, this.timeZone).getHours()` — work-hour HARD FILTER works.
- `SlotScorer` constructor receives no timezone. `TimeSlotManagerImpl` reads `useSettingsStore.getState().user.timeZone` at `:59` but never passes it to `SlotScorer`.

#### Bug 2b — Energy is soft-score only (DESIGN, may be intentional)
- `SlotScorer.scoreEnergyLevelMatch()` returns 0-1 multiplied by weight 1.5.
- Other weights: `deadlineProximity` 3.0, `priorityScore` 1.8.
- High-priority/overdue task with mismatched energy still scores high enough to win — energy is overridden, not enforced.
- May be intentional graceful degradation. Decide product-level whether to add hard filter.

### Failure-mode verdicts
- (a) data not read — NOT GUILTY on normal server path. Zustand fallback in `SchedulingService.ts:88-111` is dead-but-harmless on server.
- (b) read+ignored — GUILTY for energy (soft score only, not enforced).
- (c) broken predicate — GUILTY: timezone error in `SlotScorer`.
- (d) UI not saving — NOT GUILTY. `AutoScheduleSettings.tsx` PATCH → `auto-schedule-settings/route.ts:55` upsert → all fields persisted correctly.

### Minimal fix (Phase 1)
**Three one-line changes, two files:**

`src/services/scheduling/SlotScorer.ts` constructor:
```ts
constructor(
  private settings: AutoScheduleSettings,
  private scheduledTasks: Map<string, ProjectTask[]> = new Map(),
  private timeZone: string = "UTC"
) {}
```

`scoreEnergyLevelMatch()` `:84`:
```ts
const localHour = toZonedTime(slot.start, this.timeZone).getHours();
const slotEnergy = getEnergyLevelForTime(localHour, this.settings);
```

`scoreTimePreference()` `:108`:
```ts
const hour = toZonedTime(slot.start, this.timeZone).getHours();
```

`src/services/scheduling/TimeSlotManager.ts:58`:
```ts
this.slotScorer = new SlotScorer(settings, new Map(), this.timeZone);
```

Plus `import { toZonedTime } from "@/lib/date-utils";` in `SlotScorer.ts`.

### Bug 2b decision (defer or fix)
- If Seneca wants energy STRICTLY enforced: add `filterByEnergyLevel()` step in `TimeSlotManager` after `filterByWorkHours()`. Probably 10 lines.
- If soft-score is fine once timezone bug fixed: no change needed (most slots will land in correct energy windows naturally).
- Recommend: fix 2a only in Phase 1, observe behavior, decide on 2b in Phase 3 friction window.

### Tests gap
- Zero tests on `SlotScorer`, `TimeSlotManager`, `TaskSchedulingService`. Phase 1 stretch: one Playwright test asserting tasks land inside narrow work hours after fix.
