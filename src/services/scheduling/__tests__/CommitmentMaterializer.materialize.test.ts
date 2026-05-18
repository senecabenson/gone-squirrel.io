// CommitmentMaterializer.materialize.test.ts
// Checkpoint 2 — materialize() + revoke() (TDD).
//
// Uses a small in-memory prisma fake so multi-run idempotency, in-run busy[]
// mutation, and conflict/no-eviction invariants can be asserted across calls.

// ---------------------------------------------------------------------------
// Local row-shape types — mirror only the fields this fake actually sets/reads
// ---------------------------------------------------------------------------

interface FakePersonalCommitment {
  id: string;
  userId: string;
  label: string;
  emoji: string;
  durationMin: number;
  rrule: string;
  preferredHour: number | null;
  timesPerWeek: number | null;
  active: boolean;
  lastMaterializedThrough: Date | null;
  createdAt: Date;
}

interface FakeCommitmentEvent {
  id: string;
  commitmentId: string;
  scheduledDate: Date;
  start: Date;
  end: Date;
  googleEventId: string | null;
  status: string;
}

interface FakeCalendarEvent {
  id: string;
  feedId: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  externalEventId: string | null;
  transparency: string;
}

interface FakeTask {
  id: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Prisma where-clause argument shapes used inside the fake
// ---------------------------------------------------------------------------

interface WherePersonalCommitment {
  userId?: string;
  active?: boolean;
  id?: string;
}

interface WhereCommitmentEvent {
  commitmentId?: string | { in?: string[] };
  status?: { in?: string[]; not?: string };
  scheduledDate?: { gte?: Date; lt?: Date };
  id?: string;
  commitmentId_scheduledDate?: { commitmentId: string; scheduledDate: Date };
}

interface WhereCalendarEvent {
  feedId?: string;
  externalEventId?: string;
  description?: { in?: string[] };
  AND?: Array<{ start?: { lt?: Date }; end?: { gt?: Date } }>;
}

interface WhereCalendarEventDeleteMany {
  feedId?: string;
  externalEventId?: string;
}

interface InMemoryStores {
  personalCommitment: Map<string, FakePersonalCommitment>;
  commitmentEvent: Map<string, FakeCommitmentEvent>;
  calendarEvent: Map<string, FakeCalendarEvent>;
  tasks: Map<string, FakeTask>;
}


jest.mock("@/lib/prisma", () => {
  // In-memory stores keyed by id.
  const personalCommitment = new Map<string, FakePersonalCommitment>();
  const commitmentEvent = new Map<string, FakeCommitmentEvent>();
  const calendarEvent = new Map<string, FakeCalendarEvent>();
  const tasks = new Map<string, FakeTask>();
  let seq = 0;
  const nextId = (p: string) => `${p}-${++seq}`;

  function overlapsWin(s: Date, e: Date, from: Date, to: Date) {
    return s.getTime() < to.getTime() && from.getTime() < e.getTime();
  }

  const db = {
    personalCommitment: {
      findMany: jest.fn(async ({ where }: { where: WherePersonalCommitment }) => {
        return [...personalCommitment.values()].filter(
          (c) =>
            (where?.userId === undefined || c.userId === where.userId) &&
            (where?.active === undefined || c.active === where.active)
        );
      }),
      findUnique: jest.fn(async ({ where }: { where: WherePersonalCommitment }) =>
        personalCommitment.get(where.id!) ?? null
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: WherePersonalCommitment;
          data: Partial<FakePersonalCommitment>;
        }) => {
          const row = personalCommitment.get(where.id!)!;
          Object.assign(row, data);
          return row;
        }
      ),
    },
    commitmentEvent: {
      findMany: jest.fn(async ({ where }: { where: WhereCommitmentEvent }) => {
        let rows = [...commitmentEvent.values()];
        if (
          where?.commitmentId &&
          typeof where.commitmentId === "object" &&
          where.commitmentId.in
        ) {
          rows = rows.filter((r) =>
            (where.commitmentId as { in: string[] }).in.includes(r.commitmentId)
          );
        }
        if (where?.commitmentId && typeof where.commitmentId === "string") {
          rows = rows.filter((r) => r.commitmentId === where.commitmentId);
        }
        if (where?.status && typeof where.status === "object" && where.status.in) {
          rows = rows.filter((r) => where.status!.in!.includes(r.status));
        }
        if (where?.status && typeof where.status === "object" && where.status.not) {
          rows = rows.filter((r) => r.status !== where.status!.not);
        }
        if (where?.scheduledDate?.gte && where?.scheduledDate?.lt) {
          rows = rows.filter(
            (r) =>
              r.scheduledDate.getTime() >=
                where.scheduledDate!.gte!.getTime() &&
              r.scheduledDate.getTime() < where.scheduledDate!.lt!.getTime()
          );
        }
        return rows.map((r) => ({ ...r }));
      }),
      findUnique: jest.fn(
        async ({ where }: { where: WhereCommitmentEvent }) => {
          if (where.commitmentId_scheduledDate) {
            const { commitmentId, scheduledDate } =
              where.commitmentId_scheduledDate;
            const found = [...commitmentEvent.values()].find(
              (r) =>
                r.commitmentId === commitmentId &&
                r.scheduledDate.getTime() === scheduledDate.getTime()
            );
            return found ? { ...found } : null;
          }
          return commitmentEvent.get(where.id!) ?? null;
        }
      ),
      upsert: jest.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: WhereCommitmentEvent;
          create: Partial<FakeCommitmentEvent>;
          update: Partial<FakeCommitmentEvent>;
        }) => {
          const { commitmentId, scheduledDate } =
            where.commitmentId_scheduledDate!;
          let row = [...commitmentEvent.values()].find(
            (r) =>
              r.commitmentId === commitmentId &&
              r.scheduledDate.getTime() === scheduledDate.getTime()
          );
          if (row) {
            Object.assign(row, update);
          } else {
            row = {
              id: nextId("ce"),
              commitmentId,
              scheduledDate,
              googleEventId: null,
              status: "planned",
              ...create,
            } as FakeCommitmentEvent;
            commitmentEvent.set(row.id, row);
          }
          return { ...row };
        }
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: WhereCommitmentEvent;
          data: Partial<FakeCommitmentEvent>;
        }) => {
          const row = commitmentEvent.get(where.id!)!;
          Object.assign(row, data);
          return { ...row };
        }
      ),
    },
    calendarEvent: {
      findMany: jest.fn(async ({ where }: { where: WhereCalendarEvent }) => {
        let rows = [...calendarEvent.values()];
        if (where?.feedId) rows = rows.filter((r) => r.feedId === where.feedId);
        if (where?.externalEventId)
          rows = rows.filter(
            (r) => r.externalEventId === where.externalEventId
          );
        if (where?.description?.in)
          rows = rows.filter(
            (r) =>
              r.description != null &&
              where.description!.in!.includes(r.description)
          );
        if (where?.AND) {
          const lt = where.AND.find((c) => c.start?.lt)?.start?.lt;
          const gt = where.AND.find((c) => c.end?.gt)?.end?.gt;
          if (lt && gt) {
            rows = rows.filter((r) => overlapsWin(r.start, r.end, gt, lt));
          }
        }
        return rows.map((r) => ({ ...r }));
      }),
      create: jest.fn(async ({ data }: { data: Partial<FakeCalendarEvent> }) => {
        const row = { id: nextId("cal"), ...data } as FakeCalendarEvent;
        calendarEvent.set(row.id, row);
        return { ...row };
      }),
      deleteMany: jest.fn(
        async ({ where }: { where: WhereCalendarEventDeleteMany }) => {
          let count = 0;
          for (const [k, r] of [...calendarEvent.entries()]) {
            if (
              (where.feedId === undefined || r.feedId === where.feedId) &&
              (where.externalEventId === undefined ||
                r.externalEventId === where.externalEventId)
            ) {
              calendarEvent.delete(k);
              count++;
            }
          }
          return { count };
        }
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = calendarEvent.get(where.id);
        calendarEvent.delete(where.id);
        return row ? { ...row } : null;
      }),
    },
    task: {
      findMany: jest.fn(async () => [...tasks.values()].map((t) => ({ ...t }))),
    },
    // $transaction patched below to avoid self-referential type cycle.
    $transaction: jest.fn() as jest.Mock,
    __stores: { personalCommitment, commitmentEvent, calendarEvent, tasks },
  };
  // Patch after declaration to avoid TypeScript TS7022 self-referential cycle.
  db.$transaction = jest.fn(
    async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)
  ) as jest.Mock;
  return { prisma: db };
});

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("@/services/google-task-sync", () => ({
  getCommitmentCalendarContext: jest.fn(),
  insertCommitmentGoogleEvent: jest.fn(),
  deleteCommitmentGoogleEvent: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  getCommitmentCalendarContext,
  insertCommitmentGoogleEvent,
  deleteCommitmentGoogleEvent,
} from "@/services/google-task-sync";
import {
  materialize,
  revoke,
  validateRrule,
} from "../CommitmentMaterializer";
import {
  matchBlockRule,
  DEFAULT_BLOCK_TYPE_MAP,
} from "../BlockCalendarService";

const stores = (prisma as unknown as { __stores: InMemoryStores }).__stores;

const mockCtx = getCommitmentCalendarContext as jest.Mock;
const mockInsert = insertCommitmentGoogleEvent as jest.Mock;
const mockDelete = deleteCommitmentGoogleEvent as jest.Mock;

const USER = "user-1";
// 2026-05-18 is a Monday → first TU=05-19, TH=05-21, 05-26, 05-28
const MONDAY = new Date("2026-05-18T00:00:00Z");

const fakeClient = { events: { insert: jest.fn(), delete: jest.fn() } };
const CTX = {
  client: fakeClient,
  googleCalendarId: "cal@group.calendar.google.com",
  feedId: "feed-1",
  timeZone: "UTC",
};

beforeEach(() => {
  jest.clearAllMocks();
  stores.personalCommitment.clear();
  stores.commitmentEvent.clear();
  stores.calendarEvent.clear();
  stores.tasks.clear();
  jest.useFakeTimers();
  jest.setSystemTime(MONDAY);
  let n = 0;
  mockInsert.mockImplementation(async () => `gevent-${++n}`);
  mockDelete.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

function seedCommitment(over: Partial<FakePersonalCommitment> = {}) {
  const id = over.id ?? "c1";
  const c: FakePersonalCommitment = {
    id,
    userId: USER,
    label: "Movement",
    emoji: "💪🏽",
    durationMin: 60,
    rrule: "FREQ=WEEKLY;BYDAY=TU,TH",
    preferredHour: 16,
    timesPerWeek: null,
    active: true,
    lastMaterializedThrough: null,
    createdAt: new Date("2026-05-04T00:00:00Z"),
    ...over,
  };
  stores.personalCommitment.set(id, c);
  return c;
}

describe("materialize", () => {
  it("(1) materializes weekly TU/TH occurrences over 14d", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment();

    const res = await materialize(USER, 14);

    expect(res.created).toBe(4);
    expect(res.materialized).toBe(4);
    expect(res.conflicts).toBe(0);
    expect(mockInsert).toHaveBeenCalledTimes(4);

    const ces = [...stores.commitmentEvent.values()];
    expect(ces).toHaveLength(4);
    expect(ces.every((e) => e.status === "materialized")).toBe(true);

    const cals = [...stores.calendarEvent.values()];
    expect(cals).toHaveLength(4);
    expect(cals.every((e) => e.feedId === CTX.feedId)).toBe(true);
    expect(cals.every((e) => e.title === "💪🏽 Movement")).toBe(true);
  });

  it("(2) is idempotent — 2nd run creates nothing & no extra GCal inserts", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment();

    const first = await materialize(USER, 14);
    expect(first.created).toBe(4);
    const insertsAfterFirst = mockInsert.mock.calls.length;

    const second = await materialize(USER, 14);

    expect(second.created).toBe(0);
    expect(mockInsert.mock.calls.length).toBe(insertsAfterFirst);
    expect([...stores.calendarEvent.values()]).toHaveLength(4);
    expect([...stores.commitmentEvent.values()]).toHaveLength(4);
  });

  it("(3) two commitments wanting same hour/day get non-overlapping slots", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment({ id: "cA", label: "Movement", emoji: "💪🏽" });
    seedCommitment({
      id: "cB",
      label: "Eat",
      emoji: "🍽️",
      durationMin: 60,
      preferredHour: 16,
    });

    await materialize(USER, 14);

    const byDay = new Map<string, FakeCommitmentEvent[]>();
    for (const e of stores.commitmentEvent.values()) {
      const k = e.scheduledDate.toISOString().slice(0, 10);
      (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e);
    }
    for (const [, evs] of byDay) {
      expect(evs.length).toBe(2);
      const [a, b] = evs.sort(
        (x, y) => x.start.getTime() - y.start.getTime()
      );
      const overlap =
        a.start.getTime() < b.end.getTime() &&
        b.start.getTime() < a.end.getTime();
      expect(overlap).toBe(false);
    }
  });

  it("(4) whole daytime busy → conflict, no GCal insert, no eviction", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment();
    // Seed busy CalendarEvents covering 06:00–19:00 on every occurrence day.
    for (const ymd of ["2026-05-19", "2026-05-21", "2026-05-26", "2026-05-28"]) {
      const preexisting: FakeCalendarEvent = {
        id: `pre-${ymd}`,
        feedId: CTX.feedId,
        title: "Blocker",
        start: new Date(`${ymd}T06:00:00Z`),
        end: new Date(`${ymd}T19:00:00Z`),
        externalEventId: `ext-${ymd}`,
        transparency: "opaque",
      };
      stores.calendarEvent.set(preexisting.id, preexisting);
    }
    const calCountBefore = stores.calendarEvent.size;

    const res = await materialize(USER, 14);

    expect(res.conflicts).toBe(4);
    expect(res.created).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
    // No eviction: the 4 pre-existing blockers are still present.
    expect(stores.calendarEvent.size).toBe(calCountBefore);
    const ces = [...stores.commitmentEvent.values()];
    expect(ces).toHaveLength(4);
    expect(ces.every((e) => e.status === "conflict")).toBe(true);
  });

  it("(5) null context → all-zero result, no throw, no writes", async () => {
    mockCtx.mockResolvedValue(null);
    seedCommitment();

    const res = await materialize(USER, 14);

    expect(res).toEqual({
      created: 0,
      materialized: 0,
      conflicts: 0,
      skipped: 0,
    });
    expect(stores.commitmentEvent.size).toBe(0);
    expect(stores.calendarEvent.size).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("(R3a) biweekly phase is anchored to createdAt, not the rolling 'today'", async () => {
    mockCtx.mockResolvedValue(CTX);
    // createdAt = Mon 2026-05-04 → INTERVAL=2 MO series: 05-04, 05-18,
    // 06-01, 06-15 …
    seedCommitment({
      rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
      preferredHour: 10,
      createdAt: new Date("2026-05-04T00:00:00Z"),
    });
    // Run on an OFF-phase Monday (05-25). Rolling dtstart=from would yield
    // {05-25, 06-08}; createdAt-anchored yields {06-01} only.
    jest.setSystemTime(new Date("2026-05-25T00:00:00Z"));

    await materialize(USER, 14);

    const days = [...stores.commitmentEvent.values()].map((e) =>
      e.scheduledDate.toISOString().slice(0, 10)
    );
    expect(days).toContain("2026-06-01");
    expect(days).not.toContain("2026-05-25");
    expect(days).not.toContain("2026-06-08");
  });

  it("(7) Phase A contract: materialized title classifies protected", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment(); // 💪🏽 Movement

    await materialize(USER, 14);

    const cal = [...stores.calendarEvent.values()][0];
    const rule = matchBlockRule(cal.title, DEFAULT_BLOCK_TYPE_MAP);
    expect(rule).not.toBeNull();
    expect(rule!.eligibility).toBe("protected");
  });
});

describe("revoke", () => {
  it("(6) deletes GCal + CalendarEvents, cancels CommitmentEvents, idempotent", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment();
    await materialize(USER, 14);

    const materializedCount = [...stores.commitmentEvent.values()].filter(
      (e) => e.status === "materialized"
    ).length;
    expect(materializedCount).toBe(4);

    await revoke("c1");

    expect(mockDelete).toHaveBeenCalledTimes(materializedCount);
    expect([...stores.calendarEvent.values()]).toHaveLength(0);
    expect(
      [...stores.commitmentEvent.values()].every(
        (e) => e.status === "cancelled"
      )
    ).toBe(true);

    const deletesAfterFirst = mockDelete.mock.calls.length;
    await expect(revoke("c1")).resolves.toBeUndefined();
    expect(mockDelete.mock.calls.length).toBe(deletesAfterFirst);
  });

  it("(UAT orphan) backstop: a mirror whose CommitmentEvent.googleEventId is null is STILL swept", async () => {
    // Real UAT residue: a commitment's mirror CalendarEvent survived DELETE
    // because revoke keyed only off CommitmentEvent.googleEventId. If a CE's
    // googleEventId is null (move-recovery window / partial materialize /
    // desync) but its tagged mirror (gsCommitment:<ceId>) still exists on the
    // feed, the old revoke orphaned it. The backstop sweep must catch it.
    mockCtx.mockResolvedValue(CTX);
    seedCommitment();
    await materialize(USER, 14);

    const mats = [...stores.commitmentEvent.values()].filter(
      (e) => e.status === "materialized"
    );
    expect(mats.length).toBeGreaterThan(0);

    // Simulate the desync: null out one CE's googleEventId while its mirror
    // (description = gsCommitment:<ceId>, externalEventId set) stays on feed.
    const desynced = mats[0];
    const orphanGid = desynced.googleEventId!;
    stores.commitmentEvent.get(desynced.id)!.googleEventId = null;
    const mirrorStillThere = [...stores.calendarEvent.values()].some(
      (c) => c.externalEventId === orphanGid
    );
    expect(mirrorStillThere).toBe(true); // precondition: mirror exists

    await revoke("c1");

    // No mirror left anywhere — including the desynced one.
    expect([...stores.calendarEvent.values()]).toHaveLength(0);
    // Its real GCal event was deleted via the backstop (by externalEventId).
    expect(
      mockDelete.mock.calls.some((c) => c[2] === orphanGid)
    ).toBe(true);
  });
});

