import { CalendarEvent } from "@prisma/client";

import { toZonedTime } from "@/lib/date-utils";

import { CalendarService } from "./CalendarService";

/**
 * A "Task Blocks" calendar event classifies a slice of the day. Work tasks may
 * only land inside blocks whose eligibility matches the task's energy level;
 * every other block is hard-protected (family/health time). This is the HARD
 * availability layer — distinct from the SOFT energy-window scoring in
 * SlotScorer, which still operates within the windows this service returns.
 */
export type BlockEligibility = "high" | "low" | "protected";

export interface BlockTypeRule {
  emoji: string;
  label: string;
  eligibility: BlockEligibility;
  /** Eligible only before the evening cutoff hour (work blocks). */
  daytimeOnly: boolean;
}

export interface DayBlock {
  start: Date;
  end: Date;
  eligibility: BlockEligibility;
  /** null = title matched no rule (treated as protected, fail-safe). */
  rule: BlockTypeRule | null;
  rawTitle: string;
}

/**
 * Seeded from Seneca's real Task Blocks calendar. Only 🧠/🪶 are work-eligible
 * and daytime-only; everything else is protected so work can never invade
 * family/health time.
 */
export const DEFAULT_BLOCK_TYPE_MAP: BlockTypeRule[] = [
  { emoji: "🧠", label: "Deep Work", eligibility: "high", daytimeOnly: true },
  { emoji: "🪶", label: "Light Work", eligibility: "low", daytimeOnly: true },
  { emoji: "☀️", label: "Morning", eligibility: "protected", daytimeOnly: false },
  { emoji: "👶🏽", label: "Daddy Duty", eligibility: "protected", daytimeOnly: false },
  { emoji: "💪🏽", label: "Movement", eligibility: "protected", daytimeOnly: false },
  { emoji: "🍽️", label: "Eat", eligibility: "protected", daytimeOnly: false },
  { emoji: "🧑‍🧑‍🧒", label: "Familia", eligibility: "protected", daytimeOnly: false },
  { emoji: "💖", label: "Wife", eligibility: "protected", daytimeOnly: false },
];

/** Blocks starting at/after this local hour never receive work (evening 🪶). */
export const EVENING_CUTOFF_HOUR = 19;

export function parseBlockTypeMap(json: string): BlockTypeRule[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as BlockTypeRule[];
    }
    return DEFAULT_BLOCK_TYPE_MAP;
  } catch {
    return DEFAULT_BLOCK_TYPE_MAP;
  }
}

export function stringifyBlockTypeMap(rules: BlockTypeRule[]): string {
  return JSON.stringify(rules);
}

// Variation selectors (U+FE0F), skin-tone modifiers (U+1F3FB–U+1F3FF) and
// ZWJ (U+200D) glue render-identical emoji that differ byte-wise. Strip them
// from both sides so "💪🏽" matches a "💪" rule and "☀️"/"☀" unify.
const EMOJI_NOISE = /[️‍\u{1F3FB}-\u{1F3FF}]/gu;

function normalizeEmoji(s: string): string {
  return s.normalize("NFC").replace(EMOJI_NOISE, "");
}

export function matchBlockRule(
  summary: string,
  rules: BlockTypeRule[]
): BlockTypeRule | null {
  const cleanSummary = normalizeEmoji(summary).trimStart();
  for (const rule of rules) {
    if (cleanSummary.startsWith(normalizeEmoji(rule.emoji))) {
      return rule;
    }
  }
  const lower = summary.toLowerCase();
  for (const rule of rules) {
    if (lower.includes(rule.label.toLowerCase())) {
      return rule;
    }
  }
  return null;
}

/** high task → "high" blocks; medium/low/null → "low"; never Deep for low. */
function targetEligibilityForEnergy(
  energyLevel: string | null
): Exclude<BlockEligibility, "protected"> {
  return energyLevel === "high" ? "high" : "low";
}

export function eligibleWindowsForEnergy(
  blocks: DayBlock[],
  taskEnergyLevel: string | null
): { start: Date; end: Date }[] {
  const target = targetEligibilityForEnergy(taskEnergyLevel);
  return blocks
    .filter((b) => b.eligibility === target)
    .map((b) => ({ start: b.start, end: b.end }));
}

