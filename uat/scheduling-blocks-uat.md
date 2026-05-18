# UAT: Scheduling Blocks — Auto-Schedule Settings + BlockTypeMap Editor + Round-Trip Persistence

- **Feature / PR:** `feat/scheduling-blocks-followups` (HEAD `b24e04f`); commits #8 UI (`d69774f`), round-trip fix (`cca146c`)
- **Date scripted:** 2026-05-18
- **Base URL:** http://localhost:3000  (override: TEST_BASE_URL)
- **Run id:** <set at execution — 20260518-070851>

## Persona

Seneca, Monday morning, just shipped the scheduling-blocks followups and wants
to trust them before relying on auto-schedule all week. He opens Settings →
Auto-schedule on his laptop to define his day's block rules (🧠 Deep Work, 🪶
Light Work, 💪🏽 protected Movement), set the no-block + reflow policies, then
**reloads the page** because he was burned once by settings silently not
persisting (cca146c). He is skeptical and will reload often.

## Acceptance criteria

- Functional: every block-rule edit (emoji, label, eligibility, daytime, add,
  remove, reset) and every policy select (`taskBlocksFeedId`,
  `noEligibleBlockPolicy`, `skipReflowBlockType`) PATCHes `/api/auto-schedule-settings`
  and **survives a full page reload** (re-hydrated from DB, not lost).
- Visual: the BlockTypeMap editor renders one row per rule with visible
  emoji/label inputs, eligibility dropdown, "Daytime only" switch, "Remove"
  button; "Add block" / "Reset to defaults" buttons reachable.
- Definition of done: a user can fully define block rules + policies, reload,
  and see exactly what they saved — no silent drop, no console/network error.

## Preconditions & seed

- Auth: NextAuth HS256 JWT minted for `cmp1et2bg00002i8c5ts40o53`
  (senecacbenson@gmail.com), injected as `next-auth.session-token` cookie
  (pattern from `tests/e2e/commitments.spec.ts`).
- Data state: capture original `AutoScheduleSettings` row (blockTypeMap,
  taskBlocksFeedId, noEligibleBlockPolicy, skipReflowBlockType) for this user
  via tsx script before step 1.
- Cleanup obligations: restore the captured `AutoScheduleSettings` values in
  try/finally even if assertions fail. No GCal writes in this script.

## Happy path

| #  | Action | Expected functional result | Expected visual result | Pass criteria |
|----|--------|----------------------------|------------------------|---------------|
| 01 | `browser_navigate` `/settings#auto-schedule` | Auto-Schedule Settings section loads, settings hydrated from DB | "Auto-Schedule Settings" heading; "Block Types" SettingRow with ≥1 rule row visible | FAIL unless heading + ≥1 block row visible AND `GET /api/auto-schedule-settings` 200 AND console clean |
| 02 | Click "Add block" button | New rule row appended; PATCH `/api/auto-schedule-settings` fires with longer blockTypeMap | A new empty row (emoji + label inputs blank) appears below existing rows | FAIL unless new row visible AND PATCH 200 fired AND row count +1 |
| 03 | Type `🧪` into the new row's "Block N emoji" input, then click elsewhere (blur) | emoji persists on blur (PATCH full settings) | Input shows `🧪`, not cleared | FAIL unless value retained AND PATCH 200 on blur |
| 04 | Type `Lab Time` into that row's "Block N label" input, blur | label persists on blur | Input shows `Lab Time` | FAIL unless value retained AND PATCH 200 |
| 05 | Open that row's eligibility Select → choose "Protected (never scheduled)" | eligibility commits immediately (structural → PATCH) | Select trigger now shows "Protected (never scheduled)" | FAIL unless dropdown value changed AND PATCH 200 immediately |
| 06 | Toggle that row's "Daytime only" Switch on | daytimeOnly commits immediately | Switch visibly ON (checked state) | FAIL unless switch state flipped AND PATCH 200 |
| 07 | Set "When a day has no matching work block" → "Fall back to flat working hours" | `noEligibleBlockPolicy` PATCHed | Select shows "Fall back to flat working hours" | FAIL unless value changed AND PATCH 200 |
| 08 | Set "When an occurrence is skipped, reflow into" → "Deep Work blocks" | `skipReflowBlockType` PATCHed | Select shows "Deep Work blocks" | FAIL unless value changed AND PATCH 200 |
| 09 | **Reload** `/settings#auto-schedule` (the cca146c bug class) | Settings re-hydrated from DB | The `🧪 Lab Time` protected daytime row STILL present; policy selects STILL show fallback + Deep | FAIL (functional) unless every step 03–08 value present after reload — independent re-query of GET payload confirms |
| 10 | Click a row's "Remove block N" button | rule removed; PATCH with shorter blockTypeMap | That row disappears; row count −1 | FAIL unless row gone AND PATCH 200 AND count −1 |
| 11 | Reload again | DB reflects removal | Removed row does NOT reappear | FAIL unless removed row absent after reload |
| 12 | Click "Reset to defaults" | blockTypeMap reset to DEFAULT_BLOCK_TYPE_MAP; PATCH fired | Rows replaced with default set (includes 💪🏽 protected) | FAIL unless default rows render AND PATCH 200 AND reload-stable |

