/**
 * ClickUpClient
 *
 * Thin typed wrapper around the ClickUp v2 REST API.
 * Auth: personal API token sent as `Authorization: <token>` (no "Bearer" prefix).
 * Base URL: https://api.clickup.com/api/v2
 *
 * Rate limiting: on 429, reads X-RateLimit-Reset (Unix seconds) and sleeps
 * until then (capped at 60s), then retries once. Any other 4xx/5xx throws
 * ClickUpApiError.
 */

import { logger } from "@/lib/logger";

import type {
  ClickUpCustomFieldSetBody,
  ClickUpErrorBody,
  ClickUpFolder,
  ClickUpFoldersResponse,
  ClickUpList,
  ClickUpListsResponse,
  ClickUpSpace,
  ClickUpSpacesResponse,
  ClickUpTagBody,
  ClickUpTask,
  ClickUpTaskCreateBody,
  ClickUpTasksResponse,
  ClickUpTaskUpdateBody,
  ClickUpTeam,
  ClickUpTeamsResponse,
  ClickUpWebhookBody,
  ClickUpWebhookResponse,
} from "./types";

const BASE_URL = "https://api.clickup.com/api/v2";
const LOG_SOURCE = "ClickUpClient";

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class ClickUpApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ClickUpErrorBody,
    message: string
  ) {
    super(message);
    this.name = "ClickUpApiError";
  }
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface ClickUpClientOptions {
  /** Max seconds to wait on a 429 rate-limit reset. Default 60. */
  maxRateLimitWaitSecs?: number;
}

// ---------------------------------------------------------------------------
// getTasksInList options
// ---------------------------------------------------------------------------

export interface GetTasksOptions {
  date_updated_gt?: number; // Unix ms; only return tasks updated after this
  include_closed?: boolean; // default true
}

// ---------------------------------------------------------------------------
// ClickUpClient
// ---------------------------------------------------------------------------

export class ClickUpClient {
  private readonly token: string;
  private readonly maxRateLimitWaitMs: number;

  constructor(token: string, opts: ClickUpClientOptions = {}) {
    this.token = token;
    this.maxRateLimitWaitMs = (opts.maxRateLimitWaitSecs ?? 60) * 1000;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private headers(): Record<string, string> {
    return {
      Authorization: this.token, // NO "Bearer" prefix for personal tokens
      "Content-Type": "application/json",
    };
  }

  /** Sleep for `ms` milliseconds. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Core fetch wrapper.
   * - Handles 429 → wait until X-RateLimit-Reset, then retry once.
   * - Handles other 4xx/5xx → throws ClickUpApiError.
   * - Returns parsed JSON on success.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const init: RequestInit = {
      method,
      headers: this.headers(),
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    let response = await fetch(url, init);

    // Handle rate limit
    if (response.status === 429) {
      const resetHeader = response.headers.get("X-RateLimit-Reset");
      const resetSec = resetHeader ? parseInt(resetHeader, 10) : null;
      const nowSec = Math.floor(Date.now() / 1000);
      const waitMs = resetSec
        ? Math.min((resetSec - nowSec) * 1000, this.maxRateLimitWaitMs)
        : 1000;

      logger.warn(
        `ClickUp rate limit hit, waiting ${waitMs}ms before retry`,
        { path, resetSec: resetSec ?? null },
        LOG_SOURCE
      );

      await this.sleep(Math.max(waitMs, 0));

      // Retry once
      response = await fetch(url, init);
    }

    if (!response.ok) {
      let errBody: ClickUpErrorBody = {};
      try {
        errBody = (await response.json()) as ClickUpErrorBody;
      } catch {
        // ignore JSON parse failure on error bodies
      }
      const msg = errBody.err ?? `ClickUp API error ${response.status} on ${method} ${path}`;
      logger.error(
        `ClickUp API error`,
        { status: response.status, path, method, err: msg, ecode: errBody.ECODE ?? null },
        LOG_SOURCE
      );
      throw new ClickUpApiError(response.status, errBody, msg);
    }

    // DELETE returns 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  // -------------------------------------------------------------------------
  // Public API methods
  // -------------------------------------------------------------------------

  /** GET /team — returns all workspaces the token can access */
  async getTeams(): Promise<ClickUpTeam[]> {
    const data = await this.request<ClickUpTeamsResponse>("GET", "/team");
    return data.teams ?? [];
  }

  /** GET /team/{teamId}/space?archived=false */
  async getSpaces(teamId: string): Promise<ClickUpSpace[]> {
    const data = await this.request<ClickUpSpacesResponse>(
      "GET",
      `/team/${teamId}/space?archived=false`
    );
    return data.spaces ?? [];
  }

  /** GET /space/{spaceId} */
  async getSpace(spaceId: string): Promise<ClickUpSpace> {
    return this.request<ClickUpSpace>("GET", `/space/${spaceId}`);
  }

  /** GET /space/{spaceId}/folder?archived=false */
  async getFolders(spaceId: string): Promise<ClickUpFolder[]> {
    const data = await this.request<ClickUpFoldersResponse>(
      "GET",
      `/space/${spaceId}/folder?archived=false`
    );
    return data.folders ?? [];
  }

  /** GET /space/{spaceId}/list?archived=false (folderless lists only) */
  async getFolderlessLists(spaceId: string): Promise<ClickUpList[]> {
    const data = await this.request<ClickUpListsResponse>(
      "GET",
      `/space/${spaceId}/list?archived=false`
    );
    return data.lists ?? [];
  }

  /** GET /folder/{folderId}/list?archived=false */
  async getListsInFolder(folderId: string): Promise<ClickUpList[]> {
    const data = await this.request<ClickUpListsResponse>(
      "GET",
      `/folder/${folderId}/list?archived=false`
    );
    return data.lists ?? [];
  }

  /** GET /list/{listId} — returns list metadata including statuses */
  async getList(listId: string): Promise<ClickUpList> {
    return this.request<ClickUpList>("GET", `/list/${listId}`);
  }

  /**
   * GET /list/{listId}/task — paginated, returns ALL pages combined.
   *
   * Stops when a page returns <100 tasks (ClickUp fixed page size = 100).
   * Passes `subtasks=true`, `include_closed=true`, and `order_by=updated`.
   *
   * @param opts.date_updated_gt  Only return tasks updated after this Unix-ms timestamp (delta sync)
   * @param opts.include_closed   Defaults to true
   */
  async getTasksInList(
    listId: string,
    opts: GetTasksOptions = {}
  ): Promise<ClickUpTask[]> {
    const allTasks: ClickUpTask[] = [];
    let page = 0;

    while (true) {
      const params = new URLSearchParams({
        subtasks: "true",
        include_closed: String(opts.include_closed ?? true),
        order_by: "updated",
        page: String(page),
      });

      if (opts.date_updated_gt !== undefined) {
        params.set("date_updated_gt", String(opts.date_updated_gt));
      }

      const data = await this.request<ClickUpTasksResponse>(
        "GET",
        `/list/${listId}/task?${params.toString()}`
      );

      const tasks = data.tasks ?? [];
      allTasks.push(...tasks);

      if (tasks.length < 100) {
        // Last page
        break;
      }

      page++;
    }

    return allTasks;
  }

  /** GET /task/{taskId}?include_subtasks=true */
  async getTask(taskId: string): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(
      "GET",
      `/task/${taskId}?include_subtasks=true`
    );
  }

