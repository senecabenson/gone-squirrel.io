# Now Mode — Design Spec

**Date:** 2026-05-11
**Sprint:** 2 (Now Mode rebuild)
**Status:** Draft for user review

## Context

The current `/focus` page is a passive 3-pane viewer (left = queue, center = current task, right = quick actions) inherited from upstream FluidCalendar. It assumes the user has already decided what to work on and just needs a focus aid. That assumption fails for the user (ADHD profile): the hard part is the decide-and-start moment, not the execution. Existing surface offers no scaffold for that moment.

GoneSquirrel's vision (section 6.3) calls for an active 3-step takeover: pick energy → pick time → get one recommended task → start Pomodoro. The point is to compress decision overhead to ≤ 3 taps from `/focus` arrival to Pomodoro running. Sprint 2 builds that.

Two ADHD-shaped problems also need to be solved alongside the picker flow:

1. **Task-switching cliff at Pomodoro end.** Defaulting back to "pick something" right after a round is the moment the brain wanders. The next task must be pre-loaded with one explicit confirmation tap.
2. **Force when temptation strikes.** If the user nav-aways from `/focus` mid-round, the running timer must remain unmissable everywhere else in the app. No dismiss button.

This spec ships:
- New 3-step picker (`pick-energy` → `pick-time` → `recommend`)
- Hero Pomodoro working state with collapsed "Up Next" queue peek
- Round-complete decision screen (Done / Need more time / Finish later / Break — no auto-flow)
- Off-page sticky banner (sienna gradient, ring + linear progress, no dismiss)
- "Finish later" → existing auto-scheduler reuses task with updated remaining estimate
- Always-on **chunkable tasks** (15-min min, 60-min max) so long tasks surface in Now Mode strictly
- Classic FocusMode kept as toggle for fallback

## UX flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  /focus                                                              │
│                                                                       │
│   ┌─────────┐    ┌─────────┐    ┌──────────────┐    ┌──────────────┐│
│   │ Step 1  │ →  │ Step 2  │ →  │ Step 3       │ →  │  Working      ││
│   │ Energy  │    │ Time    │    │ Recommend    │    │  (Pomodoro)   ││
│   │ L/M/H   │    │ pills   │    │ + reasoning  │    │  hero ring    ││
│   └─────────┘    └─────────┘    └──────────────┘    └──────────────┘│
│        ↑               ↑              ↑                      │       │
│        └───────────────┴──────────────┘                      ↓       │
│                                                       ┌──────────────┐│
│                                                       │ Round done   ││
│                                                       │ Done / +time ││
│                                                       │ Finish later ││
│                                                       └──────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

`pick-energy` and `pick-time` are skipped on subsequent rounds (carried forward from previous round) unless user explicitly hits "Change" — the path back is always one tap away.

## State machine

Single source of truth: new Zustand store `useNowModeStore` in `src/store/nowMode.ts`.

```ts
type NowModeStep = "pick-energy" | "pick-time" | "recommend" | "working" | "round-complete";

interface NowModeState {
  step: NowModeStep;
  energy: "low" | "medium" | "high" | null;
  durationMin: number | null;          // 15/30/45/60/90 — 90 means 90+ min, Pomodoro runs as a 90-min round; user can extend via +time or stop early
  recommendedTaskId: string | null;
  recommendedChunkId: string | null;   // chunk-aware
  // Pomodoro (wall-clock based)
  pomodoroStartedAt: number | null;    // ms epoch
  pomodoroDurationMs: number | null;   // chosen duration in ms
  pomodoroPausedAt: number | null;     // ms epoch or null if running
  pomodoroAccruedPausedMs: number;     // total paused ms across pauses
  timerMode: "countdown" | "countup";  // user-toggleable
  // Last round (for soft handoff)
  lastEnergy: "low" | "medium" | "high" | null;     // populated when user enters "working" step; used to skip pickers on the next round's "Done → next task" path
  lastDurationMin: number | null;                    // same lifecycle as lastEnergy
}
```

