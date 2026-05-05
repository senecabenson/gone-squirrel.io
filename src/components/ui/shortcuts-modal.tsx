"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { commandRegistry } from "@/lib/commands/registry";
import { Command } from "@/lib/commands/types";
import { formatShortcut } from "@/lib/utils";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const commandsBySection = commandRegistry.getAll().reduce(
    (acc, command) => {
      if (command.shortcut) {
        if (!acc[command.section]) acc[command.section] = [];
        acc[command.section].push(command);
      }
      return acc;
    },
    {} as Record<Command["section"], Command[]>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-block">
          {Object.entries(commandsBySection).map(([section, commands]) => (
            <div key={section} className="flex flex-col gap-2">
              <h3 className="text-meta uppercase tracking-wide text-ink-mute">
                {section}
              </h3>
              <ul className="flex flex-col gap-1">
                {commands.map((command) => (
                  <li
                    key={command.id}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-body-sm hover:bg-surface-sunken/40"
                  >
                    <span className="text-ink">{command.title}</span>
                    {formatShortcut(command.shortcut) && (
                      <kbd className="shrink-0 rounded border border-[hsl(var(--border-subtle))] bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">
                        {formatShortcut(command.shortcut)}
                      </kbd>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
