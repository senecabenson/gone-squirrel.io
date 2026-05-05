"use client";

import { useEffect, useState } from "react";

import { PiMagnifyingGlassDuotone, PiXBold } from "react-icons/pi";

import { Button } from "@/components/ui/button";

export function CommandPaletteHint() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenHint = localStorage.getItem("hasSeenCommandPaletteHint");
    if (!hasSeenHint) {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissHint = () => {
    setIsVisible(false);
    localStorage.setItem("hasSeenCommandPaletteHint", "true");
  };

  const openCommandPalette = () => {
    dismissHint();
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  if (!isVisible) return null;

  return (
    <div
      role="status"
      className="fixed right-4 z-50 max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-300 bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] md:bottom-4"
    >
      <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-surface-raised p-4 shadow-raised">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-meta uppercase tracking-wide text-ink-mute">
            <PiMagnifyingGlassDuotone className="h-4 w-4" aria-hidden="true" />
            Quick tip
          </div>
          <button
            onClick={dismissHint}
            className="rounded-md p-0.5 text-ink-mute transition-colors hover:bg-surface-sunken hover:text-ink"
            aria-label="Dismiss hint"
          >
            <PiXBold className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <p className="mb-3 text-body-sm leading-relaxed text-ink">
          Press{" "}
          <kbd className="mx-0.5 rounded border border-[hsl(var(--border-subtle))] bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">
            ⌘K
          </kbd>{" "}
          to jump anywhere, anytime.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismissHint}>
            Later
          </Button>
          <Button size="sm" onClick={openCommandPalette}>
            Try it
          </Button>
        </div>
      </div>
    </div>
  );
}