Persisted to `localStorage` via `zustand/middleware/persist`. Wall-clock based: `remainingMs = pomodoroDurationMs - (now - pomodoroStartedAt - accruedPausedMs)`. Survives refresh, sleep, browser quit.

URL hash mirrors `step` (`/focus#pick-time`) so browser back button works through the flow.

## Components

| File | Responsibility |
|---|---|
| `src/components/focus/NowMode.tsx` | Orchestrator. Reads `step` from store, renders matching subcomponent. Owns transitions + `document.title` updates when working. |
| `src/components/focus/EnergyPicker.tsx` | 3 horizontal cards (Low feather / Medium sprout / High flame) on sienna gradient. Selected = sienna fill + lift. Single tap → advance. |
| `src/components/focus/TimePicker.tsx` | Pill row 15/30/45/60/90+/Custom. Selected = sienna fill. Single tap → advance. |
| `src/components/focus/RecommendationCard.tsx` | Editorial card: meta pills (energy / duration / project) → big serif task title → italic serif reasoning line with sienna left-bar → full-width Start Now CTA → secondary "Pick different task" / "Change time" links. |
| `src/components/focus/PomodoroHero.tsx` | Working state. 280px conic-gradient ring, 21/47 split digits with MIN/SEC labels, mode pill ("COUNTDOWN ↻ tap"). Pause/Stop/Done early actions. Bottom "After this" pill (collapsed by default). |
| `src/components/focus/UpNextSheet.tsx` | Tap "After this" → ring shrinks/dims, this slides in. Shows top 3 next tasks (drag-reorder). Tap ✕ to collapse. |
| `src/components/focus/RoundComplete.tsx` | Forced choice screen: Done / Need more time (+5/+15/+25) / Finish later / Break. No auto. On chunk-done, ALSO shows "I'm fully done with [parent] — clear remaining chunks" secondary CTA. |
| `src/components/focus/FinishLaterModal.tsx` | "How much more does this need?" pill row → live auto-schedule preview ("Tomorrow 10:30 AM · 45 min") → Schedule it / Manual / Cancel. |
| `src/components/focus/StickyPomodoroBanner.tsx` | Mounted in root `(common)/layout.tsx` via Portal. Sienna gradient strip above app header. Reads `useNowModeStore`. Conic ring + 21:47 + task title + Pause/Stop. Linear progress bar at base. **No ✕ dismiss.** Renders only when `step === "working"` AND pathname !== `/focus`. |
| `src/components/focus/FocusModeToggle.tsx` | Header switch on `/focus` — "Classic / Now". Persists in settings store. Default = Now. |
| `src/lib/now-mode/score.ts` | Pure scoring function. See Scorer section. |
| `src/lib/now-mode/reasoning.ts` | Reasoning phrase library + `pickReasoning(task, score) → string`. |
| `src/lib/now-mode/chunks.ts` | Chunk generation, eligibility, and "free remaining chunks" helpers. |
| `src/app/api/focus/recommend/route.ts` | POST `{ energy, durationMin }` → returns top task + chunk + reasoning. Server reads user's tasks + scheduler context. |
| `src/app/api/focus/finish-later/route.ts` | POST `{ taskId, remainingMin }` → mutates task + chunks + triggers existing scheduler + GCal push. |
| `src/app/api/focus/complete-parent/route.ts` | POST `{ taskId }` → closes parent + all remaining chunks + deletes their GCal events. Called from chunk-done "I'm fully done" CTA. |

## Scorer

`src/lib/now-mode/score.ts`:

```ts
interface ScoreInput {
  energy: "low" | "medium" | "high";
  durationMin: number;          // user pick
  tasks: TaskWithChunks[];      // eligible tasks
  now: Date;
  userTimeZone: string;
}

interface ScoreResult {
  task: Task;
  chunk: Chunk | null;          // null if task is single-block
  score: number;
  matchedExactly: boolean;      // false when no strict-fit chunk; shows mismatch note in card
  components: {
    energy: number;      // 0..1
    deadline: number;    // 0..1
    staleness: number;   // 0..1
    variety: number;     // 0..1
  };
}

function scoreTask(input: ScoreInput): ScoreResult | null;
```

