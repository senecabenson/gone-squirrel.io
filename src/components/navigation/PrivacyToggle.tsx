"use client";

import React from "react";

import { PiEyeDuotone, PiEyeClosedDuotone } from "react-icons/pi";

import { usePrivacy } from "@/components/providers/PrivacyProvider";

import { cn } from "@/lib/utils";

interface PrivacyToggleProps {
  className?: string;
}

export function PrivacyToggle({ className }: PrivacyToggleProps) {
  const { isPrivacyModeActive, togglePrivacyMode } = usePrivacy();

  return (
    <button
      onClick={togglePrivacyMode}
      className={cn(
        "privacy-mode-toggle inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-body-sm transition-colors",
        isPrivacyModeActive
          ? "bg-action-soft text-ink"
          : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
        className
      )}
      title={
        isPrivacyModeActive ? "Disable privacy mode" : "Enable privacy mode"
      }
      aria-pressed={isPrivacyModeActive}
    >
      {isPrivacyModeActive ? (
        <PiEyeClosedDuotone className="h-4 w-4" aria-hidden="true" />
      ) : (
        <PiEyeDuotone className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="sr-only md:not-sr-only md:inline">
        {isPrivacyModeActive ? "Privacy on" : "Privacy"}
      </span>
    </button>
  );
}
