// CommitmentAdjuster.test.ts
// Phase C / CP2 — skipOccurrence() + moveOccurrence() (TDD).
//
// In-memory prisma fake (same pattern as the materializer tests) + mocked
// google-task-sync primitives + mocked makeupOccurrence (CP1 is unit-tested
// separately; here we assert the adjuster orchestrates it correctly).

interface FakeCommitment {
  id: string;
  userId: string;
  label: string;
  emoji: string;
  durationMin: number;
  rrule: string;
  preferredHour: number | null;
  active: boolean;
}
interface FakeCE {
  id: string;
  commitmentId: string;
  scheduledDate: Date;
  start: Date;
  end: Date;
  googleEventId: string | null;
  status: string;
}
interface FakeCal {
  id: string;
  feedId: string;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  externalEventId: string | null;
  transparency: string;
}
interface FakeTask {
  id: string;
  userId: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
}
interface FakeSettings {
  userId: string;
  blockTypeMap: string;
  skipReflowBlockType: string;
}
interface Stores {
  commitment: Map<string, FakeCommitment>;
  ce: Map<string, FakeCE>;
  cal: Map<string, FakeCal>;
  task: Map<string, FakeTask>;
  settings: Map<string, FakeSettings>;
}

jest.mock("@/lib/prisma", () => {
  const commitment = new Map<string, FakeCommitment>();
  const ce = new Map<string, FakeCE>();
  const cal = new Map<string, FakeCal>();
  const task = new Map<string, FakeTask>();
  const settings = new Map<string, FakeSettings>();
  let seq = 0;
  const nextId = (p: string) => `${p}-${++seq}`;
  const ov = (s: Date, e: Date, f: Date, t: Date) =>
    s.getTime() < t.getTime() && f.getTime() < e.getTime();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const db: any = {
    personalCommitment: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.id ? (commitment.get(where.id) ?? null) : null
      ),
      findMany: jest.fn(async ({ where }: any) =>
        [...commitment.values()].filter(
          (c) =>
            (where?.userId === undefined || c.userId === where.userId) &&
            (where?.active === undefined || c.active === where.active)
        )
      ),
    },
    commitmentEvent: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.id ? (ce.get(where.id) ?? null) : null
      ),
      findMany: jest.fn(async ({ where }: any) => {
        let r = [...ce.values()];
        if (where?.commitmentId?.in)
          r = r.filter((x) => where.commitmentId.in.includes(x.commitmentId));
        if (typeof where?.commitmentId === "string")
          r = r.filter((x) => x.commitmentId === where.commitmentId);
        if (where?.status?.in)
          r = r.filter((x) => where.status.in.includes(x.status));
        if (where?.status?.not)
          r = r.filter((x) => x.status !== where.status.not);
        if (where?.id?.not) r = r.filter((x) => x.id !== where.id.not);
        if (where?.scheduledDate?.gte && where?.scheduledDate?.lt)
          r = r.filter(
            (x) =>
              x.scheduledDate.getTime() >= where.scheduledDate.gte.getTime() &&
              x.scheduledDate.getTime() < where.scheduledDate.lt.getTime()
          );
        if (where?.AND) {
          const lt = where.AND.find((c: any) => c.start?.lt)?.start?.lt;
          const gt = where.AND.find((c: any) => c.end?.gt)?.end?.gt;
          if (lt && gt) r = r.filter((x) => ov(x.start, x.end, gt, lt));
        }
        return r.map((x) => ({ ...x }));
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const { commitmentId, scheduledDate } =
          where.commitmentId_scheduledDate;
        let row = [...ce.values()].find(
          (x) =>
            x.commitmentId === commitmentId &&
            x.scheduledDate.getTime() === scheduledDate.getTime()
        );
        if (row) Object.assign(row, update);
        else {
          row = {
            id: nextId("ce"),
            commitmentId,
            scheduledDate,
            googleEventId: null,
            status: "planned",
            ...create,
          } as FakeCE;
          ce.set(row.id, row);
        }
        return { ...row };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = ce.get(where.id)!;
        Object.assign(row, data);
        return { ...row };
      }),
    },
    calendarEvent: {
      findMany: jest.fn(async ({ where }: any) => {
        let r = [...cal.values()];
        if (where?.feedId) r = r.filter((x) => x.feedId === where.feedId);
        if (where?.externalEventId)
          r = r.filter((x) => x.externalEventId === where.externalEventId);
        if (where?.AND) {
          const lt = where.AND.find((c: any) => c.start?.lt)?.start?.lt;
          const gt = where.AND.find((c: any) => c.end?.gt)?.end?.gt;
          if (lt && gt) r = r.filter((x) => ov(x.start, x.end, gt, lt));
        }
        return r.map((x) => ({ ...x }));
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: nextId("cal"), ...data } as FakeCal;
        cal.set(row.id, row);
        return { ...row };
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        let n = 0;
        for (const [k, r] of [...cal.entries()]) {
          if (
            (where.feedId === undefined || r.feedId === where.feedId) &&
            (where.externalEventId === undefined ||
              r.externalEventId === where.externalEventId)
          ) {
            cal.delete(k);
            n++;
          }
        }
        return { count: n };
      }),
    },
    task: {
      findMany: jest.fn(async ({ where }: any) => {
        let r = [...task.values()].filter(
          (t) => where?.userId === undefined || t.userId === where.userId
        );
        if (where?.AND) {
          const lt = where.AND.find((c: any) => c.scheduledStart?.lt)
            ?.scheduledStart?.lt;
          const gt = where.AND.find((c: any) => c.scheduledEnd?.gt)
            ?.scheduledEnd?.gt;
          if (lt && gt)
            r = r.filter(
              (t) =>
                t.scheduledStart &&
                t.scheduledEnd &&
                ov(t.scheduledStart, t.scheduledEnd, gt, lt)
            );
        }
        return r.map((t) => ({ ...t }));
      }),
    },
    autoScheduleSettings: {
      findUnique: jest.fn(async ({ where }: any) =>
        settings.get(where.userId) ?? null
      ),
    },
    $transaction: jest.fn(),
    __stores: { commitment, ce, cal, task, settings },
  };
  db.$transaction = jest.fn(async (fn: any) => fn(db));
  /* eslint-enable @typescript-eslint/no-explicit-any */
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