**Weights** (per vision section 6.3): energy 40% / deadline 30% / staleness 15% / variety 15%.

**Strict eligibility:**
- A task is eligible if **any individual chunk** has `chunk.minutes <= durationMin`
- Since chunkable defaults on with `chunk_max = 60`, a 2-hour task with 4 × 30-min chunks IS eligible at 30 min
- A task with `time_estimate = 90, chunk_max = 60` becomes 2 chunks (60 + 30) — eligible at 60 OR 30

**Energy match:**
- Distance 0 (exact) = 1.0
- Distance 1 (adjacent) = 0.4
- Distance 2 (opposite) = 0.0

**Deadline:**
- Overdue or due today: 1.0
- Due this week: 0.6
- Due later or no deadline: 0.2

**Staleness:**
- Days since `created_at` OR `last_focused_at`, normalized to [0,1] with `min(days/14, 1)`

**Variety:**
- 1.0 if `project_id !== last_completed_project_id`
- 0.5 if same project as last completed but >24h ago
- 0.0 if same project as last completed within 24h
- Falls back to 1.0 when no last-completed data exists

**Closest-match fallback:**
If `tasks.filter(eligible).length === 0`, score the full task list (no eligibility filter), return top result with `matchedExactly: false`. The card shows mismatch note (see Reasoning section) and asks "Want to extend time or swap energy?"

## Reasoning

`src/lib/now-mode/reasoning.ts`:

Template library bucketed by `(energy × duration_bucket × urgency)`:

```ts
const DURATION_BUCKETS = ["short", "medium", "long"]; // ≤15 / 16-60 / 61+
const URGENCY_BUCKETS = ["overdue", "soon", "later"];

const TEMPLATES: Record<string, string[]> = {
  "high.short.soon": [
    "Sharp focus on {{task}}. Knock it out before the day shifts.",
    "{{task}} is due soon and you've got the energy — quick win.",
    "Easy money: {{task}}, 15 minutes, full attention.",
  ],
  "high.medium.soon": [
    "Sharp focus fits this — {{task}} needs your judgment, and 30 minutes is enough to make a real dent.",
    "{{task}} is the one to spend high energy on. Real progress in {{minutes}} min.",
  ],
  // ... ~36 buckets total, 3-5 phrases each
};

function pickReasoning(task: Task, score: ScoreResult, durationMin: number): string {
  const bucket = `${score.input.energy}.${durationBucket(durationMin)}.${urgencyBucket(task.due_date)}`;
  const phrases = TEMPLATES[bucket] || TEMPLATES._fallback;
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  return phrase.replace("{{task}}", task.title).replace("{{minutes}}", String(durationMin));
}
```

**Mismatch reasoning** (when `matchedExactly: false`):
> "Nothing fits {{durationMin}} min exactly. Closest match: **{{task}}** at {{actualMin}} min — {{reasoning}}. Want to extend time or swap energy?"

## Pomodoro mechanics

**Wall-clock based.** State stores `pomodoroStartedAt` (epoch ms) + `pomodoroDurationMs`. `tick()` runs every 250 ms via `setInterval` in the orchestrator. Remaining computed each tick from `now - startedAt - accruedPausedMs`. Survives refresh.

**Pause:** sets `pomodoroPausedAt = Date.now()`. Resume sets `accruedPausedMs += now - pausedAt; pausedAt = null`.

**Tab close / refresh:** wall clock keeps ticking. On reopen, store rehydrates from `localStorage`, recomputes remaining. If remaining ≤ 0, jump straight to `round-complete` step.

**Tab title:** orchestrator writes `document.title = "21:47 · {task.title}"` while working. Restores on stop.

