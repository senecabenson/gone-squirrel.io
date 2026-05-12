"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { useNowModeStore } from "@/store/nowMode";

interface Recommendation {
  task: { id: string; title: string; projectId: string | null };
  chunk: { id: string; index: number; total: number; durationMin: number };
  matchedExactly: boolean;
  reasoning: string;
}

export function RecommendationCard() {
  const energy = useNowModeStore((s) => s.energy);
  const durationMin = useNowModeStore((s) => s.durationMin);
  const setStep = useNowModeStore((s) => s.setStep);
  const startPomodoro = useNowModeStore((s) => s.startPomodoro);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!energy || !durationMin) return;
    const controller = new AbortController();
    setLoading(true);
    setRec(null);
    fetch("/api/focus/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ energy, durationMin }),
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.text()) || `${r.status}`);
        return r.json() as Promise<Recommendation>;
      })
      .then(setRec)
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        toast.error(e instanceof Error ? e.message : "Could not find a task");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [energy, durationMin]);

  const handleStart = () => {
    if (!rec) return;
    startPomodoro({
      taskId: rec.task.id,
      chunkId: rec.chunk.id,
      taskTitle: rec.task.title,
      chunkIndex: rec.chunk.index,
      totalChunks: rec.chunk.total,
      durationMs: rec.chunk.durationMin * 60 * 1000,
    });
  };

  if (loading) return <p className="text-center py-12 text-ink-soft">Picking something for you…</p>;
  if (!rec) return <p className="text-center py-12 text-ink-soft">Nothing fits. Try different settings?</p>;

  return (
    <div className="flex flex-col items-center px-6 py-10 md:py-14">
      <p className="font-serif text-[13px] uppercase tracking-[0.1em] text-[hsl(var(--accent-acorn))] mb-3">
        Step 3 / 3 · Here you go
      </p>
      <div className="bg-canvas rounded-3xl p-9 max-w-xl w-full shadow-xl shadow-action/10">
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {energy && (
            <span className="text-[11px] bg-[hsl(var(--accent-peach))] text-[hsl(var(--accent-acorn))] px-2.5 py-1 rounded-full font-medium">
              {energy} energy
            </span>
          )}
          <span className="text-[11px] bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium">
            {rec.chunk.durationMin} min
          </span>
          {rec.chunk.total > 1 && (
            <span className="text-[11px] bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full font-medium">
              Chunk {rec.chunk.index} of {rec.chunk.total}
            </span>
          )}
        </div>
        <h2 className="font-serif text-3xl leading-tight tracking-tight text-ink font-medium mb-3.5">
          {rec.task.title}
        </h2>
        <p className="font-serif italic text-[15px] leading-relaxed text-ink-soft mb-6 border-l-2 border-action pl-3.5">
          {rec.reasoning}
        </p>
        <button
          type="button"
          onClick={handleStart}
          className="w-full bg-action text-action-foreground rounded-xl py-4 font-semibold tracking-wide shadow-lg shadow-action/30"
        >
          Start Now →
        </button>
        <div className="flex gap-2 mt-2.5">
          <button
            type="button"
            onClick={() => setStep("pick-energy")}
            className="flex-1 border border-border-subtle text-[hsl(var(--accent-acorn))] rounded-lg py-2.5 text-sm"
          >
            Pick a different task
          </button>
          <button
            type="button"
            onClick={() => setStep("pick-time")}
            className="flex-1 border border-border-subtle text-[hsl(var(--accent-acorn))] rounded-lg py-2.5 text-sm"
          >
            Change time
          </button>
        </div>
      </div>
    </div>
  );
}
