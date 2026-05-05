"use client";

import { useSession } from "next-auth/react";
import Image from "next/image";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { useSettingsStore } from "@/store/settings";

import { TimeFormat, WeekStartDay } from "@/types/settings";

import { SettingRow, SettingsSection } from "./SettingsSection";

const TIME_FORMATS: { value: TimeFormat; label: string }[] = [
  { value: "12h", label: "12-hour" },
  { value: "24h", label: "24-hour" },
];

const WEEK_STARTS: { value: WeekStartDay; label: string }[] = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
];

const TIME_ZONES = [
  "UTC",
  "America/Anchorage",
  "America/Chicago",
  "America/Denver",
  "America/Edmonton",
  "America/Halifax",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Montreal",
  "America/New_York",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "America/Winnipeg",
  "America/Bogota",
  "America/Buenos_Aires",
  "America/Caracas",
  "America/Lima",
  "America/Santiago",
  "America/Sao_Paulo",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Budapest",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Jerusalem",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Darwin",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Honolulu",
];

export function UserSettings() {
  const { data: session } = useSession();
  const {
    user,
    updateUserSettings,
    motionEnabled,
    setMotionEnabled,
    iconLabelsHidden,
    setIconLabelsHidden,
    themeMode,
    setThemeMode,
    colorMode,
    setColorMode,
    contrast,
    setContrast,
    timeOfDayShift,
    setTimeOfDayShift,
    gamificationEnabled,
    setGamificationEnabled,
  } = useSettingsStore();

  return (
    <div className="flex flex-col gap-section">
      {/* Profile + locale */}
      <SettingsSection
        title="Account"
        description="How time and dates show up across your calendar."
      >
        {session?.user && (
          <SettingRow label="Profile" description="Signed in as">
            <div className="flex items-center gap-3">
              {session.user.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || ""}
                  width={36}
                  height={36}
                  className="rounded-full"
                />
              )}
              <div className="flex flex-col">
                <span className="text-body-sm font-medium text-ink">
                  {session.user.name}
                </span>
                <span className="text-body-sm text-ink-soft">
                  {session.user.email}
                </span>
              </div>
            </div>
          </SettingRow>
        )}

        <SettingRow
          label="Time format"
          description="12-hour or 24-hour clock."
        >
          <Select
            value={user.timeFormat}
            onValueChange={(value) =>
              updateUserSettings({ timeFormat: value as TimeFormat })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_FORMATS.map((format) => (
                <SelectItem key={format.value} value={format.value}>
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="Week starts on"
          description="Choose the day your week starts."
        >
          <Select
            value={user.weekStartDay}
            onValueChange={(value) =>
              updateUserSettings({ weekStartDay: value as WeekStartDay })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEK_STARTS.map((day) => (
                <SelectItem key={day.value} value={day.value}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label="Time zone" description="Your local zone.">
          <Select
            value={user.timeZone}
            onValueChange={(value) => updateUserSettings({ timeZone: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {TIME_ZONES.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      {/* Appearance — design system toggles */}
      <SettingsSection
        title="Appearance"
        description="Tune the look so the app feels calm, not loud."
      >
        <SettingRow
          label="Theme"
          description="Light, dark, or follow your system."
        >
          <Select
            value={themeMode}
            onValueChange={(v) => setThemeMode(v as typeof themeMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow
          label="Time-of-day shift"
          description="Subtle warmth shift through the day. Cooler in the morning, softer in the evening."
        >
          <Switch
            checked={timeOfDayShift}
            onCheckedChange={setTimeOfDayShift}
            aria-label="Toggle time-of-day color shift"
          />
        </SettingRow>
      </SettingsSection>

      {/* Sensory — accessibility */}
      <SettingsSection
        title="Sensory regulation"
        description="When you need the app to go quiet."
      >
        <SettingRow
          label="Motion"
          description="Animations and transitions. Off cuts everything to the bone."
        >
          <Switch
            checked={motionEnabled}
            onCheckedChange={setMotionEnabled}
            aria-label="Toggle motion"
          />
        </SettingRow>

        <SettingRow
          label="Reduced color"
          description="Strips category colors. Categories show up as shape and position only."
        >
          <Switch
            checked={colorMode === "reduced"}
            onCheckedChange={(on) => setColorMode(on ? "reduced" : "full")}
            aria-label="Toggle reduced color mode"
          />
        </SettingRow>

        <SettingRow
          label="High contrast"
          description="Stronger borders and deeper text for readability."
        >
          <Switch
            checked={contrast === "high"}
            onCheckedChange={(on) => setContrast(on ? "high" : "normal")}
            aria-label="Toggle high contrast"
          />
        </SettingRow>

        <SettingRow
          label="Icon labels"
          description="Show text under icons. Helpful while learning the layout."
        >
          <Switch
            checked={!iconLabelsHidden}
            onCheckedChange={(on) => setIconLabelsHidden(!on)}
            aria-label="Toggle icon labels"
          />
        </SettingRow>
      </SettingsSection>

      {/* Gamification */}
      <SettingsSection
        title="Gamification"
        description="Streaks, momentum, and quiet rewards. Off by default. Turn on if it helps you, off if it doesn't — no shame either way."
      >
        <SettingRow
          label="Gamification"
          description="When off, completion is a quiet checkmark. When on, gentle rewards for showing up."
        >
          <Switch
            checked={gamificationEnabled}
            onCheckedChange={setGamificationEnabled}
            aria-label="Toggle gamification"
          />
        </SettingRow>
      </SettingsSection>
    </div>
  );
}