**Mode toggle:** tap digits or pill → flips `timerMode`. Display swaps between countdown (`remaining`) and count-up (`elapsed = duration - remaining`). Persisted in store.

**"Need more time" (+5/+15/+25):** extends `pomodoroDurationMs` in place. Ring continues. No reset, no celebration. Felt continuity. Task stays current.

**"Done early":** jumps to `round-complete` step immediately with `actualElapsed` recorded.

**Tab throttle:** `setInterval` throttles to 1 Hz in background tabs, but render is wall-clock derived so this is cosmetic — accuracy preserved.

## Chunked tasks (always-on)

**DB migration** (`prisma/migrations/<timestamp>_add_task_chunks/`):

```prisma
model Task {
  // existing fields...
  chunkMin       Int      @default(15)        // min chunk minutes
  chunkMax       Int      @default(60)        // max chunk minutes
  chunks         TaskChunk[]
}

model TaskChunk {
  id              String   @id @default(cuid())
  task            Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  taskId          String
  chunkIndex      Int      // 1-based position in parent
  totalChunks     Int      // duplicated for query convenience; updated on re-chunk
  durationMin     Int      // 15..60
  status          String   @default("todo")  // todo | in_progress | completed | skipped
  scheduledStart  DateTime?
  scheduledEnd    DateTime?
  googleEventId   String?  // separate from parent's googleEventId; each chunk = its own GCal event
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([taskId, chunkIndex])
  @@index([taskId])
  @@index([scheduledStart])
}
```

**Chunk generation rule** (`src/lib/now-mode/chunks.ts`):

```ts
function generateChunks(timeEstimateMin: number, chunkMin = 15, chunkMax = 60): number[] {
  if (timeEstimateMin <= chunkMax) return [timeEstimateMin];

  const fullChunks = Math.floor(timeEstimateMin / chunkMax);
  const remainder = timeEstimateMin - fullChunks * chunkMax;
  if (remainder === 0) return Array(fullChunks).fill(chunkMax);
  if (remainder >= chunkMin) return [...Array(fullChunks).fill(chunkMax), remainder];

  // remainder < chunk_min — redistribute the last full chunk + remainder across two ≥ chunk_min
  const lastTwo = chunkMax + remainder;
  const a = Math.ceil(lastTwo / 2);
  const b = lastTwo - a;
  return [...Array(fullChunks - 1).fill(chunkMax), a, b];
}
```

Examples (defaults 15/60):
- 30 min → `[30]`
- 60 min → `[60]`
- 90 min → `[60, 30]`
- 120 min → `[60, 60]`
- 70 min → `[60, 10]` → redistributed → `[35, 35]`

