"use client";

import { useEffect, useState } from "react";

import { PiMagnifyingGlassDuotone } from "react-icons/pi";

import { cn } from "@/lib/utils";

export function CommandPaletteFab() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const openCommandPalette = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <button
      onClick={openCommandPalette}
      className={cn(
        // Position: above bottom tab bar on mobile (h-16 + safe-area), normal on desktop
        "fixed right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full",
        "bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] md:bottom-4",
        "bg-action text-action-on shadow-raised",
        "hover:bg-action-hover focus:outline-none focus:ring-2 focus:ring-action/40 focus:ring-offset-2 focus:ring-offset-canvas",
        "transition-all duration-200 ease-out",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      )}
      aria-label="Open command palette"
      title="Search or run a command (⌘K)"
    >
      <PiMagnifyingGlassDuotone className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
