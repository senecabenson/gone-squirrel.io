/**
 * Feature-flag stub. Personal-use fork — SaaS variant removed.
 * Kept so legacy callers continue to compile while we strip references.
 */

export const isSaasEnabled = false;

export const featureFlags = {
  core: {
    basicCalendar: true,
    basicTasks: true,
    googleCalendarSync: true,
    outlookCalendarSync: true,
    caldavSync: true,
  },
};

export function isFeatureEnabled(feature: string): boolean {
  if (feature in featureFlags.core) {
    return featureFlags.core[feature as keyof typeof featureFlags.core];
  }
  return false;
}