  /** POST /list/{listId}/task */
  async createTask(
    listId: string,
    body: ClickUpTaskCreateBody
  ): Promise<ClickUpTask> {
    return this.request<ClickUpTask>("POST", `/list/${listId}/task`, body);
  }

  /** PUT /task/{taskId} */
  async updateTask(
    taskId: string,
    body: ClickUpTaskUpdateBody
  ): Promise<ClickUpTask> {
    return this.request<ClickUpTask>("PUT", `/task/${taskId}`, body);
  }

  /** DELETE /task/{taskId} */
  async deleteTask(taskId: string): Promise<void> {
    await this.request<void>("DELETE", `/task/${taskId}`);
  }

  /**
   * POST /task/{taskId}/field/{fieldId}
   * Sets a custom field value on a task.
   */
  async setCustomField(
    taskId: string,
    fieldId: string,
    value: unknown
  ): Promise<void> {
    const body: ClickUpCustomFieldSetBody = { value };
    await this.request<unknown>(
      "POST",
      `/task/${taskId}/field/${fieldId}`,
      body
    );
  }

  /**
   * POST /list/{listId}/field
   * Creates a custom field on a list.
   *
   * Best-effort: this endpoint may not exist on Free tier. On any 4xx,
   * returns null and lets the caller decide what to do (see ensureCustomFields
   * in ClickUpProvider).
   */
  async createCustomField(
    listId: string,
    body: Record<string, unknown>
  ): Promise<{ id: string } | null> {
    try {
      const result = await this.request<{ id: string }>(
        "POST",
        `/list/${listId}/field`,
        body
      );
      return result;
    } catch (err) {
      if (err instanceof ClickUpApiError && err.status >= 400 && err.status < 500) {
        logger.warn(
          `createCustomField 4xx — likely Free plan limit`,
          { listId, status: err.status, err: err.body.err ?? null },
          LOG_SOURCE
        );
        return null;
      }
      throw err;
    }
  }

  /**
   * Upsert a tag on a Space.
   * - Creates via POST /space/{spaceId}/tag if the tag doesn't exist yet.
   * - Updates via PUT /space/{spaceId}/tag/{encodedName} if it does.
   *
   * Note: ClickUp tag write returns 200 with empty body on success.
   */
  async upsertTag(
    spaceId: string,
    tagName: string,
    bgColor: string,
    fgColor: string,
    isNew: boolean
  ): Promise<void> {
    const tagBody: ClickUpTagBody = {
      tag: { name: tagName, tag_bg: bgColor, tag_fg: fgColor },
    };

    if (isNew) {
      await this.request<unknown>("POST", `/space/${spaceId}/tag`, tagBody);
    } else {
      const encodedName = encodeURIComponent(tagName);
      await this.request<unknown>(
        "PUT",
        `/space/${spaceId}/tag/${encodedName}`,
        tagBody
      );
    }
  }

  /**
   * POST /team/{teamId}/webhook
   *
   * Stub for Phase 4 (webhooks). Currently logs and returns null.
   * The CLICKUP_WEBHOOKS_ENABLED env var must be set to "true" to actually register.
   */
  async createWebhook(
    teamId: string,
    body: ClickUpWebhookBody
  ): Promise<ClickUpWebhookResponse | null> {
    if (process.env.CLICKUP_WEBHOOKS_ENABLED !== "true") {
      logger.info(
        "createWebhook skipped — CLICKUP_WEBHOOKS_ENABLED is not set",
        { teamId, endpoint: body.endpoint ?? null },
        LOG_SOURCE
      );
      return null;
    }

    return this.request<ClickUpWebhookResponse>(
      "POST",
      `/team/${teamId}/webhook`,
      body
    );
  }
}
