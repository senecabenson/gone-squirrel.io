// CommitmentMaterializer.makeup.test.ts
// Phase C / CP1 — makeupOccurrence() + isoWeekBounds() (TDD).
//
// Reuses the in-memory prisma fake pattern from
// CommitmentMaterializer.materialize.test.ts so makeup placement, the
// no-slot conflict path (never evicts), the "skip a day already holding an
// active CommitmentEvent" guard, and DST-correct ISO-week bounds can all be
// asserted against real reused materializer internals.

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
  start: Date;
  end: Date;
  externalEventId: string | null;
  transparency: string;
}

interface FakeTask {
  id: string;
  [key: string]: unknown;
}

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
      findMany: jest.fn(
        async ({ where }: { where: WherePersonalCommitment }) =>
          [...personalCommitment.values()].filter(
            (c) =>
              (where?.userId === undefined || c.userId === where.userId) &&
              (where?.active === undefined || c.active === where.active)
          )
      ),
      findUnique: jest.fn(
        async ({ where }: { where: WherePersonalCommitment }) =>
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
            (where.commitmentId as { in: string[] }).in.includes(
              r.commitmentId
            )
          );
        }
        if (where?.commitmentId && typeof where.commitmentId === "string") {
          rows = rows.filter((r) => r.commitmentId === where.commitmentId);
        }
        if (
          where?.status &&
          typeof where.status === "object" &&
          where.status.in
        ) {
          rows = rows.filter((r) => where.status!.in!.includes(r.status));
        }
        if (
          where?.status &&
          typeof where.status === "object" &&
          where.status.not
        ) {
          rows = rows.filter((r) => r.status !== where.status!.not);
        }
        if (typeof (where?.status as unknown) === "string") {
          const want = where.status as unknown as string;
          rows = rows.filter((r) => r.status === want);
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
        if (where?.AND) {
          const lt = where.AND.find((c) => c.start?.lt)?.start?.lt;
          const gt = where.AND.find((c) => c.end?.gt)?.end?.gt;
          if (lt && gt) {
            rows = rows.filter((r) => overlapsWin(r.start, r.end, gt, lt));
          }
        }
        return rows.map((r) => ({ ...r }));
      }),
      create: jest.fn(
        async ({ data }: { data: Partial<FakeCalendarEvent> }) => {
          const row = { id: nextId("cal"), ...data } as FakeCalendarEvent;
          calendarEvent.set(row.id, row);
          return { ...row };
        }
      ),
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
    },
    task: {
      findMany: jest.fn(async () => [...tasks.values()].map((t) => ({ ...t }))),
    },
    $transaction: jest.fn() as jest.Mock,
    __stores: { personalCommitment, commitmentEvent, calendarEvent, tasks },
  };
  db.$transaction = jest.fn(
    async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)
  ) as jest.Mock;
  return { prisma: db };
});

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
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
  makeupOccurrence,
  isoWeekBounds,
  materialize,
} from "../CommitmentMaterializer";

const stores = (prisma as unknown as { __stores: InMemoryStores }).__stores;

const mockCtx = getCommitmentCalendarContext as jest.Mock;
const mockInsert = insertCommitmentGoogleEvent as jest.Mock;
const mockDelete = deleteCommitmentGoogleEvent as jest.Mock;

const USER = "user-1";
// 2026-05-18 is a Monday. ISO week = Mon 05-18 .. Sun 05-24 (see WEEK below).

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
  let n = 0;
  mockInsert.mockImplementation(async () => `gevent-${++n}`);
  mockDelete.mockResolvedValue(undefined);
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
    ...over,
  };
  stores.personalCommitment.set(id, c);
  return c;
}

const WEEK = {
  start: new Date("2026-05-18T00:00:00Z"),
  end: new Date("2026-05-25T00:00:00Z"), // exclusive next Monday
};

