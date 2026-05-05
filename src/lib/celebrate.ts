"use client";

import confetti from "canvas-confetti";
import { toast } from "sonner";

import { useSettingsStore } from "@/store/settings";

// Friend-voice copy for completions. Warm, never sycophantic, never moralizing.
const COMPLETION_LINES = [
  "Nice. That's one done.",
  "Yep — feeling that.",
  "Solid. Onward.",
  "Done. Take a breath.",
  "That's the one. Keep going.",
  "Off the list.",
  "Closed the loop.",
  "Look at you go.",
  "Quiet win. Stack it.",
  "Right on. Next.",
];

const WARM_PALETTE = [
  "#F4C95D", // reward-glow gold
  "#E8B547", // reward-shimmer
  "#7DAD8E", // streak-returned soft green
  "#A8C5A8", // state-complete
  "#E8945C", // streak-active warm orange
];

function shouldAnimate(): boolean {
  if (typeof window === "undefined") return false;
  const motionEnabled = useSettingsStore.getState().motionEnabled;
  if (!motionEnabled) return false;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  return !reduceMotion;
}

function pickLine() {
  return COMPLETION_LINES[Math.floor(Math.random() * COMPLETION_LINES.length)];
}

/**
 * Fire a calm-but-warm celebration when a task hits "done".
 * Honors Settings → Motion + system prefers-reduced-motion.
 *
 * - Toast: friend-voice one-liner, ~2s
 * - Confetti: single burst, warm palette, modest particle count (no Vegas)
 * - Position: optional — pass an event/element bbox to anchor the burst
 */
export function celebrateTaskCompletion(opts?: {
  origin?: { x: number; y: number };
  silent?: boolean; // skip toast (for places where toast would feel redundant)
}) {
  const line = pickLine();

  if (!opts?.silent) {
    toast(line, {
      duration: 2200,
      className: "notification-toast",
    });
  }

  if (!shouldAnimate()) return;

  try {
    confetti({
      particleCount: 50,
      spread: 75,
      startVelocity: 28,
      ticks: 110,
      origin: opts?.origin ?? { x: 0.5, y: 0.55 },
      scalar: 0.85,
      gravity: 1.1,
      colors: WARM_PALETTE,
      disableForReducedMotion: true,
    });
  } catch {
    // confetti is decorative — never throw on failure
  }
}

/**
 * Helper to compute a normalized origin from a mouse/pointer event,
 * so the burst can radiate from the click target on board/list completions.
 */
export function originFromEvent(e: { clientX: number; clientY: number }) {
  if (typeof window === "undefined") return { x: 0.5, y: 0.55 };
  return {
    x: Math.min(1, Math.max(0, e.clientX / window.innerWidth)),
    y: Math.min(1, Math.max(0, e.clientY / window.innerHeight)),
  };
}
