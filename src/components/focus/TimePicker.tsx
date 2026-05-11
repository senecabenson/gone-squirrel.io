"use client";

import { useState } from "react";

import { useNowModeStore } from "@/store/nowMode";

const PILLS = [15, 30, 45, 60, 90];

export function TimePicker() {
  const setDuration = useNowModeStore((s) => s.setDuration);
  const selected = useNowModeStore((s) => s.durationMin);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState<number | "">("");

  return (
    <div className="flex flex-col items-center px-6 py-10 md:py-14">
      <div className="text-center mb-8">
        <p className="font-serif text-[13px] uppercase tracking-[0.1em] text-[hsl(var(--accent-acorn))] mb-2">
          Step 2 / 3
        </p>
        <h1 className="font-serif text-[32px] md:text-[40px] leading-tight tracking-tight text-ink font-medium">
          How long can you give it?
        </h1>
        <p className="text-sm text-ink-soft mt-2">Minutes you want to spend right now.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
        {PILLS.map((m) => {
          const isSelected = selected === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setDuration(m)}
              aria-pressed={isSelected}
              className={`rounded-full border px-5 py-3 font-medium transition-all ${
                isSelected
                  ? "bg-action text-action-foreground border-action shadow-md shadow-action/25"
                  : "bg-canvas border-border-subtle hover:border-action/40 text-ink"
              }`}
            >
              {m === 90 ? "90+" : m}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className="rounded-full border border-dashed border-action/60 text-[hsl(var(--accent-acorn))] px-5 py-3 font-medium"
        >
          Custom
        </button>
      </div>
      {customOpen && (
        <div className="mt-6 flex items-center gap-2">
          <input
            type="number"
            min={5}
            max={240}
            placeholder="Minutes"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value ? Number(e.target.value) : "")}
            className="w-32 rounded-md border border-border-subtle bg-canvas px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!customValue || customValue < 5}
            onClick={() => customValue && setDuration(customValue)}
            className="rounded-md bg-action text-action-foreground px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            Use
          </button>
        </div>
      )}
    </div>
  );
}
