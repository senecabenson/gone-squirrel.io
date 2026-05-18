/**
 * Regression: scheduling-block follow-up #8 (load round-trip).
 *
 * `updateAutoScheduleSettings()` (save path) PATCHes the full settings object,
 * but `initializeSettings()` (load path) re-hydrated only 12 of the 16
 * AutoScheduleSettings fields — silently dropping the four scheduling-block
 * fields. Persisted custom block config therefore never made it back into the
 * store on app load.
 *
 * This test drives the load path with a GET payload that has CUSTOM values for
 * all four block fields and asserts they land in the store.
 */

import { useSettingsStore } from "@/store/settings";

type Json = Record<string, unknown>;

const CUSTOM_BLOCK_MAP = JSON.stringify([
  { emoji: "🧠", label: "Deep Work", eligibility: "high", daytimeOnly: true },
]);

function settingsPayloadByUrl(url: string): Json {
  if (url.includes("/api/user-settings")) {
    return {
      theme: "light",
      defaultView: "week",
      timeZone: "UTC",
      weekStartDay: 1,
      timeFormat: "24h",
    };
  }
  if (url.includes("/api/calendar-settings")) {
    return {
      defaultCalendarId: null,
      workingHoursEnabled: false,
      workingHoursStart: 9,
      workingHoursEnd: 17,
      workingHoursDays: "[]",
      defaultDuration: 30,
      defaultColor: null,
      defaultReminder: 10,
      refreshInterval: 5,
    };
  }
  if (url.includes("/api/notification-settings")) {
    return {
      emailNotifications: false,
      dailyEmailEnabled: false,
      eventInvites: false,
      eventUpdates: false,
      eventCancellations: false,
      eventReminders: false,
      defaultReminderTiming: "[]",
    };
  }
  if (url.includes("/api/auto-schedule-settings")) {
    return {
      workDays: JSON.stringify([1, 2, 3, 4, 5]),
      workHourStart: 9,
      workHourEnd: 20,
      selectedCalendars: "[]",
      bufferMinutes: 15,
      highEnergyStart: 9,
      highEnergyEnd: 12,
      mediumEnergyStart: 13,
      mediumEnergyEnd: 15,
      lowEnergyStart: 15,
      lowEnergyEnd: 20,
      groupByProject: false,
      // The four fields the load path used to drop:
      taskBlocksFeedId: "feed-xyz",
      blockTypeMap: CUSTOM_BLOCK_MAP,
      noEligibleBlockPolicy: "fallback_work_hours",
      skipReflowBlockType: "deep",
    };
  }
  if (url.includes("/api/accounts")) {
    return [] as unknown as Json;
  }
  // integration-settings, data-settings, system-settings, etc.
  return {};
}

describe("initializeSettings load round-trip — scheduling block fields", () => {
  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(settingsPayloadByUrl(url)),
      } as Response);
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("hydrates taskBlocksFeedId/blockTypeMap/noEligibleBlockPolicy/skipReflowBlockType from the API", async () => {
    await useSettingsStore.getState().initializeSettings();

    const { autoSchedule } = useSettingsStore.getState();
    expect(autoSchedule.taskBlocksFeedId).toBe("feed-xyz");
    expect(autoSchedule.blockTypeMap).toBe(CUSTOM_BLOCK_MAP);
    expect(autoSchedule.noEligibleBlockPolicy).toBe("fallback_work_hours");
    expect(autoSchedule.skipReflowBlockType).toBe("deep");
  });
});
