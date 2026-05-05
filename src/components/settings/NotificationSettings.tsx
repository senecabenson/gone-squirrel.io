import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { useSettingsStore } from "@/store/settings";

import { SettingRow, SettingsSection } from "./SettingsSection";

export function NotificationSettings() {
  const { notifications, updateNotificationSettings } = useSettingsStore();

  return (
    <SettingsSection
      title="Notification Settings"
      description="Configure your notification preferences."
    >
      <SettingRow
        label="Daily Email Updates"
        description="Receive a daily email with your upcoming meetings and tasks"
      >
        <div className="flex items-center space-x-2">
          <Switch
            id="daily-email"
            checked={notifications.dailyEmailEnabled}
            onCheckedChange={(checked) =>
              updateNotificationSettings({
                dailyEmailEnabled: checked,
              })
            }
          />
          <Label htmlFor="daily-email" className="text-sm text-ink">
            Enable daily email updates
          </Label>
        </div>
      </SettingRow>

      <div className="mt-4 text-sm text-ink-mute">
        More notification settings coming soon. You&apos;ll be able to customize
        event reminders, updates, and more.
      </div>
    </SettingsSection>
  );
}
