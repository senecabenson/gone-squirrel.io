import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  getCommitmentCalendarContext,
  insertCommitmentGoogleEvent,
  deleteCommitmentGoogleEvent,
} from "@/services/google-task-sync";

import { parseBlockTypeMap, matchBlockRule } from "./BlockCalendarService";
import { isoWeekBounds, makeupOccurrence } from "./CommitmentMaterializer";

const LOG_SOURCE = "CommitmentAdjuster";

/**
 * Thrown by `moveOccurrence` when the requested time collides with a protected
 * block, a scheduled task, or another commitment occurrence. Carries a stable
 * `code` so the API layer can map it to a 409 without string-matching.
 * NON-DESTRUCTIVE: thrown BEFORE any GCal/DB mutation — the occurrence is left
 * exactly where it was.
 */
export class CommitmentMoveConflictError extends Error {
  readonly code = "move_conflict" as const;
  constructor(message: string) {
    super(message);
    this.name = "CommitmentMoveConflictError";
  }
}

export interface SkipResult {
  skipped: true;
  reflow: "work" | "free";
  makeup:
    | { status: "materialized"; start: Date; end: Date }
    | { status: "conflict" };
}

export interface MoveResult {
  moved: true;
  start: Date;
  end: Date;
}

function utcMidnight(d: Date): Date {
  const m = new Date(d);
  m.setUTCHours(0, 0, 0, 0);
  return m;
}

function overlaps(
  aS: Date,
  aE: Date,
  bS: Date,
  bE: Date
): boolean {
  return aS.getTime() < bE.getTime() && bS.getTime() < aE.getTime();
}

/**
 * Skip ONE commitment occurrence:
 *  1. cancel it — delete its GCal protected event + mirror, mark cancelled.
 *  2. if `reflow:"work"` AND `skipReflowBlockType !== "free"`: drop a temporary
 *     work block (🪶 Light / 🧠 Deep, per setting) over the freed interval,
 *     tagged `gs:reflow:<id>` so it can be cleaned up and so Phase A treats it
 *     as schedulable (calendar is source of truth — no scheduler change).
 *  3. attempt exactly ONE makeup in the same ISO week (never re-made-up).
 * The caller re-runs `scheduleAllTasksForUser` — THAT is the reflow.
 * Never evicts anything but the skipped occurrence itself.
 */
