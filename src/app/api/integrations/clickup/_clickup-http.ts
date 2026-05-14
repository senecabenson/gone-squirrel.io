/**
 * Throwaway ClickUp HTTP helper for Phase 2 integration routes.
 *
 * TODO (Phase 3): Replace usages of this file with the proper ClickUpClient from
 * `src/lib/task-sync/providers/clickup/clickup-client.ts` once Phase 1 is complete.
 * Then delete this file.
 */

const CLICKUP_BASE_URL = "https://api.clickup.com/api/v2";

/**
 * Perform an authenticated request to the ClickUp v2 REST API.
 *
 * @param token  Personal API token (raw — no "Bearer" prefix, per ClickUp PAT spec).
 * @param path   Path relative to `/api/v2`, e.g. `/team`.
 * @param init   Optional fetch init (method, body, etc.).
 */
export async function clickUpFetch<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${CLICKUP_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Authorization: token,
    ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
  };

  const response = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      // Allow callers to override individual headers
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ClickUp API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}