describe("R3b — horizon clamp + validateRrule", () => {
  it("clamps an absurd horizonDays to <= 90 days", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment(); // weekly TU/TH

    await materialize(USER, 36500);

    const c = stores.personalCommitment.get("c1")!;
    const from = new Date(MONDAY);
    from.setUTCHours(0, 0, 0, 0);
    const maxTo = from.getTime() + 91 * 24 * 60 * 60 * 1000;
    expect(c.lastMaterializedThrough).toBeTruthy();
    expect(c.lastMaterializedThrough!.getTime()).toBeLessThanOrEqual(maxTo);
  });

  it("validateRrule: accepts DAILY/WEEKLY/MONTHLY, rejects the rest", () => {
    expect(validateRrule("FREQ=WEEKLY;BYDAY=MO,WE")).toBeNull();
    expect(validateRrule("FREQ=DAILY")).toBeNull();
    expect(validateRrule("FREQ=MONTHLY;BYMONTHDAY=1")).toBeNull();
    expect(validateRrule("FREQ=SECONDLY")).not.toBeNull();
    expect(validateRrule("FREQ=HOURLY")).not.toBeNull();
    expect(validateRrule("FREQ=WEEKLY;COUNT=99999")).not.toBeNull();
    expect(validateRrule("FREQ=WEEKLY;INTERVAL=99")).not.toBeNull();
    expect(validateRrule("not an rrule at all")).not.toBeNull();
  });
});
