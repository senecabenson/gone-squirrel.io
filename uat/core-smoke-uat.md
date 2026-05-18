# UAT: Core Smoke — Tasks / Projects / Tags / ClickUp / Auth / Focus / Settings

- **Feature / PR:** `feat/scheduling-blocks-followups` — baseline regression smoke
- **Date scripted:** 2026-05-18
- **Base URL:** http://localhost:3000  (override: TEST_BASE_URL)
- **Run id:** <set at execution — 20260518-070851>

## Persona

Seneca doing a Monday sanity sweep: log in, make sure tasks/projects/tags
still CRUD, ClickUp still imports, focus timer still works, settings tabs
still render and persist. Happy-path depth (not full adversarial) — but every
step still proves visual + functional + console/network clean.

## Acceptance criteria

- Functional: each core action's side effect persists (re-query/reload), API
  returns 2xx, expected request actually fires.
- Visual: the user can see the result (row, card, toast, nav state).
- Definition of done: no regression in core flows; no console errors / 4xx-5xx.

## Preconditions & seed

- Auth: NextAuth JWT for real user as session cookie.
- Cleanup: every task/project/tag created here prefixed `UAT TEMP <ts>` and
  DELETED in try/finally. ClickUp: do NOT disconnect the real account; only
  read state + a single Sync Now (no destructive ClickUp mutation).

## Happy path

| #  | Action | Expected functional result | Expected visual result | Pass criteria |
|----|--------|----------------------------|------------------------|---------------|
| 01 | `browser_navigate` `/tasks` unauthenticated (no cookie) | Redirect to `/auth/signin` | Sign-in page visible | FAIL unless redirected (gated route guard works) |
| 02 | Inject JWT cookie; `browser_navigate` `/tasks` | Authed app shell renders | Task list/board, left rail nav visible (not sign-in) | FAIL unless authed chrome AND `GET /api/tasks` 200 |
| 03 | Create task: open New task, title `UAT TEMP <ts>`, save | `POST /api/tasks` 200/201; task persisted | New task row visible in list | FAIL unless row visible AND POST 2xx AND reload-persists |
| 04 | Edit task title inline/modal → `UAT TEMP <ts> edited` | `PUT /api/tasks/:id` 200 | Row shows new title | FAIL unless title changed AND PUT 200 AND reload-persists |
| 05 | Mark task complete (status → completed) | `PUT` 200; `completedAt` set | Task shows completed state | FAIL unless completed visually AND API reflects status |
| 06 | Filter list by status / search `UAT TEMP` | `GET /api/tasks?...` returns filtered set | List narrows to matching tasks | FAIL unless list reflects filter AND request fired |
| 07 | Sort by dueDate asc/desc toggle | Client/API reorders | Visible order changes | FAIL unless order visibly changes |
| 08 | Create project `UAT TEMP Proj <ts>` | `POST /api/projects` 2xx | Project appears in sidebar with count | FAIL unless project visible AND 2xx |
| 09 | Create tag inline on a task | `POST /api/tags` 2xx; tag attached | Tag chip visible on task | FAIL unless tag visible AND 2xx |
| 10 | `browser_navigate` `/settings#clickup` | ClickUp settings render; connection state shown | Connected ClickUp account / spaces list visible (account already connected) | FAIL unless section renders AND no 4xx/5xx |
| 11 | Trigger ClickUp "Sync Now" | `POST` sync endpoint 200; per-list results | Success toast / result; imported tasks have source=CLICKUP | FAIL unless 200 AND ≥1 list result OK AND no silent error |
| 12 | `browser_navigate` `/focus` | Focus page renders; a task/chunk recommendable | Focus timer UI visible | FAIL unless UI visible AND no console error |
| 13 | Complete a focus chunk (or "finish later") | `PATCH /api/focus/chunks/:id/complete` or complete-parent 2xx | Chunk marked done / moved | FAIL unless 2xx AND UI reflects |
| 14 | `browser_navigate` `/settings#user` (Appearance) | UserSettings renders | Theme/timezone controls visible | FAIL unless renders, no error |
| 15 | Change a Notifications toggle at `/settings#notifications`, reload | `PATCH /api/notification-settings` 2xx; persists | Toggle state retained after reload | FAIL unless persisted post-reload |
| 16 | `browser_navigate` `/` (landing/splash) authed | Redirect/route to app (calendar) per session | Splash then app, no broken blank | FAIL unless lands on app, no console error |

## Adversarial scenarios (light — smoke tier)

| #  | Tactic | Action | Expected graceful behavior | Pass criteria |
|----|--------|--------|----------------------------|---------------|
| A1 | Empty task title | Save task with blank title | Validation blocks; no 500 | FAIL on 500 / empty task created |
| A2 | Deep link gated route | `browser_navigate` `/settings` with cookie cleared | Redirect to signin | FAIL on blank/broken page |
| A3 | Double-submit task create | Click save twice fast | One task created | FAIL on duplicate |
| A4 | Mobile width | `browser_resize` 390×844 on `/tasks` | Nav + list usable, nothing clipped | FAIL if controls unreachable |

## Sign-off checklist

- [ ] Happy path — all steps PASS, signed off → screenshots purged
- [ ] Adversarial (light) — all PASS, signed off → screenshots purged
- [ ] All FAILs fixed & re-run green or waived
- [ ] All created tasks/projects/tags DELETED; ClickUp account left connected & untouched
- [ ] `/uat/.screenshots/<run-id>/` deleted after full sign-off
