type EnergyLevel = "low" | "medium" | "high";
type DurationBucket = "short" | "medium" | "long";
type UrgencyBucket = "overdue" | "soon" | "later";

interface PickInput {
  taskTitle: string;
  energy: EnergyLevel;
  durationMin: number;
  dueDate: Date | null;
  now: Date;
}

function durationBucket(min: number): DurationBucket {
  if (min <= 15) return "short";
  if (min <= 60) return "medium";
  return "long";
}

function urgencyBucket(dueDate: Date | null, now: Date): UrgencyBucket {
  if (!dueDate) return "later";
  const days = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 1) return "overdue";
  if (days <= 7) return "soon";
  return "later";
}

const TEMPLATES: Record<string, string[]> = {
  "high.short.overdue": [
    "Quick + due — {{task}} only needs {{minutes}} min. Knock it out before it eats the day.",
    "Fast win: {{task}} clears your plate. {{minutes}} minutes, full attention.",
  ],
  "high.short.soon": [
    "Sharp focus, short window — {{task}} fits cleanly.",
    "Easy money: {{task}}, {{minutes}} minutes, full attention.",
  ],
  "high.short.later": [
    "Best energy on the smallest thing — {{task}} clears in {{minutes}} min.",
    "Quick win while you've got it sharp — {{task}}.",
  ],
  "high.medium.overdue": [
    "Real attention on something real — {{task}} needs the sharp version of you.",
    "{{task}} is overdue and you're dialed. Make a real dent in {{minutes}}.",
  ],
  "high.medium.soon": [
    "Sharp focus fits this — {{task}} needs your judgment, and {{minutes}} min is enough to make a real dent.",
    "{{task}} is the one to spend high energy on. Real progress in {{minutes}} min.",
    "Right brain for the right job — {{task}} in {{minutes}}.",
  ],
  "high.medium.later": [
    "Strike while sharp — {{task}}, {{minutes}} min of clean work.",
    "Get ahead while you've got it — {{task}}.",
  ],
  "high.long.overdue": [
    "Long deep work on {{task}}. You've got the energy and it can't wait.",
    "{{task}} needs the long version — {{minutes}} min, no half-measures.",
  ],
  "high.long.soon": [
    "{{minutes}} of deep work on {{task}}. This is what high energy is for.",
    "Deep dive into {{task}} while you're sharp.",
  ],
  "high.long.later": [
    "Bank the deep work now — {{task}}, {{minutes}} min, full focus.",
    "Long focused session on {{task}}.",
  ],
  "medium.short.overdue": [
    "Steady focus, small task — {{task}} just needs you present for {{minutes}}.",
    "Clear the small overdue thing — {{task}}.",
  ],
  "medium.short.soon": [
    "{{task}} fits — small, due-ish, doable.",
    "Quick admin you can knock out in {{minutes}} min.",
  ],
  "medium.short.later": [
    "Easy win — {{task}} clears in {{minutes}} min.",
    "Keep the momentum — {{task}}, short and done.",
  ],
  "medium.medium.overdue": [
    "{{task}} is due and your energy fits. {{minutes}} min, steady pace.",
    "Solid window for {{task}} — work through it.",
  ],
  "medium.medium.soon": [
    "Steady work on {{task}} — {{minutes}} min should move it forward.",
    "{{task}} fits your steady energy and the deadline.",
  ],
  "medium.medium.later": [
    "Good window for {{task}} — make {{minutes}} count.",
    "Pace yourself through {{task}}.",
  ],
  "medium.long.overdue": [
    "Long pull on {{task}} — overdue but steady energy will get you there.",
    "{{task}} is overdue. {{minutes}} min of grounded work.",
  ],
  "medium.long.soon": [
    "Steady stretch on {{task}} — {{minutes}} min of patient work.",
    "{{task}} needs the long calm version.",
  ],
  "medium.long.later": [
    "Get ahead on {{task}} — {{minutes}} min of grounded focus.",
    "Slow burn through {{task}}.",
  ],
  "low.short.overdue": [
    "Easy and overdue — {{task}}, {{minutes}} min, low bar.",
    "Just get {{task}} off the plate.",
  ],
  "low.short.soon": [
    "{{task}} is the easy one — {{minutes}} min, low effort.",
    "Soft start — {{task}} fits.",
  ],
  "low.short.later": [
    "Tiny win — {{task}}, {{minutes}} min, no pressure.",
    "Coast into {{task}}.",
  ],
  "low.medium.overdue": [
    "{{task}} is overdue but doesn't need sharp focus. {{minutes}} min, easy mode.",
    "Light pass through {{task}}.",
  ],
  "low.medium.soon": [
    "Light lift on {{task}} — {{minutes}} min, no overthinking.",
    "Easy progress on {{task}}.",
  ],
  "low.medium.later": [
    "Soft session — {{task}}, {{minutes}} min, gentle pace.",
    "Take {{task}} slow.",
  ],
  "low.long.overdue": [
    "Long but easy — {{task}}, {{minutes}} min, low intensity.",
    "Just present through {{task}}.",
  ],
  "low.long.soon": [
    "Low energy long session — patient pace on {{task}}.",
    "Move {{task}} forward without forcing.",
  ],
  "low.long.later": [
    "Coast through {{task}} — {{minutes}} min, easy mode.",
    "Soft long work on {{task}}.",
  ],
};

const FALLBACK_PHRASES = [
  "{{task}} is the move — {{minutes}} min of focused work.",
  "Start with {{task}}. {{minutes}} minutes, see where you get.",
];

export function pickReasoning(input: PickInput): string {
  const bucket = `${input.energy}.${durationBucket(input.durationMin)}.${urgencyBucket(input.dueDate, input.now)}`;
  const phrases = TEMPLATES[bucket] ?? FALLBACK_PHRASES;
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  return phrase
    .replace(/\{\{task\}\}/g, input.taskTitle)
    .replace(/\{\{minutes\}\}/g, String(input.durationMin));
}

export function pickMismatchReasoning(input: { taskTitle: string; requestedMin: number; actualMin: number }): string {
  return `Nothing fits ${input.requestedMin} min exactly. Closest match: ${input.taskTitle} at ${input.actualMin} min. Want to extend your time or swap energy?`;
}
