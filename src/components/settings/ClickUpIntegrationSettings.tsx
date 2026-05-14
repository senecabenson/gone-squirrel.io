"use client";

import { useCallback, useEffect, useState } from "react";

import { ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { SettingRow, SettingsSection } from "./SettingsSection";

interface Space {
  id: string;
  name: string;
  color: string | null;
  enabled: boolean;
}

interface ListItem {
  id: string;
  name: string;
  taskCount: number;
  folderName: string | null;
  enabled: boolean;
}

interface SyncResult {
  mappingId: string;
  ok: boolean;
  error?: string;
}

export function ClickUpIntegrationSettings() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [expandedSpaceId, setExpandedSpaceId] = useState<string | null>(null);
  const [listsBySpace, setListsBySpace] = useState<Record<string, ListItem[]>>({});
  const [loadingLists, setLoadingLists] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const refreshSpaces = useCallback(async () => {
    const res = await fetch("/api/integrations/clickup/spaces");
    if (res.status === 400 || res.status === 401) {
      setConnected(false);
      setSpaces([]);
      return;
    }
    if (!res.ok) {
      toast.error("Failed to load ClickUp spaces");
      setConnected(false);
      return;
    }
    const data = (await res.json()) as { spaces: Space[] };
    setSpaces(data.spaces ?? []);
    setConnected(true);
  }, []);

  useEffect(() => {
    refreshSpaces().catch(() => setConnected(false));
  }, [refreshSpaces]);

  const handleConnect = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      toast.error("Paste your ClickUp Personal API Token first");
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/clickup/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: trimmed }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Connect failed");
      }
      toast.success("ClickUp connected");
      setToken("");
      await refreshSpaces();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect ClickUp? Mirrored workspaces will be archived.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/clickup/disconnect", { method: "DELETE" });
      if (!res.ok) throw new Error("Disconnect failed");
      toast.success("ClickUp disconnected");
      setSpaces([]);
      setListsBySpace({});
      setExpandedSpaceId(null);
      setConnected(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  };

  const loadLists = useCallback(async (spaceId: string) => {
    setLoadingLists(spaceId);
    try {
      const res = await fetch(`/api/integrations/clickup/spaces/${spaceId}/lists`);
      if (!res.ok) throw new Error("Failed to load lists");
      const data = (await res.json()) as { lists: ListItem[] };
      setListsBySpace((prev) => ({ ...prev, [spaceId]: data.lists ?? [] }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load lists");
    } finally {
      setLoadingLists(null);
    }
  }, []);

  const handleExpandSpace = async (spaceId: string) => {
    if (expandedSpaceId === spaceId) {
      setExpandedSpaceId(null);
      return;
    }
    setExpandedSpaceId(spaceId);
    if (!listsBySpace[spaceId]) await loadLists(spaceId);
  };

  const handleEnableSpace = async (spaceId: string) => {
    const res = await fetch(`/api/integrations/clickup/spaces/${spaceId}/enable`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error("Failed to enable space");
      return;
    }
    toast.success("Space mirrored");
    refreshSpaces();
  };

  const handleEnableList = async (spaceId: string, listId: string) => {
    const res = await fetch(`/api/integrations/clickup/lists/${listId}/enable`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error("Failed to enable list");
      return;
    }
    toast.success("List enabled — Sync Now to import tasks");
    await loadLists(spaceId);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/clickup/sync-now", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const data = (await res.json()) as { results: SyncResult[] };
      const failed = data.results.filter((r) => !r.ok).length;
      if (failed > 0) toast.warning(`Sync done with ${failed} failure(s)`);
      else if (data.results.length === 0) toast.info("No enabled lists yet");
      else toast.success(`Synced ${data.results.length} mapping(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (connected === null) {
    return (
      <SettingsSection
        title="ClickUp"
        description="Mirror ClickUp tasks into GoneSquirrel for auto-scheduling."
      >
        <div className="flex items-center gap-2 text-body-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      </SettingsSection>
    );
  }

  if (!connected) {
    return (
      <SettingsSection
        title="ClickUp"
        description="Mirror ClickUp tasks into GoneSquirrel for auto-scheduling."
      >
        <SettingRow
          label="Personal API Token"
          description={
            <>
              Generate one at{" "}
              <a
                href="https://app.clickup.com/settings/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted underline-offset-2"
              >
                ClickUp → Settings → Apps
              </a>
              . Tokens start with <code>pk_</code>.
            </>
          }
        >
          <div className="flex w-full gap-2">
            <Input
              type="password"
              placeholder="pk_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
            </Button>
          </div>
        </SettingRow>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="ClickUp"
      description="Mirror ClickUp tasks into GoneSquirrel for auto-scheduling."
    >
      <SettingRow
        label="Connection"
        description="ClickUp is connected. Tasks sync via TaskSyncManager when you press Sync Now."
      >
        <div className="flex w-full items-center gap-2">
          <Button onClick={handleSyncNow} disabled={syncing} variant="default">
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync now
          </Button>
          <Button
            onClick={handleDisconnect}
            disabled={disconnecting}
            variant="outline"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      </SettingRow>

      <SettingRow
        label="Spaces"
        description="Toggle a space to mirror it. Expand to choose which lists sync."
      >
        <div className="flex w-full flex-col gap-2">
          {spaces.length === 0 ? (
            <span className="text-body-sm text-ink-soft">No spaces found.</span>
          ) : (
            spaces.map((space) => (
              <div
                key={space.id}
                className="rounded-md border border-[hsl(var(--border-subtle))]"
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleExpandSpace(space.id)}
                    className="flex flex-1 items-center gap-2 text-left text-body-sm font-medium text-ink"
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        expandedSpaceId === space.id ? "rotate-90" : ""
                      }`}
                    />
                    {space.color && (
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: space.color }}
                      />
                    )}
                    {space.name}
                  </button>
                  <Switch
                    checked={space.enabled}
                    disabled={space.enabled}
                    onCheckedChange={(checked) => {
                      if (checked) handleEnableSpace(space.id);
                    }}
                    aria-label={`Enable space ${space.name}`}
                  />
                </div>
                {expandedSpaceId === space.id && (
                  <div className="border-t border-[hsl(var(--border-subtle))] px-3 py-2">
                    {loadingLists === space.id ? (
                      <div className="flex items-center gap-2 text-body-sm text-ink-soft">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading lists...
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {(listsBySpace[space.id] ?? []).map((list) => (
                          <li
                            key={list.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-body-sm text-ink">
                              {list.folderName ? (
                                <span className="text-ink-mute">
                                  {list.folderName} /{" "}
                                </span>
                              ) : null}
                              {list.name}
                              <span className="ml-1.5 text-ink-mute">
                                ({list.taskCount})
                              </span>
                            </span>
                            <Switch
                              checked={list.enabled}
                              disabled={list.enabled}
                              onCheckedChange={(checked) => {
                                if (checked) handleEnableList(space.id, list.id);
                              }}
                              aria-label={`Enable list ${list.name}`}
                            />
                          </li>
                        ))}
                        {(listsBySpace[space.id] ?? []).length === 0 && (
                          <span className="text-body-sm text-ink-soft">
                            No lists in this space.
                          </span>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SettingRow>
    </SettingsSection>
  );
}
