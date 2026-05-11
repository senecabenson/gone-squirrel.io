"use client";

import { useNowModeStore } from "@/store/nowMode";

type Energy = "low" | "medium" | "high";

const OPTIONS: { value: Energy; label: string; icon: string; tagline: string }[] = [
  { value: "low",    label: "Low",    icon: "🪶", tagline: "Tired, scattered, just want something easy" },
  { value: "medium", label: "Medium", icon: "🌱", tagline: "Steady. Can focus on normal tasks." },
  { value: "high",   label: "High",   icon: "🔥", tagline: "Sharp, dialed. Hardest task gets your best." },
];

export function EnergyPicker() {
  const setEnergy = useNowModeStore((s) => s.setEnergy);
  const selected = useNowModeStore((s) => s.energy);

  return (
    <div className="flex flex-col items-center px-6 py-10 md:py-14">
      <div className="text-center mb-8">
        <p className="font-serif text-[13px] uppercase tracking-[0.1em] text-[hsl(var(--accent-acorn))] mb-2">
          Step 1 / 3
        </p>
        <h1 className="font-serif text-[32px] md:text-[40px] leading-tight tracking-tight text-ink font-medium">
          What energy do you have?
        </h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-3xl">
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEnergy(opt.value)}
              aria-pressed={isSelected}
              className={`rounded-2xl border p-6 text-center transition-all ${
                isSelected
                  ? "bg-action text-action-foreground border-action shadow-lg shadow-action/30 -translate-y-0.5"
                  : "bg-canvas border-border-subtle hover:border-action/40"
              }`}
            >
              <div className="text-3xl mb-2">{opt.icon}</div>
              <div className="font-serif text-lg font-medium mb-1">{opt.label}</div>
              <div className={`text-xs leading-snug ${isSelected ? "opacity-85" : "text-ink-soft"}`}>
                {opt.tagline}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
