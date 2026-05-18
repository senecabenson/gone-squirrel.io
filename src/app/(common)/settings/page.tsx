"use client";

import { useEffect, useMemo, useState } from "react";

import { AccountManager } from "@/components/settings/AccountManager";
import { AutoScheduleSettings } from "@/components/settings/AutoScheduleSettings";
import { CalendarSettings } from "@/components/settings/CalendarSettings";
import { ClickUpIntegrationSettings } from "@/components/settings/ClickUpIntegrationSettings";
import { ImportExportSettings } from "@/components/settings/ImportExportSettings";
import { IntegrationSettings } from "@/components/settings/IntegrationSettings";
import { LogViewer } from "@/components/settings/LogViewer";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { SystemSettings } from "@/components/settings/SystemSettings";
import { TaskSyncSettings } from "@/components/settings/TaskSyncSettings";
import { PersonalCommitments } from "@/components/settings/PersonalCommitments";
import { UserManagement } from "@/components/settings/UserManagement";
import { UserSettings } from "@/components/settings/UserSettings";

import { cn } from "@/lib/utils";

import { useAdmin } from "@/hooks/use-admin";

import { useSettingsStore } from "@/store/settings";

type SettingsTab =
  | "accounts"
  | "user"
  | "calendar"
  | "auto-schedule"
  | "commitments"
  | "integrations"
  | "clickup"
  | "system"
  | "task-sync"
  | "logs"
  | "user-management"
  | "import-export"
  | "notifications";

export default function SettingsPage() {
  const [isHydrated, setIsHydrated] = useState(false);
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const { initializeSettings } = useSettingsStore();

  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  const tabs = useMemo(() => {
    const baseTabs = [
      { id: "user", label: "Appearance" },
      { id: "accounts", label: "Accounts" },
      { id: "calendar", label: "Calendar" },
      { id: "auto-schedule", label: "Auto-schedule" },
      { id: "commitments", label: "Commitments" },
      { id: "integrations", label: "Integrations" },
      { id: "clickup", label: "ClickUp" },
      { id: "task-sync", label: "Task sync" },
      { id: "notifications", label: "Notifications" },
      { id: "import-export", label: "Import & export" },
    ] as const;

    if (isAdmin) {
      const adminTabs = [
        { id: "system", label: "System" },
        { id: "logs", label: "Logs" },
        { id: "user-management", label: "Users" },
      ] as const;
      return [...baseTabs, ...adminTabs] as const;
    }

    return baseTabs;
  }, [isAdmin]);

  const [activeTab, setActiveTab] = useState<SettingsTab>("user");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) as SettingsTab;
      const allPossibleTabIds: SettingsTab[] = [
        "accounts",
        "user",
        "calendar",
        "auto-schedule",
        "commitments",
        "integrations",
        "clickup",
        "task-sync",
        "system",
        "logs",
        "user-management",
        "import-export",
        "notifications",
      ];
      if (allPossibleTabIds.includes(hash)) setActiveTab(hash);
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) window.location.hash = activeTab;
  }, [activeTab, isHydrated]);

  const renderContent = () => {
    const adminOnlyTabs = ["system", "logs", "user-management"];

    if (adminOnlyTabs.includes(activeTab) && isAdminLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-section text-center">
          <span className="block h-3 w-3 animate-pulse rounded-full bg-action" />
          <p className="text-body-sm text-ink-soft">Checking access.</p>
        </div>
      );
    }

    if (adminOnlyTabs.includes(activeTab) && !isAdmin) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-section text-center">
          <h2 className="font-display text-display-sm text-ink">
            Admin access required.
          </h2>
          <p className="max-w-[44ch] text-body-sm text-ink-soft">
            You need administrator privileges to view this section.
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case "accounts":
        return <AccountManager />;
      case "user":
        return <UserSettings />;
      case "calendar":
        return <CalendarSettings />;
      case "auto-schedule":
        return <AutoScheduleSettings />;
      case "commitments":
        return <PersonalCommitments />;
      case "integrations":
        return <IntegrationSettings />;
      case "clickup":
        return <ClickUpIntegrationSettings />;
      case "task-sync":
        return <TaskSyncSettings />;
      case "notifications":
        return <NotificationSettings />;
      case "system":
        return <SystemSettings />;
      case "logs":
        return <LogViewer />;
      case "user-management":
        return <UserManagement />;
      case "import-export":
        return <ImportExportSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-section px-4 py-section md:px-block">
      {/* Page hero */}
      <header>
        <span className="text-meta uppercase tracking-wide text-ink-mute">
          Preferences
        </span>
        <h1 className="font-display text-display leading-[1.05] tracking-[-0.018em] text-ink">
          Settings
        </h1>
      </header>

      <div className="flex flex-col gap-section lg:flex-row lg:gap-section">
        {/* Sidebar nav — vertical on lg+, horizontal pills on smaller */}
        <aside className="flex-none lg:w-56">
          {/* Mobile / md: horizontal scroll pill bar */}
          <nav
            className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden"
            aria-label="Settings sections"
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-body-sm font-medium transition-colors",
                    active
                      ? "bg-surface-sunken text-ink"
                      : "text-ink-soft hover:bg-surface-sunken/60 hover:text-ink"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Desktop: vertical quiet menu, no card chrome */}
          <nav
            className="hidden flex-col gap-0.5 lg:flex"
            aria-label="Settings sections"
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={cn(
                    "group relative flex w-full items-center rounded-md px-3 py-2 text-left text-body-sm font-medium transition-colors",
                    !isHydrated && "duration-0",
                    active
                      ? "bg-surface-sunken text-ink"
                      : "text-ink-soft hover:bg-surface-sunken/60 hover:text-ink"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-action"
                    />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div
          className={cn(
            "flex-1 transition-opacity",
            !isHydrated && "opacity-0"
          )}
        >
          <div className="flex flex-col gap-section">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}
