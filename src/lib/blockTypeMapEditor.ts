/**
 * Pure, DOM-free mutation helpers for the Auto-Schedule blockTypeMap editor.
 *
 * The editor UI ({@link BlockTypeMapEditor}) is intentionally thin glue over
 * these functions so the array logic is unit-testable in the project's
 * `node` jest environment (no React Testing Library available).
 *
 * All helpers are immutable: inputs are never mutated.
 */

import {
  DEFAULT_BLOCK_TYPE_MAP,
  type BlockTypeRule,
} from "@/services/scheduling/BlockCalendarService";

/** Append one blank rule (sensible non-protected, anytime default). */
export function addRule(rules: BlockTypeRule[]): BlockTypeRule[] {
  return [
    ...rules,
    { emoji: "", label: "", eligibility: "low", daytimeOnly: false },
  ];
}

/** Patch the rule at `index`, leaving other rows referentially unchanged. */
export function updateRule(
  rules: BlockTypeRule[],
  index: number,
  patch: Partial<BlockTypeRule>
): BlockTypeRule[] {
  return rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule));
}

/** Remove the rule at `index`. */
export function removeRule(
  rules: BlockTypeRule[],
  index: number
): BlockTypeRule[] {
  return rules.filter((_, i) => i !== index);
}

/** Fresh deep copy of the seeded defaults (never the shared reference). */
export function resetRules(): BlockTypeRule[] {
  return DEFAULT_BLOCK_TYPE_MAP.map((rule) => ({ ...rule }));
}

/**
 * Normalize the rule list for persistence.
 *
 * `parseBlockTypeMap("[]")` deliberately re-expands an empty/absent map to
 * {@link DEFAULT_BLOCK_TYPE_MAP} (a no-rules map would make the scheduler treat
 * the whole calendar as protected). That means persisting a bare `[]` is a
 * representation lie: the editor would render the 8 defaults while the DB holds
 * `[]`. Persisting the explicit defaults instead keeps storage == display with
 * the scheduler behaviour unchanged. Non-empty lists pass through untouched.
 */
export function rulesToPersist(rules: BlockTypeRule[]): BlockTypeRule[] {
  return rules.length === 0 ? resetRules() : rules;
}
