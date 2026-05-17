"use client";

import { useCallback, useEffect, useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { parseBlockTypeMap } from "@/services/scheduling/BlockCalendarService";

import { useSettingsStore } from "@/store/settings";

import { SettingRow, SettingsSection } from "./SettingsSection";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommitmentEvent {
  id: string;
  scheduledDate: string;
  start: string;
  end: string;
  status: string;
}

interface PersonalCommitment {
  id: string;
  label: string;
  emoji: string;
  durationMin: number;
  rrule: string;
  preferredHour: number | null;
  timesPerWeek: number | null;
  active: boolean;
  createdAt: string;
  events: CommitmentEvent[];
}

interface MaterializeResult {
  created: number;
  materialized: number;
  conflicts: number;
  skipped: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS: Record<string, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

const ALL_WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
type Weekday = (typeof ALL_WEEKDAYS)[number];

function buildRrule(byday: Weekday[]): string {
  if (byday.length === 0) return "FREQ=WEEKLY";
  return `FREQ=WEEKLY;BYDAY=${byday.join(",")}`;
}

function parseRruleDays(rrule: string): Weekday[] {
  const match = /BYDAY=([A-Z,]+)/.exec(rrule);
  if (!match) return [];
  return match[1].split(",").filter((d): d is Weekday =>
    (ALL_WEEKDAYS as readonly string[]).includes(d)
  );
}

function humanRecurrence(rrule: string): string {
  if (!rrule) return rrule;
  const freqMatch = /FREQ=(\w+)/.exec(rrule);
  const freq = freqMatch ? freqMatch[1] : null;
  if (freq === "WEEKLY") {
    const days = parseRruleDays(rrule);
    if (days.length === 0) return "Weekly";
    return `Weekly: ${days.map((d) => WEEKDAY_LABELS[d] ?? d).join(", ")}`;
  }
  if (freq === "DAILY") return "Daily";
  // Fallback for unrecognised patterns
  return rrule;
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function summarizeMaterialize(r: MaterializeResult): string {
  return `Materialized ${r.materialized ?? r.created ?? 0}, ${r.conflicts} conflict${r.conflicts === 1 ? "" : "s"}, ${r.skipped} skipped`;
}

// ── Empty form state ──────────────────────────────────────────────────────────

interface CommitmentForm {
  label: string;
  durationMin: string;
  preferredHour: string;
  timesPerWeek: string;
  active: boolean;
  emoji: string;
  byday: Weekday[];
}

const EMPTY_FORM: CommitmentForm = {
  label: "",
  durationMin: "60",
  preferredHour: "",
  timesPerWeek: "",
  active: true,
  emoji: "",
  byday: [],
};

// ── Component ─────────────────────────────────────────────────────────────────

export function PersonalCommitments() {
  const { autoSchedule } = useSettingsStore();

  const [commitments, setCommitments] = useState<PersonalCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rematerializing, setRematerializing] = useState(false);

  // Edit state: null = no form open, string id = editing that commitment, "" = creating new
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CommitmentForm>(EMPTY_FORM);

  // Parse protected block rules from settings
  const allRules = parseBlockTypeMap(autoSchedule.blockTypeMap ?? "[]");
  const protectedRules = allRules.filter((r) => r.eligibility === "protected");
  const hasProtectedRules = protectedRules.length > 0;

  // ── Fetch list ──────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/commitments");
      if (!res.ok) throw new Error("Failed to load commitments");
      const data = (await res.json()) as { commitments: PersonalCommitment[] };
      setCommitments(data.commitments);
    } catch {
      toast.error("Failed to load commitments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Open add form ───────────────────────────────────────────────────────────

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId("");
  };

  // ── Open edit form ──────────────────────────────────────────────────────────

  const openEdit = (c: PersonalCommitment) => {
    setForm({
      label: c.label,
      durationMin: String(c.durationMin),
      preferredHour: c.preferredHour != null ? String(c.preferredHour) : "",
      timesPerWeek: c.timesPerWeek != null ? String(c.timesPerWeek) : "",
      active: c.active,
      emoji: c.emoji,
      byday: parseRruleDays(c.rrule),
    });
    setEditingId(c.id);
  };

  const closeForm = () => setEditingId(null);

  // ── Save (create or update) ─────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.label.trim()) {
      toast.error("Label is required");
      return;
    }
    if (!form.emoji) {
      toast.error("Please select a block type");
      return;
    }
    const durationMin = parseInt(form.durationMin, 10);
    if (isNaN(durationMin) || durationMin <= 0) {
      toast.error("Duration must be a positive number");
      return;
    }

    const body: Record<string, unknown> = {
      label: form.label.trim(),
      emoji: form.emoji,
      durationMin,
      rrule: buildRrule(form.byday),
      active: form.active,
    };
    if (form.preferredHour !== "") {
      const ph = parseInt(form.preferredHour, 10);
      if (!isNaN(ph)) body.preferredHour = ph;
    }
    if (form.timesPerWeek !== "") {
      const tw = parseInt(form.timesPerWeek, 10);
      if (!isNaN(tw)) body.timesPerWeek = tw;
    }

    setSaving(true);
    try {
      const isNew = editingId === "";
      const url = isNew ? "/api/commitments" : `/api/commitments/${editingId}`;
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        commitment?: PersonalCommitment;
        materialize?: MaterializeResult;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Save failed");
        return;
      }
      if (data.materialize) {
        toast.success(summarizeMaterialize(data.materialize));
      } else {
        toast.success(isNew ? "Commitment created" : "Commitment updated");
      }
      closeForm();
      await refresh();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/commitments/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        toast.error("Delete failed");
        return;
      }
      toast.success("Commitment removed");
      if (editingId === id) closeForm();
      await refresh();
    } catch {
      toast.error("Delete failed");
    }
  };

  // ── Re-materialize ──────────────────────────────────────────────────────────

  const handleRematerialize = async () => {
    setRematerializing(true);
    try {
      const res = await fetch("/api/commitments/materialize", { method: "POST" });
      const data = (await res.json()) as MaterializeResult & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Re-materialize failed");
        return;
      }
      toast.success(summarizeMaterialize(data));
      await refresh();
    } catch {
      toast.error("Re-materialize failed");
    } finally {
      setRematerializing(false);
    }
  };

  // ── Form field helpers ──────────────────────────────────────────────────────

  const toggleDay = (day: Weekday) => {
    setForm((prev) => ({
      ...prev,
      byday: prev.byday.includes(day)
        ? prev.byday.filter((d) => d !== day)
        : [...prev.byday, day],
    }));
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => ({
    value: String(i),
    label: i === 0
      ? "12:00 AM"
      : i < 12
        ? `${i}:00 AM`
        : i === 12
          ? "12:00 PM"
          : `${i - 12}:00 PM`,
  }));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SettingsSection
      title="Personal Commitments"
      description="Recurring personal blocks (family time, health, routines) that are automatically scheduled on your calendar."
    >
      {/* Re-materialize button */}
      <SettingRow
        label="Sync now"
        description="Force all active commitments to materialize into calendar events over the next 3 weeks."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleRematerialize()}
          disabled={rematerializing}
        >
          {rematerializing ? "Working…" : "Re-materialize now"}
        </Button>
      </SettingRow>

      {/* Commitment list */}
      <div className="flex flex-col gap-3">
        {loading && (
          <p className="text-body-sm text-ink-soft">Loading…</p>
        )}

        {!loading && commitments.length === 0 && editingId === null && (
          <p className="text-body-sm text-ink-soft">
            No commitments yet. Add one below to start scheduling recurring personal blocks.
          </p>
        )}

        {commitments.map((c) => {
          const isEditing = editingId === c.id;
          return (
            <div
              key={c.id}
              className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--border-subtle))] p-4"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{c.emoji}</span>
                    <span className="text-body-sm font-medium text-ink">
                      {c.label}
                    </span>
                    {!c.active && (
                      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-mute">
                        inactive
                      </span>
                    )}
                    {c.timesPerWeek != null && (
                      <span className="rounded-full bg-action/10 px-2 py-0.5 text-[11px] font-medium text-action">
                        {c.timesPerWeek}×/week
                      </span>
                    )}
                  </div>
                  <span className="text-body-sm text-ink-soft">
                    {humanRecurrence(c.rrule)} · {c.durationMin} min
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => (isEditing ? closeForm() : openEdit(c))}
                  >
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(c.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {/* Next occurrences */}
              {c.events.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {c.events.map((ev) => (
                    <span
                      key={ev.id}
                      className={
                        ev.status === "conflict"
                          ? "rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 dark:bg-red-950 dark:text-red-400"
                          : "rounded-md bg-surface-sunken px-2 py-1 text-[11px] text-ink-soft"
                      }
                    >
                      {ev.status === "conflict" && "Couldn't fit · "}
                      {formatEventDate(ev.start)}
                    </span>
                  ))}
                </div>
              )}

              {/* Inline edit form */}
              {isEditing && (
                <CommitmentFormFields
                  form={form}
                  setForm={setForm}
                  protectedRules={protectedRules}
                  timeOptions={timeOptions}
                  toggleDay={toggleDay}
                  onSave={() => void handleSave()}
                  onCancel={closeForm}
                  saving={saving}
                />
              )}
            </div>
          );
        })}

        {/* Add new form */}
        {editingId === "" && (
          <div className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--border-subtle))] p-4">
            <span className="text-body-sm font-medium text-ink">New commitment</span>
            {!hasProtectedRules ? (
              <p className="text-body-sm text-ink-soft">
                No protected block types configured. Go to{" "}
                <strong>Auto-schedule → Task Blocks</strong> and add at least one
                block with eligibility set to &quot;protected&quot; before creating commitments.
              </p>
            ) : (
              <CommitmentFormFields
                form={form}
                setForm={setForm}
                protectedRules={protectedRules}
                timeOptions={timeOptions}
                toggleDay={toggleDay}
                onSave={() => void handleSave()}
                onCancel={closeForm}
                saving={saving}
              />
            )}
          </div>
        )}
      </div>

      {/* Add button */}
      {editingId === null && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={openAdd}
            disabled={!hasProtectedRules}
          >
            Add commitment
          </Button>
          {!hasProtectedRules && (
            <p className="mt-2 text-body-sm text-ink-soft">
              Configure protected block types in{" "}
              <strong>Auto-schedule → Task Blocks</strong> first.
            </p>
          )}
        </div>
      )}
    </SettingsSection>
  );
}