jest.mock("../CommitmentMaterializer", () => {
  const actual = jest.requireActual("../CommitmentMaterializer");
  return { ...actual, makeupOccurrence: jest.fn() };
});

import { prisma } from "@/lib/prisma";
import {
  getCommitmentCalendarContext,
  insertCommitmentGoogleEvent,
  deleteCommitmentGoogleEvent,
} from "@/services/google-task-sync";
import { makeupOccurrence } from "../CommitmentMaterializer";
import {
  skipOccurrence,
  moveOccurrence,
  CommitmentMoveConflictError,
} from "../CommitmentAdjuster";

const stores = (prisma as unknown as { __stores: Stores }).__stores;
const mockCtx = getCommitmentCalendarContext as jest.Mock;
const mockInsert = insertCommitmentGoogleEvent as jest.Mock;
const mockDelete = deleteCommitmentGoogleEvent as jest.Mock;
const mockMakeup = makeupOccurrence as jest.Mock;

const USER = "user-1";
const CTX = {
  client: { events: {} },
  googleCalendarId: "cal@g",
  feedId: "feed-1",
  timeZone: "UTC",
};

beforeEach(() => {
  jest.clearAllMocks();
  stores.commitment.clear();
  stores.ce.clear();
  stores.cal.clear();
  stores.task.clear();
  stores.settings.clear();
  mockCtx.mockResolvedValue(CTX);
  mockInsert.mockResolvedValue("gev-new");
  mockDelete.mockResolvedValue(undefined);
  mockMakeup.mockResolvedValue({
    status: "materialized",
    start: new Date("2026-05-21T16:00:00Z"),
    end: new Date("2026-05-21T17:00:00Z"),
  });
  stores.commitment.set("c1", {
    id: "c1",
    userId: USER,
    label: "Movement",
    emoji: "💪🏽",
    durationMin: 60,
    rrule: "FREQ=WEEKLY;BYDAY=TU,TH",
    preferredHour: 16,
    active: true,
  });
  stores.settings.set(USER, {
    userId: USER,
    blockTypeMap: "[]", // → DEFAULT_BLOCK_TYPE_MAP
    skipReflowBlockType: "light",
  });
});

