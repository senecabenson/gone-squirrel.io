"use client";

import { useSettingsStore } from "@/store/settings";

export function FocusModeToggle() {
  const view = useSettingsStore((s) => s.focusModeView);
  const setView = useSettingsStore((s) => s.setFocusModeView);

  return (
    <div className="inline-flex bg-canvas border border-border-subtle rounded-full p-0.5">
      <button
        onClick={() => setView("now")}
        aria-pressed={view === "now"}
        className={`px-3.5 py-1 text-xs font-medium rounded-full transition-all ${
          view === "now" ? "bg-action text-action-foreground" : "text-ink-soft"
        }`}
      >
        Now
      </button>
      <button
        onClick={() => setView("classic")}
        aria-pressed={view === "classic"}
        className={`px-3.5 py-1 text-xs font-medium rounded-full transition-all ${
          view === "classic" ? "bg-action text-action-foreground" : "text-ink-soft"
        }`}
      >
        Classic
      </button>
    </div>
  );
}
