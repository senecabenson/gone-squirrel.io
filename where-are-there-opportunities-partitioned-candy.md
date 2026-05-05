# FluidCalendar Tightening — One Move At A Time

## The One Thing

**If only one thing happens: sync Google's `transparency` field, filter "free" events out of conflict scanner.**

This single change kills ~80% of overscheduling. ~20 lines, one schema migration, one query filter, one regression test. ½ Saturday.

Everything else in this file is parked until you've lived with that fix for a week.

---

## Why this is the move

Today FluidCalendar treats every Google event as busy. Motion treats only `transparency=opaque` as busy. Your "free" events (focus blocks marked free, optional invites, all-day reminders) currently steal scheduler slots. Fixing this matches Motion's behavior with one read of one field.

Files:
- [prisma/schema.prisma](Coding/fluid-calendar/prisma/schema.prisma#L125-L159) — add `transparency String? @default("opaque")` to `CalendarEvent`
- [src/lib/google-calendar/sync.ts:115-156](Coding/fluid-calendar/src/lib/google-calendar/sync.ts#L115-L156) — write `event.transparency` into the upsert
- [src/services/scheduling/CalendarServiceImpl.ts:67-102](Coding/fluid-calendar/src/services/scheduling/CalendarServiceImpl.ts#L67-L102) — filter conflicts to `transparency = 'opaque'`
- [src/services/scheduling/TimeSlotManager.ts:330-338](Coding/fluid-calendar/src/services/scheduling/TimeSlotManager.ts#L330-L338) — same filter on conflict scan

## How you know it's done

One Playwright test passes:
- Seed Google event with `transparency: transparent` covering 10:00–11:00
- Run auto-schedule on a 30min task
- Assert task lands inside 10:00–11:00

Then manually: connect your real Google calendar, mark a "Free" focus block in the morning, hit auto-schedule, watch a task land in it. If yes → done. Commit. Walk away.

## Time box

½ Saturday. If it stretches past 4 hours → stop, ask Opus advisor what spiraled.

---

## Parked — do not start until friction journal proves you need it

Everything below is research output, not a plan. It exists so future-you doesn't re-derive it. Do not open this section while working.

<details>
<summary>Click only if Tier-1 fix is in production for a week and friction is still real</summary>

### Parked fixes, ranked by impact

1. **Could-not-fit surfacing** — today `SchedulingService.scheduleTask` returns null silently. Add `Task.scheduleStatus` field; set `'could_not_fit'` on overflow. UI badge optional. ~30 lines.

2. **Hard deadline override** — add `Task.hardDeadline Boolean`. When true + dueDate near, allow scheduler to bypass work-hours filter for that task only. ~40 lines in `SlotScorer.scoreDeadlineProximity` + `TimeSlotManager.filterByWorkHours`.

3. **Strict comparator instead of weighted score for cross-task ordering** — today `SchedulingService.ts:177-181` blends priority + deadline into one number; Motion uses a strict comparator. Risk: changes daily task order in ways that feel weird. Only do this if friction journal calls it out.

4. **Server-side sync** — today sync runs in browser `setInterval` only ([src/store/settings.ts:12-13](Coding/fluid-calendar/src/store/settings.ts#L12-L13)). Tab closed = no sync. Defer until Phase 2 (deploy) — moot while local.

5. **Incremental sync** — today every sync does `deleteMany + recreate` ([src/app/api/calendar/google/route.ts:553-558](Coding/fluid-calendar/src/app/api/calendar/google/route.ts#L553-L558)). Schema already has `CalendarFeed.syncToken`; wire it. Reduces quota burn. Defer until you actually hit a quota wall.

### Things Motion has, that you don't need

- ASAP priority tier — your existing HIGH is fine
- Chunking (split long tasks) — ADHD use case is 30–90min blocks
- Master/child recurring expansion — RRULE row works for personal use
- Bi-directional event sync — Motion itself doesn't bi-dir tasks; pull-only events are fine

### Existing FocusFlow Phase 1 (already in flight)

The two bugs you're already fixing — GCal 14-day window cutoff + scheduler ignoring work hours/energy — are unrelated to this plan and stay on their own track ([i-m-starting-a-multi-week-zazzy-gadget.md](Coding/fluid-calendar/i-m-starting-a-multi-week-zazzy-gadget.md)). Finish those first. The Tier-1 transparency fix is Phase 1.5 — after both Phase 1 bugs ship.

### Audit data (don't read, just here for grep)

`SlotScorer` weights: deadlineProximity:3.0, energyLevelMatch:1.5, priority:1.8. Priority enum: HIGH/MEDIUM/LOW/NONE — no ASAP. Sync window hardcoded current-year-Jan-1 → next-year-Jan-1 in [src/lib/google-calendar/sync.ts:65-66](Coding/fluid-calendar/src/lib/google-calendar/sync.ts#L65-L66). All-day events handled correctly. Token refresh via `tokenManager.refreshGoogleTokens` works fine. Working hours / energy windows wiring is correct in `TimeSlotManager.filterByWorkHours` — Phase 1 Bug 2 is about something getting lost upstream of that filter.

</details>

---

## Verification (Tier-1 only)

```
docker compose up -d
npx playwright test tests/regression/transparency-filter.spec.ts
```

DB sanity:
```
docker compose exec db psql -U fluid -d fluid_calendar -c \
  "SELECT id, title, transparency FROM \"CalendarEvent\" LIMIT 10;"
```

Commit message:
```
fix(scheduler): respect Google Calendar transparency field

Bug: tasks scheduled over events marked "Free" in Google.
Cause: conflict scanner treated all synced events as busy regardless
       of transparency.
Fix: sync transparency field; filter conflicts to opaque only.
Test: regression test asserts task can land inside a transparent event.
```

That's it. Stop here.
