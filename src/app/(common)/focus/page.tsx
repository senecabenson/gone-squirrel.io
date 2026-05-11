"use client";

import { FocusMode } from "@/components/focus/FocusMode";
import { FocusModeToggle } from "@/components/focus/FocusModeToggle";
import { NowMode } from "@/components/focus/NowMode";

import { useSettingsStore } from "@/store/settings";

export default function FocusModePage() {
  const view = useSettingsStore((s) => s.focusModeView);
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-end px-4 pt-3">
        <FocusModeToggle />
      </div>
      <div className="flex-1 overflow-y-auto">
        {view === "now" ? <NowMode /> : <FocusMode />}
      </div>
    </div>
  );
}