// ── Shared form fields ────────────────────────────────────────────────────────

interface BlockTypeRuleDisplay {
  emoji: string;
  label: string;
  eligibility: string;
  daytimeOnly: boolean;
}

interface CommitmentFormFieldsProps {
  form: CommitmentForm;
  setForm: React.Dispatch<React.SetStateAction<CommitmentForm>>;
  protectedRules: BlockTypeRuleDisplay[];
  timeOptions: { value: string; label: string }[];
  toggleDay: (day: Weekday) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function CommitmentFormFields({
  form,
  setForm,
  protectedRules,
  timeOptions,
  toggleDay,
  onSave,
  onCancel,
  saving,
}: CommitmentFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Label */}
      <div className="flex flex-col gap-1.5">
        <Label>Label</Label>
        <Input
          value={form.label}
          onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
          placeholder="e.g. Morning routine"
        />
      </div>

      {/* Block type */}
      <div className="flex flex-col gap-1.5">
        <Label>Block type</Label>
        <Select
          value={form.emoji}
          onValueChange={(v) => setForm((p) => ({ ...p, emoji: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pick a protected block type" />
          </SelectTrigger>
          <SelectContent>
            {protectedRules.map((r) => (
              <SelectItem key={r.emoji} value={r.emoji}>
                {r.emoji} {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-1.5">
        <Label>Duration (minutes)</Label>
        <Input
          type="number"
          min={1}
          value={form.durationMin}
          onChange={(e) =>
            setForm((p) => ({ ...p, durationMin: e.target.value }))
          }
          placeholder="60"
        />
      </div>

      {/* Recurrence — weekday multiselect */}
      <div className="flex flex-col gap-1.5">
        <Label>Repeat on</Label>
        <div className="flex flex-wrap gap-2">
          {(["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as Weekday[]).map(
            (day) => {
              const active = form.byday.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={
                    active
                      ? "rounded-md bg-action px-2.5 py-1 text-body-sm font-medium text-white"
                      : "rounded-md bg-surface-sunken px-2.5 py-1 text-body-sm font-medium text-ink-soft hover:text-ink"
                  }
                >
                  {WEEKDAY_LABELS[day]}
                </button>
              );
            }
          )}
        </div>
        <span className="text-[11px] text-ink-mute">
          Leave empty to schedule any day of the week.
        </span>
      </div>

      {/* Preferred hour */}
      <div className="flex flex-col gap-1.5">
        <Label>Preferred start time (optional)</Label>
        <Select
          value={form.preferredHour !== "" ? form.preferredHour : "none"}
          onValueChange={(v) =>
            setForm((p) => ({ ...p, preferredHour: v === "none" ? "" : v }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Any time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Any time</SelectItem>
            {timeOptions.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Times per week */}
      <div className="flex flex-col gap-1.5">
        <Label>Times per week (optional)</Label>
        <Input
          type="number"
          min={1}
          value={form.timesPerWeek}
          onChange={(e) =>
            setForm((p) => ({ ...p, timesPerWeek: e.target.value }))
          }
          placeholder="e.g. 3"
        />
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <Switch
          checked={form.active}
          onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))}
        />
        <Label>Active</Label>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
