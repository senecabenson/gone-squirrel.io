import { generateChunks, anyChunkFits } from "./chunks";

type EnergyLevel = "low" | "medium" | "high";

export interface ScoreTaskInput {
  id: string;
  title: string;
  energyLevel: EnergyLevel | null;
  timeEstimate: number;
  chunkMin: number;
  chunkMax: number;
  dueDate: Date | null;
  projectId: string | null;
  createdAt: Date;
  lastFocusedAt: Date | null;
  status: string;
}

export interface ScoreContext {
  tasks: ScoreTaskInput[];
  energy: EnergyLevel;
  durationMin: number;
  now: Date;
  userTimeZone: string;
  lastCompletedProjectId: string | null;
}

export interface ScoreResult {
  task: ScoreTaskInput;
  chunkIndex: number;
  chunkDurationMin: number;
  totalChunks: number;
  score: number;
  matchedExactly: boolean;
  components: {
    energy: number;
    deadline: number;
    staleness: number;
    variety: number;
  };
}

const WEIGHTS = { energy: 0.4, deadline: 0.3, staleness: 0.15, variety: 0.15 };
const ENERGY_ORDER: EnergyLevel[] = ["low", "medium", "high"];

function energyMatch(taskEnergy: EnergyLevel | null, chosen: EnergyLevel): number {
  if (!taskEnergy) return 0.5;
  const distance = Math.abs(ENERGY_ORDER.indexOf(taskEnergy) - ENERGY_ORDER.indexOf(chosen));
  if (distance === 0) return 1;
  if (distance === 1) return 0.4;
  return 0;
}

function deadlineScore(dueDate: Date | null, now: Date): number {
  if (!dueDate) return 0.2;
  const daysUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilDue <= 1) return 1;
  if (daysUntilDue <= 7) return 0.6;
  return 0.2;
}

function stalenessScore(createdAt: Date, lastFocusedAt: Date | null, now: Date): number {
  const reference = lastFocusedAt ?? createdAt;
  const days = (now.getTime() - reference.getTime()) / (1000 * 60 * 60 * 24);
  return Math.min(days / 14, 1);
}

function varietyScore(projectId: string | null, lastCompletedProjectId: string | null): number {
  if (!lastCompletedProjectId) return 1;
  if (projectId !== lastCompletedProjectId) return 1;
  return 0;
}

function chunksFor(task: ScoreTaskInput): number[] {
  return generateChunks(task.timeEstimate, task.chunkMin, task.chunkMax);
}

function pickChunk(chunks: number[], chosenMin: number): { index: number; duration: number; total: number } {
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i] <= chosenMin) return { index: i + 1, duration: chunks[i], total: chunks.length };
  }
  let smallestIdx = 0;
  for (let i = 1; i < chunks.length; i++) if (chunks[i] < chunks[smallestIdx]) smallestIdx = i;
  return { index: smallestIdx + 1, duration: chunks[smallestIdx], total: chunks.length };
}

function scoreOne(task: ScoreTaskInput, ctx: ScoreContext): Omit<ScoreResult, "matchedExactly"> {
  const components = {
    energy: energyMatch(task.energyLevel, ctx.energy),
    deadline: deadlineScore(task.dueDate, ctx.now),
    staleness: stalenessScore(task.createdAt, task.lastFocusedAt, ctx.now),
    variety: varietyScore(task.projectId, ctx.lastCompletedProjectId),
  };
  const score =
    components.energy * WEIGHTS.energy +
    components.deadline * WEIGHTS.deadline +
    components.staleness * WEIGHTS.staleness +
    components.variety * WEIGHTS.variety;
  const chunks = chunksFor(task);
  const chunk = pickChunk(chunks, ctx.durationMin);
  return { task, chunkIndex: chunk.index, chunkDurationMin: chunk.duration, totalChunks: chunk.total, score, components };
}

export function scoreTasks(ctx: ScoreContext): ScoreResult | null {
  if (ctx.tasks.length === 0) return null;
  const todoTasks = ctx.tasks.filter((t) => t.status === "todo");
  if (todoTasks.length === 0) return null;

  const eligible = todoTasks.filter((t) => anyChunkFits(chunksFor(t), ctx.durationMin));
  const matchedExactly = eligible.length > 0;
  const pool = matchedExactly ? eligible : todoTasks;

  const scored = pool.map((t) => scoreOne(t, ctx)).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  return { ...scored[0], matchedExactly };
}
