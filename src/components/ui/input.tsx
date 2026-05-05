import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[hsl(var(--border-subtle))] bg-surface-sunken px-3 py-2 text-body-sm text-ink transition-colors",
          "file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-ink",
          "placeholder:text-ink-mute",
          "focus-visible:outline-none focus-visible:border-[hsl(var(--border-default))] focus-visible:ring-2 focus-visible:ring-action/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