function seedOccurrence(over: Partial<FakeCE> = {}): FakeCE {
  const ev: FakeCE = {
    id: "ce-1",
    commitmentId: "c1",
    scheduledDate: new Date("2026-05-19T00:00:00Z"),
    start: new Date("2026-05-19T16:00:00Z"),
    end: new Date("2026-05-19T17:00:00Z"),
    googleEventId: "gev-old",
    status: "materialized",
    ...over,
  };
  stores.ce.set(ev.id, ev);
  // its mirror CalendarEvent
  stores.cal.set("cal-mirror", {
    id: "cal-mirror",
    feedId: CTX.feedId,
    title: "💪🏽 Movement",
    description: "gsCommitment:ce-1",
    start: ev.start,
    end: ev.end,
    externalEventId: ev.googleEventId,
    transparency: "opaque",
  });
  return ev;
}

describe("skipOccurrence", () => {
  it("(1) reflow:work + light → cancels, deletes GCal, writes tagged 🪶 temp block, runs makeup", async () => {
    const ev = seedOccurrence();

    const res = await skipOccurrence("ce-1", { reflow: "work" });

    // cancelled + GCal delete + mirror removed
    expect(stores.ce.get("ce-1")!.status).toBe("cancelled");
    expect(mockDelete).toHaveBeenCalledWith(
      CTX.client,
      CTX.googleCalendarId,
      "gev-old"
    );
    // temp reflow block written over the freed interval, tagged + Light Work
    const reflow = [...stores.cal.values()].find((c) =>
      c.description?.startsWith("gs:reflow:")
    );
    expect(reflow).toBeTruthy();
    expect(reflow!.description).toBe("gs:reflow:ce-1");
    expect(reflow!.title).toBe("🪶 Light Work");
    expect(reflow!.start.getTime()).toBe(ev.start.getTime());
    expect(reflow!.end.getTime()).toBe(ev.end.getTime());
    expect(mockInsert).toHaveBeenCalledTimes(1);
    // makeup invoked once for this commitment, excluding the skipped day
    expect(mockMakeup).toHaveBeenCalledTimes(1);
    const [cid, week, exclude] = mockMakeup.mock.calls[0];
    expect(cid).toBe("c1");
    expect(week.start.toISOString()).toBe("2026-05-18T00:00:00.000Z");
    expect(exclude.getTime()).toBe(
      new Date("2026-05-19T00:00:00Z").getTime()
    );
    expect(res.skipped).toBe(true);
    expect(res.makeup.status).toBe("materialized");
  });

  it("(2) skipReflowBlockType=free → no temp block, GCal delete still called, makeup still attempted", async () => {
    stores.settings.get(USER)!.skipReflowBlockType = "free";
    seedOccurrence();

    const res = await skipOccurrence("ce-1", { reflow: "work" });

    expect(
      [...stores.cal.values()].some((c) =>
        c.description?.startsWith("gs:reflow:")
      )
    ).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
    expect(mockMakeup).toHaveBeenCalledTimes(1);
    expect(res.skipped).toBe(true);
  });

  it("(2b) reflow:free arg → no temp block even if setting=light", async () => {
    seedOccurrence();
    await skipOccurrence("ce-1", { reflow: "free" });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockMakeup).toHaveBeenCalledTimes(1);
  });

  it("(3) makeup conflict → surfaced, the skipped occurrence is the only thing removed (no eviction)", async () => {
    mockMakeup.mockResolvedValue({ status: "conflict" });
    seedOccurrence();
    // an unrelated protected block on the feed must survive
    stores.cal.set("other", {
      id: "other",
      feedId: CTX.feedId,
      title: "💖 Wife",
      description: null,
      start: new Date("2026-05-20T18:00:00Z"),
      end: new Date("2026-05-20T20:00:00Z"),
      externalEventId: "gev-wife",
      transparency: "opaque",
    });

    const res = await skipOccurrence("ce-1", { reflow: "work" });

    expect(res.makeup.status).toBe("conflict");
    expect(stores.cal.get("other")).toBeTruthy(); // not evicted
  });
});

