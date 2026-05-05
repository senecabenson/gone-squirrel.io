import { useEffect, useRef, useState } from "react";

import { PiCaretDownBold } from "react-icons/pi";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { TaskStatus } from "@/types/task";

import { formatEnumValue, statusBadgeVariant } from "../utils/task-list-utils";

interface StatusFilterProps {
  value: TaskStatus[];
  onChange: (value: TaskStatus[]) => void;
}

export function StatusFilter({ value = [], onChange }: StatusFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (status: TaskStatus) => {
    const index = value.indexOf(status);
    if (index === -1) {
      onChange([...value, status]);
    } else {
      onChange(value.filter((s) => s !== status));
    }
  };

  const handleSelectAll = () => {
    onChange(Object.values(TaskStatus));
    setIsOpen(false);
  };

  const handleSelectNone = () => {
    onChange([]);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={filterRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 min-w-[140px] justify-between px-3"
      >
        <span className="truncate">
          {value.length === 0
            ? "All Status"
            : value.length === Object.keys(TaskStatus).length
              ? "All Status"
              : `${value.length} selected`}
        </span>
        <PiCaretDownBold
          className={`h-4 w-4 text-ink-mute transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </Button>
      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-52 rounded-md border border-[hsl(var(--border-subtle))] bg-surface py-1 shadow-lg">
          <div className="flex justify-between border-b border-[hsl(var(--border-subtle))] px-3 py-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-ink-soft hover:bg-transparent hover:text-ink"
              onClick={handleSelectAll}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-ink-soft hover:bg-transparent hover:text-ink"
              onClick={handleSelectNone}
            >
              Clear
            </Button>
          </div>
          {Object.values(TaskStatus).map((status) => (
            <label
              key={status}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-surface-sunken/60"
            >
              <Checkbox
                checked={value.includes(status)}
                onCheckedChange={() => handleChange(status)}
                className="h-3 w-3"
              />
              <Badge variant={statusBadgeVariant(status) as Parameters<typeof Badge>[0]["variant"]}>
                {formatEnumValue(status)}
              </Badge>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
