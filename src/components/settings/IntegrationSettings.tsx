import { useSession } from "next-auth/react";

import { BsGoogle } from "react-icons/bs";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { useSettingsStore } from "@/store/settings";

import { SettingRow, SettingsSection } from "./SettingsSection";

export function IntegrationSettings() {
  const { data: session } = useSession();
  const { integrations, updateIntegrationSettings } = useSettingsStore();

  return (
    <SettingsSection
      title="Integration Settings"
      description="Manage your calendar integrations and synchronization settings."
    >
      <SettingRow
        label="Google Calendar"
        description="Configure your Google Calendar integration"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BsGoogle className="h-6 w-6 text-ink-mute" />
              <div>
                <div className="font-medium text-ink">Google Calendar</div>
                <div className="text-sm text-ink-soft">
                  {session?.user?.email || "Not connected"}
                </div>
              </div>
            </div>
            <Switch
              checked={integrations.googleCalendar.enabled}
              onCheckedChange={(checked) =>
                updateIntegrationSettings({
                  googleCalendar: {
                    ...integrations.googleCalendar,
                    enabled: checked,
                  },
                })
              }
            />
          </div>

          {integrations.googleCalendar.enabled && (
            <>
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-sync"
                  checked={integrations.googleCalendar.autoSync}
                  onCheckedChange={(checked) =>
                    updateIntegrationSettings({
                      googleCalendar: {
                        ...integrations.googleCalendar,
                        autoSync: checked,
                      },
                    })
                  }
                />
                <Label htmlFor="auto-sync" className="text-sm text-ink">
                  Enable auto-sync
                </Label>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-ink">
                  Sync Interval (minutes)
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={integrations.googleCalendar.syncInterval}
                  onChange={(e) =>
                    updateIntegrationSettings({
                      googleCalendar: {
                        ...integrations.googleCalendar,
                        syncInterval: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </>
          )}
        </div>
      </SettingRow>
    </SettingsSection>
  );
}
