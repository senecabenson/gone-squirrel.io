"use client";

import { useEffect, useState } from "react";

interface Upcoming {
  taskId: string;
  taskTitle: string;
  chunkId: string;
  durationMin: number;
  energyLevel: string | null;
  projectId: string | null;
}

interface TaskWithChunks {
  id: string;
  title: string;
  energyLevel: string | null;
  projectId: string | null;
  chunks?: { id: string; durationMin: number }[];
}

export function UpNextSheet({ excludeChunkId }: { excludeChunkId: string | null }) {
  const [items, setItems] = useState<Upcoming[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/tasks?status=todo&limit=4")
      .then((r) => r.json())
      .then((data: { tasks?: TaskWithChunks[] } | TaskWithChunks[]) => {
        const tasks = Array.isArray(data) ? data : data.tasks ?? [];
        const next: Upcoming[] = [];
        for (const t of tasks) {
          const c = t.chunks?.[0];
          if (!c || c.id === excludeChunkId) continue;
          next.push({
            taskId: t.id,
            taskTitle: t.title,
            chunkId: c.id,
            durationMin: c.durationMin,
            energyLevel: t.energyLevel,
            projectId: t.projectId,
          });
          if (next.length === 3) break;
        }
        setItems(next);
      })
      .catch(() => setItems([]));
  }, [excludeChunkId]);

  if (items.length === 0) return null;

  const next = items[0];

  if (!expanded) {
    return (
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="bg-canvas border border-border-subtle rounded-full px-4 py-2 text-xs inline-flex items-center gap-2 shadow-md"
        >
          <span className="font-serif italic opacity-70">After this:</span>
          <span className="font-medium">{next.taskTitle}</span>
          <span className="opacity-50">▾</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-4 bottom-4 bg-canvas border border-border-subtle rounded-2xl p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <p className="font-serif text-xs uppercase tracking-wider text-[hsl(var(--accent-acorn))] font-medium">Up Next</p>
        <button onClick={() => setExpanded(false)} className="text-ink-mute text-sm">✕</button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={it.chunkId} className={`flex items-center gap-2.5 p-2.5 border rounded-lg ${i === 0 ? "border-action/40 bg-action/5" : "border-border-subtle opacity-75"}`}>
            <div className={`w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-semibold ${i === 0 ? "bg-action text-action-foreground" : "bg-border-subtle text-ink-soft"}`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium leading-tight">{it.taskTitle}</div>
              <div className="text-[11px] text-ink-soft mt-0.5">{it.durationMin} min · {it.energyLevel ?? "any"}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="font-serif italic text-xs text-ink-soft text-center mt-3">
        Tap &quot;Done&quot; to flow to #1.
      </p>
    </div>
  );
}
