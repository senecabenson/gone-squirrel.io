"use client";

import { useEffect, useState } from "react";

import dynamic from "next/dynamic";

import { DndProvider } from "@/components/dnd/DndProvider";
import { StickyPomodoroBanner } from "@/components/focus/StickyPomodoroBanner";
import { AppShell } from "@/components/layout/AppShell";
import { PrivacyProvider } from "@/components/providers/PrivacyProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { SetupCheck } from "@/components/setup/SetupCheck";
import { CommandPalette } from "@/components/ui/command-palette";
import { CommandPaletteFab } from "@/components/ui/command-palette-fab";
import { CommandPaletteHint } from "@/components/ui/command-palette-hint";
import { ShortcutsModal } from "@/components/ui/shortcuts-modal";
import { Toaster } from "@/components/ui/sonner";

import { usePageTitle } from "@/hooks/use-page-title";

import { useShortcutsStore } from "@/store/shortcuts";

import "../globals.css";

const NotificationProvider = dynamic<{ children: React.ReactNode }>(
  () =>
    import("@/components/providers/NotificationProvider").then(
      (mod) => mod.NotificationProvider
    ),
  {
    ssr: false,
    loading: () => <>{/* Render nothing while loading */}</>,
  }
);

export default function CommonLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { isOpen: shortcutsOpen, setOpen: setShortcutsOpen } =
    useShortcutsStore();

  usePageTitle();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      } else if (e.key === "?" && !(e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setShortcutsOpen]);

  return (
    <SessionProvider>
      <PrivacyProvider>
        <DndProvider>
          <SetupCheck />
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
          />
          <CommandPaletteHint />
          <CommandPaletteFab />
          <ShortcutsModal
            isOpen={shortcutsOpen}
            onClose={() => setShortcutsOpen(false)}
          />
          <AppShell>
            <StickyPomodoroBanner />
            <NotificationProvider>{children}</NotificationProvider>
          </AppShell>
          <Toaster />
        </DndProvider>
      </PrivacyProvider>
    </SessionProvider>
  );
}
