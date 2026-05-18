"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import {
  addRule,
  removeRule,
  resetRules,
  updateRule,
} from "@/lib/blockTypeMapEditor";
import {
  parseBlockTypeMap,
  stringifyBlockTypeMap,
  type BlockEligibility,
  type BlockTypeRule,
} from "@/services/scheduling/BlockCalendarService";

interface BlockTypeMapEditorProps {
  /** JSON string (AutoScheduleSettings.blockTypeMap). */
  value: string;
  /** Persist a new JSON string (→ updateAutoScheduleSettings). */
  onChange: (json: string) => void;
}

const ELIGIBILITY_OPTIONS: { value: BlockEligibility; label: string }[] = [
  { value: "high", label: "High-energy work" },
  { value: "low", label: "Low-energy work" },
  { value: "protected", label: "Protected (never scheduled)" },
];

/**
 * Thin glue over the pure helpers in `@/lib/blockTypeMapEditor`. Structural
 * edits (add/remove/eligibility/daytime) persist immediately; free-text
 * fields (emoji/label) persist on blur to avoid a PATCH per keystroke.
 */
export function BlockTypeMapEditor({
  value,
  onChange,
}: BlockTypeMapEditorProps) {
  const [rules, setRules] = useState<BlockTypeRule[]>(() =>
    parseBlockTypeMap(value)
  );

  // Re-sync when the persisted value changes outside this component
  // (e.g. initial settings load round-trip).
  useEffect(() => {
    setRules(parseBlockTypeMap(value));
  }, [value]);

  const commit = (next: BlockTypeRule[]) => {
    setRules(next);
    onChange(stringifyBlockTypeMap(next));
  };

  return (
    <div className="space-y-3">
      {rules.map((rule, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-md border border-[hsl(var(--border-subtle))] p-3 sm:flex-row sm:items-center"
        >
          <Input
            aria-label={`Block ${index + 1} emoji`}
            className="w-full sm:w-16"
            value={rule.emoji}
            placeholder="🧠"
            onChange={(e) =>
              setRules(updateRule(rules, index, { emoji: e.target.value }))
            }
            onBlur={() => onChange(stringifyBlockTypeMap(rules))}
          />
          <Input
            aria-label={`Block ${index + 1} label`}
            className="w-full sm:flex-1"
            value={rule.label}
            placeholder="Deep Work"
            onChange={(e) =>
              setRules(updateRule(rules, index, { label: e.target.value }))
            }
            onBlur={() => onChange(stringifyBlockTypeMap(rules))}
          />
          <Select
            value={rule.eligibility}
            onValueChange={(v) =>
              commit(
                updateRule(rules, index, {
                  eligibility: v as BlockEligibility,
                })
              )
            }
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ELIGIBILITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="flex items-center gap-2 whitespace-nowrap text-sm">
            <Switch
              checked={rule.daytimeOnly}
              onCheckedChange={(checked) =>
                commit(updateRule(rules, index, { daytimeOnly: checked }))
              }
            />
            Daytime only
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove block ${index + 1}`}
            onClick={() => commit(removeRule(rules, index))}
          >
            Remove
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => commit(addRule(rules))}
        >
          Add block
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => commit(resetRules())}
        >
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
