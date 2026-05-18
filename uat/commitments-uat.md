# UAT: Personal Commitments — CRUD + Materialize + Skip/Move/Makeup + Timezone

- **Feature / PR:** `feat/scheduling-blocks-followups`; Phase B/B2 + Phase C (R1–R5) + tz fixes #14/#18
- **Date scripted:** 2026-05-18
- **Base URL:** http://localhost:3000  (override: TEST_BASE_URL)
- **Run id:** <set at execution — 20260518-070851>

## Persona

Seneca, Wednesday 9pm, three work tasks overdue. He keeps a recurring 💪🏽
Movement commitment (Tue/Thu) that auto-blocks his calendar. Tonight he needs
to: add a new commitment, watch it materialize onto the real Task Blocks
Google Calendar, skip Thursday's occurrence (work emergency) and trust the
make-up auto-refits the same week, then move next Tuesday's to a custom time.
He is impatient, double-clicks, and will reload to check it actually stuck.

## Acceptance criteria

- Functional: create → `POST /api/commitments` 201 returns `{commitment, materialize}`;
  materialize writes real GCal events (`googleEventId` set, `CalendarEvent`
  mirror rows exist). Skip cancels the occurrence, drops a reflow block, and
  auto-makeup refits same ISO week. Move validates conflicts (409 on
  collision, no mutation). Cancelled occurrences never resurrected by a
  second materialize. Timezone: GCal event lands at the right **wall-clock**
  hour for the user's tz, not UTC-shifted.
- Visual: each commitment renders header (emoji+label), recurrence summary,
  next non-cancelled occurrences with Skip/Move buttons; toasts confirm
  outcomes; conflict occurrences show red "Couldn't fit" badge.
- Definition of done: full create→materialize→skip→makeup→move cycle works
  against real GCal, is idempotent, self-cleans, and never silently corrupts.

## Preconditions & seed

- Auth: NextAuth JWT for `cmp1et2bg00002i8c5ts40o53` (real user) as session cookie.
- Data state: `AutoScheduleSettings.taskBlocksFeedId` wired to existing
  "Task Blocks" feed `619f2c29-f3b4-47c1-ae2f-cf64874fe70e` (capture original;
  `wireTaskBlocksFeed`/`restoreTaskBlocksFeed` pattern). blockTypeMap must
  contain a protected rule (default map has 💪🏽 → protected).
- Cleanup obligations (try/finally, runs even on failure, ORDER MATTERS):
  1. DELETE every created commitment via `/api/commitments/:id` (cascades
     GCal events + CalendarEvent rows) — **before** restoring settings, since
     revoke needs `taskBlocksFeedId` set.
  2. DELETE any created task.
  3. Run `scripts/e2e-reflow-cleanup.ts` to purge `gs:reflow:` temp blocks.
  4. Restore original `AutoScheduleSettings`.
  5. Verify cascade actually happened (re-query DB + `GET /api/commitments`),
     don't assume. All test labels prefixed `UAT TEMP <timestamp>`.

## Happy path

| #  | Action | Expected functional result | Expected visual result | Pass criteria |
|----|--------|----------------------------|------------------------|---------------|
| 01 | `browser_navigate` `/settings#commitments` | Commitments section loads; `GET /api/commitments` 200 | "Personal Commitments" heading; "Re-materialize now" + "Add commitment" buttons; "Add commitment" ENABLED (protected rule exists) | FAIL unless heading + enabled Add button visible AND GET 200 AND console clean |
| 02 | Click "Add commitment" | Inline "New commitment" form opens | Form with Label input, Block type select, Duration, weekday pills, Preferred start, Times/week, Active switch, Save/Cancel | FAIL unless full form visible |
| 03 | Fill Label `UAT TEMP <ts>`; Block type → 💪🏽 protected; Duration `60`; toggle `Tue`+`Thu`; Preferred start `4:00 PM`; click Save | `POST /api/commitments` 201; success toast summarizing materialize (`Materialized N…`); list refreshes | New commitment card appears with 💪🏽, label, "Weekly: Tue, Thu · 60 min", upcoming occurrence chips | FAIL unless card visible AND POST 201 AND `materialize.materialized ≥ 1` AND toast shown |
| 04 | Independently `GET /api/commitments` (authed request) | Created commitment present; its events have `status:"materialized"` + non-null `googleEventId` | (functional check, not screen) | FAIL unless event has googleEventId (proves real GCal write) — not just optimistic UI |
| 05 | tsx DB query: `CalendarEvent` rows for those googleEventIds on feed `619f2c29…` | Mirror rows exist, title = `💪🏽 UAT TEMP <ts>` | (DB-level functional proof) | FAIL unless mirror rows found with exact title |
| 06 | tsx DB query: read GCal event start; compute its wall-clock hour in the user's tz (#14/#18) | Event starts at 16:00 (preferredHour) local wall-clock, not 16:00 UTC shifted | (tz correctness proof) | FAIL if event local hour ≠ 16 (UTC-offset bug) |
| 07 | On the first future occurrence chip, click "Skip" | `POST /api/commitments/:id/skip` 200; occurrence cancelled; reflow block dropped; auto-makeup refits same week; toast `Skipped — moved to <when>` | That occurrence chip removed (filtered: status≠cancelled); a new make-up chip appears same ISO week; success toast | FAIL unless skip 200 AND makeup chip present AND toast AND console clean |
| 08 | Independently `GET /api/commitments` | Skipped event `status:"cancelled"`; a new materialized event same ISO week | (functional) | FAIL unless cancelled + makeup both present in API |
| 09 | On a future occurrence click "Move"; set datetime-local to a clearly-free future weekday 10:00; click "Confirm" | `POST /api/commitments/:id/move` 200; toast `Moved to <when>`; GCal event + row updated | Move editor closes; occurrence chip reflects new date; success toast | FAIL unless move 200 AND chip date changed AND toast |
| 10 | Click "Re-materialize now" | `POST /api/commitments/materialize` 200; idempotent — `created:0` (events already exist) | toast `Materialized 0, 0 conflicts, 0 skipped` (or created=0) | FAIL unless 200 AND created=0 (idempotency proven) |
| 11 | Edit the commitment (click "Edit"), change Duration to `45`, Save | `PATCH /api/commitments/:id` 200; card updates | Card shows "· 45 min"; success toast | FAIL unless PATCH 200 AND card reflects 45 AND reload-stable |
| 12 | Click "Delete" on the commitment | `DELETE /api/commitments/:id` 204; revoke cascades GCal + rows; toast "Commitment removed"; list refreshes | Card disappears; empty-state text returns if last | FAIL unless DELETE 204 AND card gone AND (step 13) cascade confirmed |
| 13 | tsx DB query post-delete | `PersonalCommitment` gone; its `CalendarEvent` mirrors gone | (cascade functional proof) | FAIL if commitment or any mirror row remains |