interface Interval {
  start: Date;
  end: Date;
}

function contains(outer: Interval, inner: Interval): boolean {
  return (
    outer.start.getTime() <= inner.start.getTime() &&
    outer.end.getTime() >= inner.end.getTime()
  );
}

function overlaps(a: Interval, b: Interval): boolean {
  return (
    a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
  );
}

/**
 * HARD availability filter. A slot survives iff it is FULLY CONTAINED in an
 * energy-matched eligible block (never spilling across a block boundary) AND
 * does not overlap any protected block. Energy windows / SlotScorer still
 * score the survivors — this only decides WHERE work may land, not which
 * surviving slot is best.
 */
export function selectSlotsInEligibleBlocks<T extends Interval>(
  slots: T[],
  blocks: DayBlock[],
  taskEnergyLevel: string | null
): T[] {
  const eligible = eligibleWindowsForEnergy(blocks, taskEnergyLevel);
  if (eligible.length === 0) return [];
  const protectedBlocks = blocks.filter((b) => b.eligibility === "protected");
  return slots.filter(
    (slot) =>
      eligible.some((w) => contains(w, slot)) &&
      !protectedBlocks.some((p) => overlaps(slot, p))
  );
}

export type NoEligibleBlockPolicy =
  | "schedule_nothing"
  | "fallback_work_hours";

/**
 * Per-day application of the block filter. `schedule_nothing` (default) is
 * exactly selectSlotsInEligibleBlocks. `fallback_work_hours` is an opt-in
 * escape hatch: on a day with NO energy-matched eligible block, keep the
 * already work-hour-filtered slots — but still never over a protected block.
 * `dayKey` is injected so the timezone authority stays in TimeSlotManager.
 */
export function selectSlotsWithPolicy<T extends Interval>(
  slots: T[],
  blocks: DayBlock[],
  taskEnergyLevel: string | null,
  policy: NoEligibleBlockPolicy,
  dayKey: (d: Date) => string
): T[] {
  if (policy === "schedule_nothing") {
    return selectSlotsInEligibleBlocks(slots, blocks, taskEnergyLevel);
  }
  const eligible = eligibleWindowsForEnergy(blocks, taskEnergyLevel);
  const protectedBlocks = blocks.filter((b) => b.eligibility === "protected");
  const eligibleDays = new Set(eligible.map((w) => dayKey(w.start)));
  return slots.filter((slot) => {
    if (protectedBlocks.some((p) => overlaps(slot, p))) return false;
    if (eligibleDays.has(dayKey(slot.start))) {
      return eligible.some((w) => contains(w, slot));
    }
    return true; // no eligible block this day → fall back to work hours
  });
}

export class BlockCalendarService {
  constructor(private calendarService: CalendarService) {}

  /**
   * Reads block events for the Task Blocks feed in [start,end] and classifies
   * each by title. All-day events are ignored. Unrecognized titles become
   * protected (fail-safe: an unknown block must never receive work). A
   * daytime-only work block starting at/after the evening cutoff is demoted to
   * protected so evening 🪶 stays family time.
   */
  async getBlocks(
    start: Date,
    end: Date,
    feedId: string,
    rules: BlockTypeRule[],
    timeZone: string,
    eveningCutoffHour: number,
    userId: string
  ): Promise<DayBlock[]> {
    const events: CalendarEvent[] = await this.calendarService.getEvents(
      start,
      end,
      [feedId],
      userId
    );
    const blocks: DayBlock[] = [];
    for (const ev of events) {
      if (ev.allDay) continue;
      const rule = matchBlockRule(ev.title, rules);
      let eligibility: BlockEligibility = rule ? rule.eligibility : "protected";
      if (
        rule &&
        rule.daytimeOnly &&
        rule.eligibility !== "protected" &&
        toZonedTime(ev.start, timeZone).getHours() >= eveningCutoffHour
      ) {
        eligibility = "protected";
      }
      blocks.push({
        start: ev.start,
        end: ev.end,
        eligibility,
        rule,
        rawTitle: ev.title,
      });
    }
    return blocks;
  }
}
