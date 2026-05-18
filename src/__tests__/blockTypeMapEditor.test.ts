/**
 * Scheduling-block follow-up #8: pure mutation helpers backing the
 * blockTypeMap settings editor. Logic lives here (testable without a DOM,
 * since the project's jest env is `node` with no RTL); the React component
 * is thin glue over these.
 */

import {
  addRule,
  removeRule,
  resetRules,
  updateRule,
} from "@/lib/blockTypeMapEditor";
import {
  DEFAULT_BLOCK_TYPE_MAP,
  parseBlockTypeMap,
  stringifyBlockTypeMap,
  type BlockTypeRule,
} from "@/services/scheduling/BlockCalendarService";

const SAMPLE: BlockTypeRule[] = [
  { emoji: "🧠", label: "Deep Work", eligibility: "high", daytimeOnly: true },
  { emoji: "🪶", label: "Light Work", eligibility: "low", daytimeOnly: true },
];

describe("blockTypeMapEditor helpers", () => {
  it("addRule appends one blank low/non-daytime rule without mutating input", () => {
    const next = addRule(SAMPLE);
    expect(SAMPLE).toHaveLength(2); // input untouched
    expect(next).toHaveLength(3);
    expect(next[2]).toEqual({
      emoji: "",
      label: "",
      eligibility: "low",
      daytimeOnly: false,
    });
  });

  it("updateRule patches only the target index immutably", () => {
    const next = updateRule(SAMPLE, 1, { label: "Admin", eligibility: "protected" });
    expect(SAMPLE[1].label).toBe("Light Work"); // input untouched
    expect(next[1]).toEqual({
      emoji: "🪶",
      label: "Admin",
      eligibility: "protected",
      daytimeOnly: true,
    });
    expect(next[0]).toBe(SAMPLE[0]); // untouched rows kept by reference
  });

  it("removeRule drops the target index immutably", () => {
    const next = removeRule(SAMPLE, 0);
    expect(SAMPLE).toHaveLength(2); // input untouched
    expect(next).toEqual([SAMPLE[1]]);
  });

  it("resetRules returns a fresh copy of DEFAULT_BLOCK_TYPE_MAP", () => {
    const next = resetRules();
    expect(next).toEqual(DEFAULT_BLOCK_TYPE_MAP);
    expect(next).not.toBe(DEFAULT_BLOCK_TYPE_MAP); // not the shared reference
    next.push({ emoji: "x", label: "x", eligibility: "low", daytimeOnly: false });
    expect(DEFAULT_BLOCK_TYPE_MAP).toHaveLength(8); // mutation didn't leak
  });

  it("round-trips through parse/stringify after edits", () => {
    const edited = addRule(
      updateRule(parseBlockTypeMap(stringifyBlockTypeMap(SAMPLE)), 0, {
        label: "Focus",
      })
    );
    const roundTripped = parseBlockTypeMap(stringifyBlockTypeMap(edited));
    expect(roundTripped).toEqual(edited);
    expect(roundTripped[0].label).toBe("Focus");
  });
});