describe("moveOccurrence", () => {
  it("(4) valid target → old GCal deleted, new inserted, CommitmentEvent updated", async () => {
    seedOccurrence();
    const newStart = new Date("2026-05-19T10:00:00Z");

    const res = await moveOccurrence("ce-1", newStart);

    expect(mockDelete).toHaveBeenCalledWith(
      CTX.client,
      CTX.googleCalendarId,
      "gev-old"
    );
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const row = stores.ce.get("ce-1")!;
    expect(row.start.getTime()).toBe(newStart.getTime());
    expect(row.end.getTime()).toBe(
      new Date("2026-05-19T11:00:00Z").getTime()
    );
    expect(row.status).toBe("materialized");
    expect(row.googleEventId).toBe("gev-new");
    expect(res.moved).toBe(true);
  });

  it("(5) onto a protected block → CommitmentMoveConflictError, ZERO mutation", async () => {
    const ev = seedOccurrence();
    // protected 💖 Wife block at the target time
    stores.cal.set("wife", {
      id: "wife",
      feedId: CTX.feedId,
      title: "💖 Wife",
      description: null,
      start: new Date("2026-05-19T10:00:00Z"),
      end: new Date("2026-05-19T12:00:00Z"),
      externalEventId: "gev-wife",
      transparency: "opaque",
    });

    await expect(
      moveOccurrence("ce-1", new Date("2026-05-19T10:30:00Z"))
    ).rejects.toBeInstanceOf(CommitmentMoveConflictError);

    // nothing mutated
    const row = stores.ce.get("ce-1")!;
    expect(row.start.getTime()).toBe(ev.start.getTime());
    expect(row.status).toBe("materialized");
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("(6) onto a low/high eligible block → allowed (commitment wins; work reflows on recompute)", async () => {
    seedOccurrence();
    stores.cal.set("deep", {
      id: "deep",
      feedId: CTX.feedId,
      title: "🧠 Deep Work",
      description: null,
      start: new Date("2026-05-19T09:00:00Z"),
      end: new Date("2026-05-19T13:00:00Z"),
      externalEventId: "gev-deep",
      transparency: "opaque",
    });

    const res = await moveOccurrence("ce-1", new Date("2026-05-19T10:00:00Z"));
    expect(res.moved).toBe(true);
  });

  it("(7) overlapping another active CommitmentEvent → conflict, no mutation", async () => {
    seedOccurrence();
    stores.ce.set("ce-other", {
      id: "ce-other",
      commitmentId: "c1",
      scheduledDate: new Date("2026-05-20T00:00:00Z"),
      start: new Date("2026-05-20T10:00:00Z"),
      end: new Date("2026-05-20T11:00:00Z"),
      googleEventId: "gev-other",
      status: "materialized",
    });

    await expect(
      moveOccurrence("ce-1", new Date("2026-05-20T10:30:00Z"))
    ).rejects.toBeInstanceOf(CommitmentMoveConflictError);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
