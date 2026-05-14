"use client";

import Link from "next/link";

import { IconMark } from "@/components/brand/svg/IconMark";
import { usePathname } from "next/navigation";

import {
  PiCalendarBlankDuotone,
  PiCaretDoubleLeftBold,
  PiCaretDoubleRightBold,
  PiKeyboardDuotone,
  PiListChecksDuotone,
  PiMagnifyingGlassDuotone,
  PiTargetDuotone,
} from "react-icons/pi";

import { cn } from "@/lib/utils";

import { useSettingsStore } from "@/store/settings";
import { useShortcutsStore } from "@/store/shortcuts";

import { PrivacyToggle } from "./PrivacyToggle";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const links: NavLink[] = [
  { href: "/calendar", label: "Calendar", icon: PiCalendarBlankDuotone },
  { href: "/tasks", label: "Tasks", icon: PiListChecksDuotone },
  { href: "/focus", label: "Now", icon: PiTargetDuotone },
];

export function LeftRail() {
  const pathname = usePathname();
  const { setOpen: setShortcutsOpen } = useShortcutsStore();
  const collapsed = useSettingsStore((s) => s.leftRailCollapsed);
  const setCollapsed = useSettingsStore((s) => s.setLeftRailCollapsed);

  const openCommandPalette = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <aside
      className={cn(
        "hidden md:flex h-screen sticky top-0 shrink-0 flex-col border-r border-[hsl(var(--border-subtle))] bg-canvas py-6 transition-[width] duration-200 ease-out",
        collapsed ? "w-16 px-2" : "w-60 px-4"
      )}
      aria-label="Primary navigation"
    >
      {/* Brand */}
      <Link
        href="/calendar"
        className={cn(
          "mb-section flex items-center",
          collapsed ? "justify-center px-0" : "px-2"
        )}
        aria-label="GoneSquirrel home"
        title={collapsed ? "GoneSquirrel" : undefined}
      >
        <IconMark className="h-12 w-12 shrink-0" />
        {!collapsed && (
          <>
            <img
              src="/brand/svg/wordmark-green.svg"
              alt="GoneSquirrel.io"
              className="block h-7 w-auto -ml-2 dark:hidden"
            />
            <img
              src="/brand/svg/wordmark-green-dark.svg"
              alt="GoneSquirrel.io"
              className="hidden h-7 w-auto -ml-2 dark:block"
            />
          </>
        )}
      </Link>

      {/* Primary nav */}
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive =
            link.href === pathname ||
            (link.href !== "/" && pathname?.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "group relative flex items-center rounded-md text-body-sm font-medium transition-colors",
                collapsed
                  ? "h-10 w-12 justify-center"
                  : "gap-3 px-3 py-2.5",
                isActive
                  ? "text-ink bg-surface-sunken"
                  : "text-ink-soft hover:text-ink hover:bg-surface-sunken/60"
              )}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? link.label : undefined}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-action"
                />
              )}
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Quick actions */}
      <div className="mt-block flex flex-col gap-1">
        <button
          onClick={openCommandPalette}
          className={cn(
            "flex items-center rounded-md text-body-sm text-ink-soft transition-colors hover:bg-surface-sunken/60 hover:text-ink",
            collapsed
              ? "h-10 w-12 justify-center"
              : "gap-3 px-3 py-2"
          )}
          title="Search or run a command (⌘K)"
        >
          <PiMagnifyingGlassDuotone className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!collapsed && (
            <>
              <span>Search</span>
              <kbd className="ml-auto rounded border border-[hsl(var(--border-subtle))] bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-mute">
                ⌘K
              </kbd>
            </>
          )}
        </button>
        <button
          onClick={() => setShortcutsOpen(true)}
          className={cn(
            "flex items-center rounded-md text-body-sm text-ink-soft transition-colors hover:bg-surface-sunken/60 hover:text-ink",
            collapsed
              ? "h-10 w-12 justify-center"
              : "gap-3 px-3 py-2"
          )}
          title="Keyboard shortcuts"
        >
          <PiKeyboardDuotone className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!collapsed && (
            <>
              <span>Shortcuts</span>
              <kbd className="ml-auto rounded border border-[hsl(var(--border-subtle))] bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-mute">
                ?
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Footer */}
      <div
        className={cn(
          "mt-auto flex border-t border-[hsl(var(--border-subtle))] pt-block",
          collapsed
            ? "flex-col items-center gap-2"
            : "items-center justify-between gap-2"
        )}
      >
        <UserMenu />
        {!collapsed && (
          <div className="flex items-center gap-1">
            <PrivacyToggle />
            <ThemeToggle />
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-mute transition-colors hover:bg-surface-sunken hover:text-ink"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PiCaretDoubleRightBold className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PiCaretDoubleLeftBold className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </aside>
  );
}
