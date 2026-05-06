# Frictions

> Phase 3 friction journal. Begins after Phase 1 ships. Until then this file stays empty.
> Format: `YYYY-MM-DD — [one-line observation]`
> Rules: no analysis, no fixes, no code, no themes — just one line per real-world annoyance.
> Target: ≥15 lines over 14 days.

2026-05-03 — autoSync toggle on /settings#integrations does nothing on a cold load until you visit #calendar first; the Zustand feed store stays empty and the armed setInterval no-ops.
2026-05-06 — page `<title>` still reads "Calendar | FluidCalendar" / "Tasks | FluidCalendar" after Sprint 1 rebrand; layout metadata wasn't updated.
2026-05-06 — duplicate events in the dedicated GCal "FluidCalendar Tasks" calendar: `Test 1` and `High energy 1` each have an orphan twin not tracked by any DB task — looks like historic regression where googleEventId failed to persist before the next push fired.
2026-05-06 — POST `/api/tasks` schedules the task locally (sets `scheduledStart`) but doesn't fire the GCal push hook, so a freshly-created task only appears in GCal after a separate Auto-schedule run.
2026-05-06 — task PUT response returns the task body before the awaited GCal sync mutates `googleEventId`; clients reading the response will see stale event ids on unschedule paths until they re-fetch.
2026-05-06 — toggling `isAutoScheduled=false` alone does NOT delete the mirrored GCal event; the sync delete branch keys off `scheduledStart && scheduledEnd` both being null. Users have to clear the schedule, not just the toggle.
