// CommitmentCalendarResolver.test.ts
// Tests for getCommitmentCalendarContext (Checkpoint 1, TDD RED phase)

jest.mock("@/lib/prisma", () => ({
  prisma: {
    connectedAccount: { findFirst: jest.fn() },
    userSettings: { findUnique: jest.fn() },
    autoScheduleSettings: { findUnique: jest.fn() },
    calendarFeed: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/google-calendar", () => ({
  getGoogleCalendarClient: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getGoogleCalendarClient } from "@/lib/google-calendar";
import { getCommitmentCalendarContext } from "@/services/google-task-sync";

const mockGetGoogleCalendarClient = getGoogleCalendarClient as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getCommitmentCalendarContext", () => {
  const USER_ID = "user-abc";
  const ACCOUNT_ID = "account-xyz";
  const FEED_ID = "feed-111";
  const CALENDAR_URL = "cal-url@group.calendar.google.com";
  const TIME_ZONE = "America/Los_Angeles";

  const fakeClient = { events: { insert: jest.fn(), delete: jest.fn() } };

  function setupHappyPath() {
    (prisma.connectedAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ timeZone: TIME_ZONE });
    (prisma.autoScheduleSettings.findUnique as jest.Mock).mockResolvedValue({
      taskBlocksFeedId: FEED_ID,
    });
    (prisma.calendarFeed.findUnique as jest.Mock).mockResolvedValue({
      id: FEED_ID,
      url: CALENDAR_URL,
    });
    mockGetGoogleCalendarClient.mockResolvedValue(fakeClient);
  }

  it("(a) returns null when no connected Google account exists", async () => {
    (prisma.connectedAccount.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.autoScheduleSettings.findUnique as jest.Mock).mockResolvedValue({
      taskBlocksFeedId: FEED_ID,
    });

    const result = await getCommitmentCalendarContext(USER_ID);
    expect(result).toBeNull();
  });

  it("(b) returns null when taskBlocksFeedId is null on AutoScheduleSettings", async () => {
    (prisma.connectedAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    (prisma.autoScheduleSettings.findUnique as jest.Mock).mockResolvedValue({
      taskBlocksFeedId: null,
    });

    const result = await getCommitmentCalendarContext(USER_ID);
    expect(result).toBeNull();
  });

  it("(b2) returns null when AutoScheduleSettings row is absent", async () => {
    (prisma.connectedAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    (prisma.autoScheduleSettings.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getCommitmentCalendarContext(USER_ID);
    expect(result).toBeNull();
  });

  it("(c) returns null when the CalendarFeed row is not found", async () => {
    (prisma.connectedAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    (prisma.autoScheduleSettings.findUnique as jest.Mock).mockResolvedValue({
      taskBlocksFeedId: FEED_ID,
    });
    (prisma.calendarFeed.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getCommitmentCalendarContext(USER_ID);
    expect(result).toBeNull();
  });

  it("(d) returns null when feed.url is null", async () => {
    (prisma.connectedAccount.findFirst as jest.Mock).mockResolvedValue({ id: ACCOUNT_ID });
    (prisma.autoScheduleSettings.findUnique as jest.Mock).mockResolvedValue({
      taskBlocksFeedId: FEED_ID,
    });
    (prisma.calendarFeed.findUnique as jest.Mock).mockResolvedValue({
      id: FEED_ID,
      url: null,
    });

    const result = await getCommitmentCalendarContext(USER_ID);
    expect(result).toBeNull();
  });

  it("(e) happy path returns object with correct fields", async () => {
    setupHappyPath();

    const result = await getCommitmentCalendarContext(USER_ID);

    expect(result).not.toBeNull();
    expect(result!.googleCalendarId).toBe(CALENDAR_URL);
    expect(result!.feedId).toBe(FEED_ID);
    expect(result!.timeZone).toBe(TIME_ZONE);
    expect(result!.client).toBe(fakeClient);
  });
});
