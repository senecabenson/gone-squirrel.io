"use client";

import { useEffect, useState } from "react";

import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";

import { useNowModeStore } from "@/store/nowMode";

const PILLS = [15, 30, 45, 60, 90];

export function FinishLaterModal({
  open,
  onClose,
  taskId,
  taskTitle,
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
}) {
  const reset = useNowModeStore((s) => s.reset);
  const [picked, setPicked] = useState<number | null>(null);
  const [customMin, setCustomMin] = useState(90);
  const [preview, setPreview] = useState<{ start: string; reasoning: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveMin = picked === 90 ? customMin : picked;

  useEffect(() => {
    if (!effectiveMin) { setPreview(null); return; }
    setPreview(null);
    fetch("/api/focus/finish-later/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, remainingMin: effectiveMin }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<{ start: string; end: string; reasoning: string }>;
      })
      .then((p) => setPreview({ start: p.start, reasoning: p.reasoning }))
      .catch(() => setPreview(null));
  }, [effectiveMin, taskId]);

  const handleSchedule = async () => {
    if (!effectiveMin) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/focus/finish-later", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, remainingMin: effectiveMin }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(`Scheduled. ${preview?.reasoning ?? ""}`);
      onClose();
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/55" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-canvas rounded-3xl p-8 max-w-md w-[92%] shadow-2xl">
          <p className="font-serif text-xs uppercase tracking-wider text-[hsl(var(--accent-acorn))] mb-1.5 font-medium">Finish later</p>
          <Dialog.Title className="font-serif text-2xl leading-tight text-ink font-medium mb-1.5">
            How much more does this need?
          </Dialog.Title>
          <p className="font-serif italic text-sm text-ink-soft mb-5">{taskTitle}</p>

          <p className="text-xs font-medium text-ink mb-2.5">Time still needed</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {PILLS.map((m) => (
              <button
                key={m}
                onClick={() => setPicked(m)}
                aria-pressed={picked === m}
                className={`rounded-full border px-4 py-2.5 text-sm font-medium ${
                  picked === m
                    ? "bg-action text-action-foreground border-action shadow-md shadow-action/25"
                    : "bg-canvas border-border-subtle"
                }`}
              >
                {m === 90 ? "90+" : m}
              </button>
            ))}
          </div>
          {picked === 90 && (
            <div className="flex items-center gap-2 mb-5">
              <input
                type="number"
                min={90}
                step={5}
                value={customMin}
                onChange={(e) =>
                  setCustomMin(Math.max(90, Number(e.target.value) || 90))
                }
                aria-label="Custom minutes"
                className="w-24 rounded-xl border border-border-subtle bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-action/40"
              />
              <span className="text-xs text-ink-soft">min</span>
            </div>
          )}
          {picked !== 90 && <div className="mb-5" />}

          {preview && (
            <div className="bg-[hsl(var(--surface-warm))] border border-border-subtle rounded-xl p-3.5 mb-5">
              <p className="font-serif text-xs text-[hsl(var(--accent-acorn))] mb-1 font-medium">Auto-schedule preview</p>
              <p className="text-sm text-ink-soft mb-1">Next open slot after your existing meetings</p>
              <p className="text-sm font-medium text-ink">
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(preview.start))}
                {" · "}
                {effectiveMin} min
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={!effectiveMin || submitting}
            onClick={handleSchedule}
            className="w-full bg-action text-action-foreground rounded-xl py-4 font-semibold shadow-md shadow-action/30 disabled:opacity-50"
          >
            Schedule it → pick something else
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-ink-mute italic text-xs py-2.5 mt-2"
          >
            Cancel
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