describe("makeupOccurrence", () => {
  it("(1) places a new materialized CommitmentEvent in the same ISO week, different day than excludeDateKey", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment();
    const excluded = new Date("2026-05-19T00:00:00Z"); // skipped Tuesday

    const res = await makeupOccurrence("c1", WEEK, excluded);

    expect(res.status).toBe("materialized");
    if (res.status !== "materialized") throw new Error("unreachable");
    expect(res.start.getTime()).toBeGreaterThanOrEqual(WEEK.start.getTime());
    expect(res.end.getTime()).toBeLessThanOrEqual(WEEK.end.getTime());

    const ces = [...stores.commitmentEvent.values()];
    expect(ces).toHaveLength(1);
    expect(ces[0].status).toBe("materialized");
    expect(ces[0].googleEventId).toBe("gevent-1");
    // landed on a different day than the excluded one
    const dayKey = new Date(ces[0].scheduledDate);
    dayKey.setUTCHours(0, 0, 0, 0);
    expect(dayKey.getTime()).not.toBe(excluded.getTime());

    expect(mockInsert).toHaveBeenCalledTimes(1);
    const cals = [...stores.calendarEvent.values()];
    expect(cals).toHaveLength(1);
    expect(cals[0].title).toBe("💪🏽 Movement");
    expect(cals[0].feedId).toBe(CTX.feedId);
  });

  it("(R4b) GCal insert failure → conflict AND the row is released (not left planned)", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment();
    mockInsert.mockRejectedValueOnce(new Error("GCal 503"));

    const res = await makeupOccurrence(
      "c1",
      WEEK,
      new Date("2026-05-19T00:00:00Z")
    );

    expect(res.status).toBe("conflict");
    const rows = [...stores.commitmentEvent.values()].filter(
      (e) => e.commitmentId === "c1"
    );
    expect(rows).toHaveLength(1);
    // Slot released — must NOT linger as "planned" (would block others).
    expect(rows[0].status).toBe("conflict");
    expect(
      [...stores.calendarEvent.values()].some(
        (c) => c.feedId === CTX.feedId && c.title === "💪🏽 Movement"
      )
    ).toBe(false);
  });

  it("(2) no free slot all week → conflict, zero GCal inserts, nothing evicted", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment();
    // Block 06:00–19:00 every day of the ISO week.
    for (let d = 18; d <= 24; d++) {
      const ymd = `2026-05-${d}`;
      const blocker: FakeCalendarEvent = {
        id: `pre-${ymd}`,
        feedId: CTX.feedId,
        title: "Blocker",
        start: new Date(`${ymd}T06:00:00Z`),
        end: new Date(`${ymd}T19:00:00Z`),
        externalEventId: `ext-${ymd}`,
        transparency: "opaque",
      };
      stores.calendarEvent.set(blocker.id, blocker);
    }
    const calBefore = stores.calendarEvent.size;

    const res = await makeupOccurrence(
      "c1",
      WEEK,
      new Date("2026-05-19T00:00:00Z")
    );

    expect(res.status).toBe("conflict");
    expect(mockInsert).not.toHaveBeenCalled();
    expect(stores.calendarEvent.size).toBe(calBefore); // no eviction
    // No materialized CommitmentEvent created.
    expect(
      [...stores.commitmentEvent.values()].some(
        (e) => e.status === "materialized"
      )
    ).toBe(false);
  });

  it("(3) skips a day that already holds an active CommitmentEvent for this commitment", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment();
    // An already-materialized occurrence on Thu 05-21 at 16:00.
    const thu = new Date("2026-05-21T00:00:00Z");
    stores.commitmentEvent.set("ce-existing", {
      id: "ce-existing",
      commitmentId: "c1",
      scheduledDate: thu,
      start: new Date("2026-05-21T16:00:00Z"),
      end: new Date("2026-05-21T17:00:00Z"),
      googleEventId: "gevent-existing",
      status: "materialized",
    });
    // Block every OTHER weekday's full daytime so the only "free" day by slot
    // would be Thu — but Thu must be skipped (already has an active CE).
    for (const d of [18, 19, 20, 22, 23, 24]) {
      const ymd = `2026-05-${d}`;
      stores.calendarEvent.set(`pre-${ymd}`, {
        id: `pre-${ymd}`,
        feedId: CTX.feedId,
        title: "Blocker",
        start: new Date(`${ymd}T06:00:00Z`),
        end: new Date(`${ymd}T19:00:00Z`),
        externalEventId: `ext-${ymd}`,
        transparency: "opaque",
      });
    }

    const res = await makeupOccurrence(
      "c1",
      WEEK,
      new Date("2026-05-19T00:00:00Z")
    );

    // Thu is the only slot-free day but is occupied by an active CE → conflict.
    expect(res.status).toBe("conflict");
    expect(mockInsert).not.toHaveBeenCalled();
    // The pre-existing materialized CE is untouched.
    expect(stores.commitmentEvent.get("ce-existing")!.status).toBe(
      "materialized"
    );
  });

  it("(R2b) skips a day holding a CANCELLED CE for this commitment (no resurrect)", async () => {
    mockCtx.mockResolvedValue(CTX);
    seedCommitment();
    // Thu 05-21 was explicitly skipped earlier (a cancelled occurrence).
    const thu = new Date("2026-05-21T00:00:00Z");
    stores.commitmentEvent.set("ce-cancelled", {
      id: "ce-cancelled",
      commitmentId: "c1",
      scheduledDate: thu,
      start: new Date("2026-05-21T16:00:00Z"),
      end: new Date("2026-05-21T17:00:00Z"),
      googleEventId: null,
      status: "cancelled",
    });
    // Block every other day's daytime so Thu is the only slot-free day —
    // but it must be skipped because a cancelled CE sits there (un-skipping
    // it via makeup would silently resurrect an explicit skip).
    for (const d of [18, 19, 20, 22, 23, 24]) {
      const ymd = `2026-05-${d}`;
      stores.calendarEvent.set(`pre-${ymd}`, {
        id: `pre-${ymd}`,
        feedId: CTX.feedId,
        title: "Blocker",
        start: new Date(`${ymd}T06:00:00Z`),
        end: new Date(`${ymd}T19:00:00Z`),
        externalEventId: `ext-${ymd}`,
        transparency: "opaque",
      });
    }

    const res = await makeupOccurrence(
      "c1",
      WEEK,
      new Date("2026-05-19T00:00:00Z")
    );

    expect(res.status).toBe("conflict");
    expect(mockInsert).not.toHaveBeenCalled();
    // The cancelled occurrence stays cancelled — not resurrected.
    expect(stores.commitmentEvent.get("ce-cancelled")!.status).toBe(
      "cancelled"
    );
  });

  it("(4) null calendar context → conflict, no writes, no throw", async () => {
    mockCtx.mockResolvedValue(null);
    seedCommitment();

    const res = await makeupOccurrence(
      "c1",
      WEEK,
      new Date("2026-05-19T00:00:00Z")
    );

    expect(res.status).toBe("conflict");
    expect(mockInsert).not.toHaveBeenCalled();
    expect(stores.commitmentEvent.size).toBe(0);
    expect(stores.calendarEvent.size).toBe(0);
  });
});

