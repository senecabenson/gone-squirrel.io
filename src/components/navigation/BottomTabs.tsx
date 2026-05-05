"use client";

import { useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  PiCalendarBlankDuotone,
  PiDotsThreeOutlineDuotone,
  PiListChecksDuotone,
  PiTargetDuotone,
} from "react-icons/pi";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet-mobile";

import { cn } from "@/lib/utils";

import { PrivacyToggle } from "./PrivacyToggle";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

interface Tab {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type: "link" | "menu";
}

const tabs: Tab[] = [
  { href: "/calendar", label: "Calendar", icon: PiCalendarBlankDuotone, type: "link" },
  { href: "/tasks", label: "Tasks", icon: PiListChecksDuotone, type: "link" },
  { href: "/focus", label: "Now", icon: PiTargetDuotone, type: "link" },
  { label: "Menu", icon: PiDotsThreeOutlineDuotone, type: "menu" },
];

export function BottomTabs() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 h-16 border-t border-[hsl(var(--border-subtle))] bg-canvas/95 backdrop-blur"
      aria-label="Primary"
    >
      <ul className="flex h-full items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.type === "link" && tab.href) {
            const isActive =
              tab.href === pathname ||
              (tab.href !== "/" && pathname?.startsWith(tab.href));

            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-1 rounded-md transition-colors",
                    isActive ? "text-ink" : "text-ink-mute"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                      isActive && "bg-action-soft"
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key="menu" className="flex-1">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-mute"
                    aria-label="More"
                  >
                    <span className="flex h-8 w-12 items-center justify-center rounded-full">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-[10px] font-medium tracking-wide">Menu</span>
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom">
                  <div className="flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between rounded-md bg-surface-sunken/60 px-4 py-3 text-body text-ink"
                    >
                      <span>Settings</span>
                      <span aria-hidden="true">›</span>
                    </Link>
                    <div className="flex items-center justify-between rounded-md bg-surface-sunken/60 px-4 py-3">
                      <span className="text-body text-ink">Theme</span>
                      <ThemeToggle />
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-surface-sunken/60 px-4 py-3">
                      <span className="text-body text-ink">Privacy</span>
                      <PrivacyToggle />
                    </div>
                    <div className="flex items-center justify-between rounded-md bg-surface-sunken/60 px-4 py-3">
                      <span className="text-body text-ink">Account</span>
                      <UserMenu />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
