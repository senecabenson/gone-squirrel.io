"use client";

import { useEffect, useMemo } from "react";

import confetti from "canvas-confetti";
import { PiCheckBold, PiWarningBold } from "react-icons/pi";

import { logger } from "@/lib/logger";

import { useSettingsStore } from "@/store/settings";

export type ActionType = "loading" | "celebration" | "error";

interface ActionOverlayProps {
  type: ActionType;
  message?: string;
  onComplete?: () => void;
  autoHideDuration?: number;
}

// Friend-voice copy. Warm, never sycophantic, never moralizing.
// Rotates randomly so it doesn't feel scripted.
const CELEBRATION_LINES = [
  "Nice. That's one done.",
  "Yep — feeling that.",
  "Solid. Onward.",
  "Done. Take a breath.",
  "That's the one. Keep going.",
  "Off the list.",
  "Closed the loop.",
  "Look at you go.",
];

function pickLine() {
  return CELEBRATION_LINES[Math.floor(Math.random() * CELEBRATION_LINES.length)];
}

/**
 * Quiet-with-warmth completion overlay.
 * Gentle gold-and-sage burst, single shot — not a slot machine.
 * Honors the Settings toggle for motion (`motionEnabled=false` = no confetti).
 */
export function ActionOverlay({
  type,
  message,
  onComplete,
  autoHideDuration = 1400,
}: ActionOverlayProps) {
  const motionEnabled = useSettingsStore((s) => s.motionEnabled);
  const friendLine = useMemo(
    () => (type === "celebration" ? pickLine() : null),
    [type]
  );

  useEffect(() => {
    logger.debug("[ActionOverlay] Showing overlay", {
      type,
      message: message || null,
    });

    if (type === "celebration" && motionEnabled) {
      // Honor system reduce-motion preference too.
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!reduceMotion) {
        try {
          // Single burst, warm palette, modest particle count. No interval loop.
          // Reads as a friendly cheer, not Vegas.
          confetti({
            particleCount: 60,
            spread: 80,
            startVelocity: 30,
            ticks: 120,
            origin: { y: 0.55 },
            scalar: 0.85,
            gravity: 1.1,
            colors: [
              "#F4C95D", // reward-glow gold
              "#E8B547", // reward-shimmer
              "#7DAD8E", // streak-returned soft green
              "#A8C5A8", // state-complete
              "#E8945C", // streak-active warm orange
            ],
            disableForReducedMotion: true,
          });
        } catch (error) {
          logger.error("[ActionOverlay] Confetti error", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (autoHideDuration && onComplete) {
      const timer = setTimeout(() => onComplete(), autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [type, message, onComplete, autoHideDuration, motionEnabled]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-canvas/70 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      {type === "loading" && (
        <div className="mb-3 flex flex-col items-center gap-3">
          <span className="block h-3 w-3 rounded-full bg-action animate-pulse" />
        </div>
      )}

      {type === "celebration" && (
        <div className="mb-3 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--reward-glow-soft,49_85%_88%))] text-[hsl(var(--state-complete))] shadow-card">
            <PiCheckBold className="h-8 w-8" aria-hidden="true" />
          </span>
        </div>
      )}

      {type === "error" && (
        <div className="mb-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--urgency-soon)/0.18)] text-[hsl(var(--urgency-soon))]">
            <PiWarningBold className="h-7 w-7" aria-hidden="true" />
          </span>
        </div>
      )}

      <p className="max-w-xs px-4 text-center font-display text-display-sm leading-tight text-ink">
        {type === "celebration" ? friendLine : message}
      </p>
    </div>
  );
}