**Chunk lifecycle:**
- Created on task save (and on `time_estimate` edit — re-chunk remaining time across remaining `todo` chunks)
- Each chunk scheduled by existing scheduler as an independent block; each gets its own GCal event with `extendedProperties.private.taskId = parent.id; extendedProperties.private.chunkId = chunk.id`
- Done = chunk row → `completed`, parent stays open until all chunks `completed`
- Calendar event colorId: gray while todo, sage green when completed (sync respects parent's `colorId` rules + per-chunk status)

**Round-complete screen on a chunk:**
- Big "Caught it. Chunk 2 of 4 done."
- Primary CTA: Done (just this chunk) — pre-loads next chunk OR next task per scorer
- Secondary inline CTA: **"I'm fully done with [parent title] — clear the rest"** → POST `/api/focus/complete-parent` → marks parent + all remaining chunks complete + deletes their GCal events. Frees calendar slots immediately.
- Tertiary: Need more time / Finish later / Break (same as standard round-complete)

## Finish later flow

`FinishLaterModal` shows:
1. Task title + time already spent + deadline (read-only context)
2. "Time still needed" pill row: 15 / 30 / 45 / 60 / 90+ / Custom
3. On pill select → live auto-schedule preview ("Tomorrow 10:30 AM · 45 min · high-energy window matches") — calls `/api/focus/finish-later/preview` which runs the existing scheduler's slot-search logic against an in-memory task copy and returns the picked slot without persisting. **Implementation note:** existing scheduler in `src/services/scheduling/` does not currently expose a preview path — we add one as a thin wrapper that calls `findBestSlot()` but skips the persistence step. Code lift is small (the scheduler already separates slot-finding from saving).
4. Primary: "Schedule it → pick something else now"
   - PUT `/api/focus/finish-later` with `{ taskId, remainingMin }`
   - Server: closes current chunk as `completed`, regenerates remaining chunks with `remainingMin`, runs scheduler, syncs to GCal
   - Returns next-step orchestrator state
5. Secondary: "Manual pick time" → drops to existing `TaskModal` with task pre-filled
6. Tertiary: "Cancel" → back to round-complete screen

Reuses existing scheduler logic in `src/services/scheduling/` — no new scheduler code. Just orchestrates a re-chunk + re-schedule.

## Sticky banner (off-page)

`src/components/focus/StickyPomodoroBanner.tsx`:
- Mounted via Portal in `src/app/(common)/layout.tsx`
- Renders conditionally: `step === "working" && pathname !== "/focus"`
- Full-width sienna gradient strip ABOVE app header (pushes content down ~46px)
- Layout: conic ring 44px → MM:SS + task title (truncated) → Pause / Stop buttons → 3px linear progress bar at strip base
- **No dismiss button.** Removing temptation. To exit, user must `/focus` → Stop or Done early.
- Tap anywhere on strip (except buttons) → `router.push("/focus")`

Reduce-motion: gradient becomes solid sienna, ring transitions become opacity fades.

## Classic FocusMode fallback

Per user direction. Add toggle:
- `src/store/settings.ts` — new field `focusModeView: "now" | "classic"` (default `"now"`)
- `src/app/(common)/focus/page.tsx` — read setting, render `<NowMode />` OR `<FocusMode />` (existing component)
- `FocusModeToggle.tsx` — small segmented control in `/focus` header, top-right
- Existing components (`FocusedTask`, `TaskQueue`, `QuickActions`, `FocusMode`) untouched

## Accessibility / reduce-motion

- All gradient backgrounds: respect `prefers-reduced-motion` via existing `useSettingsStore().motionEnabled` flag — gradients become solid sienna, transitions become 100ms opacity fades, confetti disabled.
- Ring SVG animation: respect `motionEnabled`. When off, ring still renders (it's a progress indicator, not animation) but updates discretely each second instead of smooth interpolation.
- Hero digits: large (64px) for low-vision support.
- All actions: keyboard-accessible. Tab order: timer mode toggle → Pause → Stop → Done early → After-this pill.
- Color contrast: sienna `#C2410C` on warm white `#FFF7ED` = 6.5:1 (AA pass).
- Screen reader: `aria-live="polite"` on remaining-time digits (announces every minute boundary, not every second).

## API endpoints

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/api/focus/recommend` | POST | `{ energy, durationMin }` | `{ task, chunk, reasoning, matchedExactly, alternatives: [taskId, ...] }` |
| `/api/focus/finish-later` | POST | `{ taskId, remainingMin }` | `{ scheduled: { start, end }, chunks: [...] }` |
| `/api/focus/finish-later/preview` | POST | `{ taskId, remainingMin }` | `{ start, end, reasoning }` (no DB write) |
| `/api/focus/complete-parent` | POST | `{ taskId }` | `{ closedChunks: [...] }` |
| `/api/focus/chunks/:id/complete` | POST | — | `{ chunk, parentClosed: boolean }` |

All authenticated via existing JWT middleware.

## Files (full list)

**New:**
- `src/store/nowMode.ts`
- `src/components/focus/NowMode.tsx`
- `src/components/focus/EnergyPicker.tsx`
- `src/components/focus/TimePicker.tsx`
- `src/components/focus/RecommendationCard.tsx`
- `src/components/focus/PomodoroHero.tsx`
- `src/components/focus/UpNextSheet.tsx`
- `src/components/focus/RoundComplete.tsx`
- `src/components/focus/FinishLaterModal.tsx`
- `src/components/focus/StickyPomodoroBanner.tsx`
- `src/components/focus/FocusModeToggle.tsx`
- `src/lib/now-mode/score.ts`
- `src/lib/now-mode/reasoning.ts`
- `src/lib/now-mode/chunks.ts`
- `src/app/api/focus/recommend/route.ts`
- `src/app/api/focus/finish-later/route.ts`
- `src/app/api/focus/finish-later/preview/route.ts`
- `src/app/api/focus/complete-parent/route.ts`
- `src/app/api/focus/chunks/[id]/complete/route.ts`
- `prisma/migrations/<ts>_add_task_chunks/migration.sql`

**Modified:**
- `src/app/(common)/focus/page.tsx` — branch on `focusModeView` setting
- `src/app/(common)/layout.tsx` — mount `StickyPomodoroBanner` via Portal
- `src/store/settings.ts` — add `focusModeView` field
- `src/services/scheduling/` — chunk-aware scheduling (each chunk = independent block)
- `src/services/google-task-sync.ts` — push chunks as separate GCal events; `extendedProperties.private.chunkId` for round-tripping
- `prisma/schema.prisma` — add `TaskChunk` model + chunkMin/chunkMax on Task

**Untouched:**
- All existing `src/components/focus/*` files (kept for Classic fallback)
- `docker-compose.yml`, deploy infra

## Verification

**Unit:**
- `score.ts` — weights sum to 1.0; eligibility includes/excludes correctly; closest-match fallback fires when no strict fit
- `chunks.ts` — generation respects `[chunk_min, chunk_max]`; redistributes when remainder < chunk_min; idempotent on re-chunk

**Integration (Jest, scoped to avoid OOM):**
- POST `/api/focus/recommend` returns valid shape; alternatives sorted by score; reasoning non-empty
- POST `/api/focus/complete-parent` closes parent + cascades to chunks + nulls their GCal eventIds

**Manual (Playwright MCP):**
- Cold-load `/focus` → tap energy → tap time → see recommendation → tap Start → Pomodoro running. Wall-clock stopwatch ≤ 5s end to end.
- While running, nav to `/calendar` → banner present at top, ring + bar update live. No dismiss button visible.
- Refresh `/focus` mid-round → returns directly to working state with correct remaining time.
- Tap digits → swap to count-up. Tap again → back to countdown. Persists after refresh.
- "Need more time +15" → ring extends, no celebration, task unchanged.
- "Finish later" with 45 min remaining → modal shows preview → confirm → check DB: task chunks regenerated, GCal events created, scheduler picked a slot.
- Chunk-done screen → "I'm fully done with parent" CTA → DB: parent.status=completed, remaining chunks.status=completed, GCal events deleted.
- Toggle Classic / Now → renders correct component.

**Type-check + lint + scoped Jest must be green before each commit.**

## Out of scope (deferred)

- Reasoning AI generation (Sprint 4+; templates only this sprint)
- Web Push notifications when Pomodoro hits zero (depends on PWA setup, separate sprint)
- Sprint Planning grid (vision 6.4)
- ClickUp integration (Sprint 3, separate spec)
- Multi-user shared Pomodoro
- Per-task chunk-min/chunk-max override (global defaults only this sprint; per-task override = Sprint 4)
- Calendar event color updates beyond gray/green (current GCal sync color logic unchanged)
- Phrase library localization

## Open questions for review

None blocking. User has approved: layout A (energy cards), pill row time picker, editorial centered recommendation, hero ring + collapsed "After this" pill, no-auto-flow round complete, wall-clock Pomodoro, extend-in-place +time, strict eligibility + chunks, closest-match with mismatch note, 15/60 chunk defaults, always-on chunks, mark-chunk-done with early-parent-complete escape.
