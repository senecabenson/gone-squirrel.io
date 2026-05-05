import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { useSettingsStore } from "@/store/settings";

import { SettingRow, SettingsSection } from "./SettingsSection";

export function DataSettings() {
  const { data, updateDataSettings } = useSettingsStore();

  return (
    <SettingsSection
      title="Data Settings"
      description="Manage your calendar data and backup preferences."
    >
      <SettingRow
        label="Automatic Backup"
        description="Regularly backup your calendar data"
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-backup"
              checked={data.autoBackup}
              onCheckedChange={(checked) =>
                updateDataSettings({
                  autoBackup: checked,
                })
              }
            />
            <Label htmlFor="auto-backup" className="text-sm text-ink">
              Enable automatic backups
            </Label>
          </div>

          {data.autoBackup && (
            <div className="space-y-2">
              <Label className="text-sm text-ink">Backup Interval (days)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={data.backupInterval}
                onChange={(e) =>
                  updateDataSettings({
                    backupInterval: Number(e.target.value),
                  })
                }
              />
            </div>
          )}
        </div>
      </SettingRow>

      <SettingRow
        label="Data Retention"
        description="Configure how long to keep your calendar data"
      >
        <div className="space-y-2">
          <Label className="text-sm text-ink">Retain data for (days)</Label>
          <Input
            type="number"
            min="30"
            max="3650"
            value={data.retainDataFor}
            onChange={(e) =>
              updateDataSettings({
                retainDataFor: Number(e.target.value),
              })
            }
          />
          <p className="mt-1 text-sm text-ink-soft">
            Events older than this will be automatically archived
          </p>
        </div>
      </SettingRow>

      <SettingRow label="Export Data" description="Download your calendar data">
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline">
            Export as iCal
          </Button>
          <Button type="button" variant="outline">
            Export as JSON
          </Button>
        </div>
      </SettingRow>

      <SettingRow label="Clear Data" description="Remove all calendar data">
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            if (
              window.confirm(
                "Are you sure you want to clear all calendar data? This action cannot be undone."
              )
            ) {
              // TODO: Implement clear data functionality
            }
          }}
        >
          Clear All Data
        </Button>
      </SettingRow>
    </SettingsSection>
  );
}