## Adversarial scenarios

| #  | Tactic | Action | Expected graceful behavior | Pass criteria |
|----|--------|--------|----------------------------|---------------|
| A1 | Empty required (input abuse) | Open Add form, leave Label blank, click Save | Toast "Label is required"; no POST fired; form stays open | FAIL on POST sent / 500 / silent close |
| A2 | No block type | Fill Label, leave Block type unpicked, Save | Toast "Please select a block type"; no POST | FAIL if commitment created without emoji |
| A3 | Invalid duration | Label set, Block type set, Duration `-5` (or `abc`), Save | Toast "Duration must be a positive number"; no POST | FAIL if negative/NaN duration persisted |
| A4 | Injection-ish label | Label `<script>alert(1)</script>`; valid block+duration; Save then reload | Stored + rendered as literal text in card, never executed | FAIL if script executes or breaks card render |
| A5 | Double-submit (timing/race) | Click "Save" twice within ~200ms on a valid new commitment | Exactly ONE commitment created (button disabled while `saving`); no duplicate card/rows | FAIL on 2 commitments / duplicate GCal events |
| A6 | Rapid double-skip (idempotent — R2) | Click "Skip" on an occurrence, then immediately click it again | First skip cancels + makeup; second is a no-op (occ already cancelled / button disabled `busyOccId`) — NOT a double-cancel or crash | FAIL if second skip errors, double-cancels, or creates 2 makeups |
| A7 | Move conflict (state, R4) | Move an occurrence onto a known protected block time (overlapping 💪🏽) | `409`; toast "That time collides with a protected block — pick another"; NO mutation (original occurrence unchanged) | FAIL if move succeeds / partial mutation / 500 |
| A8 | Cancelled not resurrected (R2/R3) | After A6 skip, click "Re-materialize now" | Cancelled occurrence is NOT re-created; `created` excludes it | FAIL if a cancelled slot reappears as materialized |
| A9 | Refresh mid-move (nav) | Open Move editor, type a datetime, do NOT confirm, reload page | No partial move persisted; occurrence unchanged; clean reload | FAIL if occurrence moved without Confirm or state corrupt |
| A10 | Empty state | Delete all commitments | "No commitments yet…" message; no crash; Add still works | FAIL on blank/crash |
| A11 | Mobile width (viewport) | `browser_resize` 390×844; walk create + skip | Form fields + occurrence chips wrap, all reachable/visible | FAIL if any control off-canvas/occluded |
| A12 | Cancel/abandon | Open Add form, fill partially, click "Cancel" | Form closes; NO commitment persisted (`GET /api/commitments` unchanged) | FAIL if partial record created |
| A13 | tz boundary (#14/#18) | Create commitment `preferredHour=2` (near a DST-sensitive early hour) over a horizon spanning a tz day-boundary; inspect materialized GCal start | Event lands at 02:00 local wall-clock each occurrence, horizon respects calendar-days-in-tz (no off-by-one day, no UTC shift) | FAIL if any occurrence hour ≠ 2 local or horizon day count wrong |

## Sign-off checklist

- [ ] Happy path — all steps PASS, signed off → screenshots purged
- [ ] Adversarial — all scenarios PASS, signed off → screenshots purged
- [ ] All FAILs either fixed & re-run green, or explicitly waived by user
- [ ] All created commitments/tasks DELETED; cascade verified in DB; reflow blocks purged; `AutoScheduleSettings` restored
- [ ] `/uat/.screenshots/<run-id>/` deleted after full sign-off
