"use client";

import { BottomTabs } from "@/components/navigation/BottomTabs";
import { LeftRail } from "@/components/navigation/LeftRail";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Responsive shell. Web (≥md) gets a sticky left rail; mobile gets a fixed
 * bottom tab bar. Content area handles its own scroll. The mobile content
 * gets bottom padding equal to the tab bar height so nothing hides under it.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen w-full bg-canvas text-ink">
      <LeftRail />
      <main className="relative flex-1 overflow-x-hidden pb-16 md:pb-0">
        {children}
      </main>
      <BottomTabs />
    </div>
  );
}
