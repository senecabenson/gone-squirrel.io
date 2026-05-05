import { PiCaretDownBold, PiCaretUpBold } from "react-icons/pi";

import { cn } from "@/lib/utils";

type SortableColumn =
  | "title"
  | "dueDate"
  | "startDate"
  | "status"
  | "project"
  | "schedule"
  | "priority"
  | "energyLevel"
  | "preferredTime"
  | "duration";

interface SortableHeaderProps {
  column: SortableColumn;
  label: string;
  currentSort: string;
  direction: "asc" | "desc";
  onSort: (column: SortableColumn) => void;
  className?: string;
}

export function SortableHeader({
  column,
  label,
  currentSort,
  direction,
  onSort,
  className = "",
}: SortableHeaderProps) {
  return (
    <th
      scope="col"
      className={cn(
        "group cursor-pointer px-3 py-2 text-left text-meta font-semibold uppercase tracking-wide text-ink-mute hover:text-ink",
        className
      )}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={currentSort === column ? "text-ink" : "text-ink-mute/40"}>
          {currentSort === column ? (
            direction === "asc" ? (
              <PiCaretUpBold className="h-3 w-3" />
            ) : (
              <PiCaretDownBold className="h-3 w-3" />
            )
          ) : (
            <PiCaretDownBold className="h-3 w-3 opacity-0 group-hover:opacity-50" />
          )}
        </span>
      </div>
    </th>
  );
}