export async function skipOccurrence(
  commitmentEventId: string,
  opts: { reflow: "work" | "free" }
): Promise<SkipResult> {
  const ev = await prisma.commitmentEvent.findUnique({
    where: { id: commitmentEventId },
  });
  if (!ev) throw new Error(`CommitmentEvent ${commitmentEventId} not found`);

  // Idempotency / terminal-state guard: a second skip (retry, double-tap)
  // must NOT re-delete GCal, write a second gs:reflow temp block, or run a
  // duplicate makeup. An already-cancelled occurrence is a no-op.
  if (ev.status === "cancelled") {
    return {
      skipped: true,
      reflow: opts.reflow,
      makeup: { status: "conflict" },
    };
  }

  const commitment = await prisma.personalCommitment.findUnique({
    where: { id: ev.commitmentId },
  });
  if (!commitment) {
    throw new Error(`PersonalCommitment ${ev.commitmentId} not found`);
  }

  const freed = { start: ev.start, end: ev.end };
  const ctx = await getCommitmentCalendarContext(commitment.userId);

  // (1) Cancel: GCal delete → mirror delete → status cancelled.
  if (ctx && ev.googleEventId) {
    await deleteCommitmentGoogleEvent(
      ctx.client,
      ctx.googleCalendarId,
      ev.googleEventId
    );
    await prisma.calendarEvent.deleteMany({
      where: { feedId: ctx.feedId, externalEventId: ev.googleEventId },
    });
  }
  await prisma.commitmentEvent.update({
    where: { id: ev.id },
    data: { status: "cancelled" },
  });

  // (2) Optional temporary work block over the freed interval.
  const settings = await prisma.autoScheduleSettings.findUnique({
    where: { userId: commitment.userId },
  });
  const reflowType = settings?.skipReflowBlockType ?? "light";
  const wantsTempBlock =
    opts.reflow === "work" && reflowType !== "free" && !!ctx;

  if (wantsTempBlock && ctx) {
    const rules = parseBlockTypeMap(settings?.blockTypeMap ?? "[]");
    const targetEligibility = reflowType === "deep" ? "high" : "low";
    const rule = rules.find((r) => r.eligibility === targetEligibility);
    if (!rule) {
      logger.warn(
        "No reflow block rule found; skipping temp block",
        { reflowType, targetEligibility },
        LOG_SOURCE
      );
    } else {
      const summary = `${rule.emoji} ${rule.label}`;
      const tag = `gs:reflow:${commitmentEventId}`;
      let tempEventId: string | null = null;
      try {
        tempEventId = await insertCommitmentGoogleEvent(
          ctx.client,
          ctx.googleCalendarId,
          {
            summary,
            start: {
              dateTime: freed.start.toISOString(),
              timeZone: ctx.timeZone,
            },
            end: { dateTime: freed.end.toISOString(), timeZone: ctx.timeZone },
            description: tag,
            tag,
          }
        );
      } catch (err) {
        logger.warn(
          "Reflow temp-block GCal insert threw; continuing",
          { commitmentEventId, error: String(err) },
          LOG_SOURCE
        );
      }
      if (tempEventId) {
        await prisma.calendarEvent.create({
          data: {
            feedId: ctx.feedId,
            title: summary,
            description: tag,
            start: freed.start,
            end: freed.end,
            externalEventId: tempEventId,
            transparency: "opaque",
          },
        });
      }
    }
  }

  // (3) Exactly one makeup attempt, same ISO week, never reusing the skipped
  // day. (makeupOccurrence itself never re-makes-up a makeup.)
  const week = isoWeekBounds(ev.start, ctx?.timeZone ?? "UTC");
  const makeup = await makeupOccurrence(
    commitment.id,
    week,
    utcMidnight(ev.scheduledDate)
  );

  return { skipped: true, reflow: opts.reflow, makeup };
}

/**
 * Move ONE commitment occurrence to `newStart` (duration preserved).
 * VALIDATE-FIRST: the conflict set (protected blocks, scheduled tasks, other
 * active commitment occurrences, same-day double-book) is checked BEFORE any
 * mutation. On conflict a `CommitmentMoveConflictError` is thrown and the
 * occurrence is untouched. Overlapping a low/high *eligible* block is allowed —
 * the commitment wins and displaced work reflows on the caller's recompute.
 */