## Adversarial scenarios

| #  | Tactic | Action | Expected graceful behavior | Pass criteria |
|----|--------|--------|----------------------------|---------------|
| A1 | Empty label (input abuse) | Clear a row's label input entirely, blur | Saved as empty string without crash; reload shows empty label, not a corrupted map / 500 | FAIL on 500, JSON parse crash, or blockTypeMap corruption |
| A2 | Non-emoji / overflow emoji | Type `not-an-emoji-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` (60 chars) into an emoji input, blur | Stored as literal text, layout intact, no overflow break; no executed markup | FAIL on layout break, 500, or interpreted markup |
| A3 | Injection-ish | Type `<img src=x onerror=alert(1)>` into a label, blur, reload | Rendered as literal text in the input, never executed | FAIL if any alert/script executes or DOM-injects |
| A4 | Remove-all (empty state) | Remove every block rule one by one | Editor shows zero rows + "Add block"/"Reset" still reachable; no crash; Commitments tab "Add commitment" becomes disabled (no protected rule) — graceful, documented dependency | FAIL on crash/blank screen; FAIL if commitments form silently allows creation with no protected rule |
| A5 | Refresh mid-edit (nav) | Type into emoji input but do NOT blur; immediately reload | Unblurred keystroke is lost (expected — persists on blur), but NO partial/corrupt blockTypeMap saved; prior committed state intact | FAIL only if reload shows corrupted map or a half-written value persisted |
| A6 | Rapid re-click (timing) | Click "Add block" 5× within ~1s | Exactly 5 rows added (idempotent per click is N/A — each click = 1 row), final PATCH consistent with visible rows, reload matches | FAIL if row count ≠ clicks, or reload count diverges from screen |
| A7 | Mobile width (viewport) | `browser_resize` 390×844, re-walk steps 02–06 | Rows stack vertically (sm: flex-col), all inputs/controls reachable & visible, nothing clipped | FAIL if any control off-canvas/occluded at 390px |
| A8 | Narrow desktop (viewport) | `browser_resize` 1024×768, open eligibility Select | Dropdown opens fully visible, not clipped by viewport | FAIL if dropdown content clipped/unreachable |
| A9 | Silent persistence lie | After step 08, do NOT reload; instead independently `GET /api/auto-schedule-settings` via authed request | DB actually contains the new policy values (not just optimistic store) | FAIL if API payload ≠ on-screen state (optimistic-only lie) |

## Sign-off checklist

- [ ] Happy path — all steps PASS, signed off → screenshots purged
- [ ] Adversarial — all scenarios PASS, signed off → screenshots purged
- [ ] All FAILs either fixed & re-run green, or explicitly waived by user
- [ ] `AutoScheduleSettings` restored to captured original values
- [ ] `/uat/.screenshots/<run-id>/` deleted after full sign-off
