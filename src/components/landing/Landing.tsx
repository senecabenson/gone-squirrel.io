import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Squirrel } from "@/components/brand/svg/Squirrel";
import { WordmarkTagline } from "@/components/brand/svg/WordmarkTagline";

export default function Landing() {
  return (
    <main
      aria-label="GoneSquirrel landing"
      className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center gap-6 overflow-hidden px-6 py-6 text-ink"
    >
      <Squirrel
        className="h-auto"
        style={{ width: "clamp(120px, 14vmin, 220px)" }}
      />
      <WordmarkTagline
        className="h-auto"
        style={{ width: "clamp(320px, 36vmin, 600px)" }}
      />

      <p
        className="mt-2 font-display leading-tight tracking-tight text-center max-w-2xl"
        style={{ fontSize: "clamp(1.5rem, 3vmin, 2.75rem)" }}
      >
        Calm-stimulation calendar + tasks for ADHD brains.
      </p>

      <p
        className="text-ink-soft text-center max-w-xl"
        style={{ fontSize: "clamp(0.95rem, 1.6vmin, 1.25rem)" }}
      >
        Auto-scheduled, energy-aware, no shame. Built for the way your brain
        actually works.
      </p>

      <Button
        asChild
        size="lg"
        className="mt-4 h-14 px-12 text-body !text-white shadow-[0_10px_28px_-8px_rgba(194,65,12,0.5)]"
      >
        <Link href="/auth/signin">Sign in to your nest</Link>
      </Button>
    </main>
  );
}