export async function moveOccurrence(
  commitmentEventId: string,
  newStart: Date
): Promise<MoveResult> {
  const ev = await prisma.commitmentEvent.findUnique({
    where: { id: commitmentEventId },
  });
  if (!ev) throw new Error(`CommitmentEvent ${commitmentEventId} not found`);

  const commitment = await prisma.personalCommitment.findUnique({
    where: { id: ev.commitmentId },
  });
  if (!commitment) {
    throw new Error(`PersonalCommitment ${ev.commitmentId} not found`);
  }

  const newEnd = new Date(
    newStart.getTime() + commitment.durationMin * 60 * 1000
  );
  const ctx = await getCommitmentCalendarContext(commitment.userId);

  // ---- VALIDATION (no mutation) ----------------------------------------

  // a) Same-day double-book / @@unique([commitmentId,scheduledDate]) guard.
  const newKey = utcMidnight(newStart);
  const oldKey = utcMidnight(ev.scheduledDate);
  if (newKey.getTime() !== oldKey.getTime()) {
    const sameDay = await prisma.commitmentEvent.findMany({
      where: {
        commitmentId: commitment.id,
        scheduledDate: { gte: newKey, lt: new Date(newKey.getTime() + 86400000) },
        id: { not: ev.id },
      },
    });
    if (sameDay.length > 0) {
      throw new CommitmentMoveConflictError(
        "Another occurrence of this commitment already exists that day"
      );
    }
  }

  // b) Other active commitment occurrences (any commitment of this user).
  const userCommitments = await prisma.personalCommitment.findMany({
    where: { userId: commitment.userId, active: true },
  });
  const commitmentIds = userCommitments.map((c) => c.id);
  if (!commitmentIds.includes(commitment.id)) commitmentIds.push(commitment.id);
  const otherCEs = await prisma.commitmentEvent.findMany({
    where: {
      commitmentId: { in: commitmentIds },
      status: { in: ["planned", "materialized"] },
      id: { not: ev.id },
      AND: [{ start: { lt: newEnd } }, { end: { gt: newStart } }],
    },
  });
  if (otherCEs.length > 0) {
    throw new CommitmentMoveConflictError(
      "Overlaps another commitment occurrence"
    );
  }

  // c) Protected blocks on the Task Blocks feed (this occurrence's own mirror
  //    excluded). Unknown title → protected (fail-safe).
  if (ctx) {
    const rules = parseBlockTypeMap(
      (
        await prisma.autoScheduleSettings.findUnique({
          where: { userId: commitment.userId },
        })
      )?.blockTypeMap ?? "[]"
    );
    const feedEvents = await prisma.calendarEvent.findMany({
      where: {
        feedId: ctx.feedId,
        AND: [{ start: { lt: newEnd } }, { end: { gt: newStart } }],
      },
    });
    for (const fe of feedEvents) {
      if (ev.googleEventId && fe.externalEventId === ev.googleEventId) continue;
      const rule = matchBlockRule(fe.title, rules);
      const eligibility = rule ? rule.eligibility : "protected";
      if (eligibility === "protected") {
        throw new CommitmentMoveConflictError(
          `Overlaps a protected block ("${fe.title}")`
        );
      }
    }
  }

  // d) Scheduled work tasks.
  const tasks = await prisma.task.findMany({
    where: {
      userId: commitment.userId,
      scheduledStart: { not: null },
      scheduledEnd: { not: null },
      AND: [{ scheduledStart: { lt: newEnd } }, { scheduledEnd: { gt: newStart } }],
    },
  });
  for (const t of tasks) {
    if (
      t.scheduledStart &&
      t.scheduledEnd &&
      overlaps(newStart, newEnd, t.scheduledStart, t.scheduledEnd)
    ) {
      throw new CommitmentMoveConflictError("Overlaps a scheduled task");
    }
  }

  // ---- MUTATION (validation passed) ------------------------------------

  const oldEventId = ev.googleEventId;
  let newEventId: string | null = oldEventId;
  if (ctx) {
    if (oldEventId) {
      // Null googleEventId BEFORE the GCal delete. If the process dies
      // between delete and the post-insert tx, the row would otherwise keep
      // a stale googleEventId + status "materialized" and materialize's
      // idempotency guard (materialized && googleEventId) would skip it
      // forever. With googleEventId null, that guard lets a later
      // materialize re-place it — the occurrence is recoverable.
      await prisma.commitmentEvent.update({
        where: { id: ev.id },
        data: { googleEventId: null },
      });
      await deleteCommitmentGoogleEvent(
        ctx.client,
        ctx.googleCalendarId,
        oldEventId
      );
      await prisma.calendarEvent.deleteMany({
        where: { feedId: ctx.feedId, externalEventId: oldEventId },
      });
    }
    const summary = `${commitment.emoji} ${commitment.label}`;
    newEventId = await insertCommitmentGoogleEvent(
      ctx.client,
      ctx.googleCalendarId,
      {
        summary,
        start: { dateTime: newStart.toISOString(), timeZone: ctx.timeZone },
        end: { dateTime: newEnd.toISOString(), timeZone: ctx.timeZone },
        description: `gsCommitment:${ev.id}`,
        tag: `gsCommitment:${ev.id}`,
      }
    );
    await prisma.$transaction(async (tx) => {
      if (newEventId) {
        await tx.calendarEvent.create({
          data: {
            feedId: ctx.feedId,
            title: summary,
            description: `gsCommitment:${ev.id}`,
            start: newStart,
            end: newEnd,
            externalEventId: newEventId,
            transparency: "opaque",
          },
        });
      }
      await tx.commitmentEvent.update({
        where: { id: ev.id },
        data: {
          start: newStart,
          end: newEnd,
          scheduledDate: newKey,
          googleEventId: newEventId,
          status: "materialized",
        },
      });
    });
  } else {
    await prisma.commitmentEvent.update({
      where: { id: ev.id },
      data: { start: newStart, end: newEnd, scheduledDate: newKey },
    });
  }

  return { moved: true, start: newStart, end: newEnd };
}