describe("materialize — respects an explicit per-occurrence skip", () => {
  // A cancelled CommitmentEvent is a Phase C skip. materialize MUST NOT
  // resurrect it on the next recompute (the skip route triggers a recompute);
  // otherwise skip is undone the moment it happens.
  it("(7) does not resurrect a cancelled occurrence", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-18T00:00:00Z")); // Monday
    try {
      mockCtx.mockResolvedValue(CTX);
      stores.personalCommitment.set("c1", {
        id: "c1",
        userId: USER,
        label: "Movement",
        emoji: "💪🏽",
        durationMin: 60,
        rrule: "FREQ=DAILY",
        preferredHour: null,
        timesPerWeek: null,
        active: true,
        lastMaterializedThrough: null,
      });
      // Tue 2026-05-19 was explicitly skipped (cancelled).
      const tueKey = new Date("2026-05-19T00:00:00Z");
      stores.commitmentEvent.set("ce-skip", {
        id: "ce-skip",
        commitmentId: "c1",
        scheduledDate: tueKey,
        start: new Date("2026-05-19T16:00:00Z"),
        end: new Date("2026-05-19T17:00:00Z"),
        googleEventId: null,
        status: "cancelled",
      });

      const res = await materialize(USER, 2); // Mon, Tue, Wed occurrences

      // Mon + Wed materialize; Tue stays cancelled, never re-inserted.
      expect(stores.commitmentEvent.get("ce-skip")!.status).toBe("cancelled");
      expect(res.created).toBe(2);
      const calForTue = [...stores.calendarEvent.values()].some(
        (c) =>
          c.start.getTime() >= new Date("2026-05-19T00:00:00Z").getTime() &&
          c.start.getTime() < new Date("2026-05-20T00:00:00Z").getTime()
      );
      expect(calForTue).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("isoWeekBounds", () => {
  it("(5) returns Mon 00:00 → next Mon 00:00 (exclusive) in UTC", () => {
    const wed = new Date("2026-05-20T12:00:00Z"); // Wed of the 05-18 ISO week
    const b = isoWeekBounds(wed, "UTC");
    expect(b.start.toISOString()).toBe("2026-05-18T00:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-05-25T00:00:00.000Z");
  });

  it("(6) DST-correct across US spring-forward (America/New_York, Mar 2026)", () => {
    // Wed 2026-03-04; ISO week = Mon 03-02 .. next Mon 03-09 (local).
    // DST starts Sun 2026-03-08 02:00 → week spans the offset change.
    const wed = new Date("2026-03-04T17:00:00Z");
    const b = isoWeekBounds(wed, "America/New_York");
    // Mon 03-02 00:00 EST (UTC-5) = 05:00Z; Mon 03-09 00:00 EDT (UTC-4) = 04:00Z
    expect(b.start.toISOString()).toBe("2026-03-02T05:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("(R5b) correct across the Dec→Jan year / ISO-week rollover", () => {
    // Wed 2026-12-30 → ISO week = Mon 2026-12-28 .. next Mon 2027-01-04.
    const wed = new Date("2026-12-30T12:00:00Z");
    const b = isoWeekBounds(wed, "UTC");
    expect(b.start.toISOString()).toBe("2026-12-28T00:00:00.000Z");
    expect(b.end.toISOString()).toBe("2027-01-04T00:00:00.000Z");
    // Monday start, exactly 7 days, straddling the year boundary.
    expect(b.start.getUTCDay()).toBe(1);
    expect(b.end.getTime() - b.start.getTime()).toBe(7 * 86400000);
  });
});
