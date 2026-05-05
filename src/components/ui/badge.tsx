import * as React from "react";

import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Badges live as quiet metadata — never the primary attention pull.
// `meta` typography: uppercase, tracked, semibold, small.
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-meta uppercase tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-action/30",
  {
    variants: {
      variant: {
        default: "bg-surface-sunken text-ink-soft",
        secondary: "bg-action-soft text-ink",
        outline: "border border-[hsl(var(--border-subtle))] text-ink-soft",
        // Urgency — temperature, never alarms (unless `critical`)
        "urgency-soon": "bg-[hsl(var(--urgency-soon)/0.18)] text-[hsl(var(--urgency-soon))]",
        "urgency-today": "bg-[hsl(var(--urgency-today)/0.18)] text-[hsl(var(--urgency-today))]",
        "urgency-now": "bg-[hsl(var(--urgency-now)/0.18)] text-[hsl(var(--urgency-now))]",
        "urgency-overdue-soft": "bg-[hsl(var(--urgency-overdue-soft)/0.18)] text-[hsl(var(--urgency-overdue-soft))]",
        critical: "bg-[hsl(var(--urgency-critical))] text-white",
        // State
        "state-progress": "border-l-2 border-[hsl(var(--state-in-progress))] bg-[hsl(var(--state-in-progress)/0.12)] text-[hsl(var(--state-in-progress))] rounded-l-none rounded-r-full pl-2",
        "state-complete": "bg-[hsl(var(--state-complete)/0.4)] text-[hsl(var(--state-complete))]",
        "state-blocked": "bg-surface-sunken text-ink-mute",
        "state-scheduled": "bg-[hsl(var(--state-scheduled)/0.18)] text-[hsl(var(--state-scheduled))]",
        "state-captured": "bg-[hsl(var(--state-captured)/0.18)] text-[hsl(var(--state-captured))]",
        // Domain — use soft variant 90% of time
        "dom-sage": "bg-dom-sage-soft text-dom-sage",
        "dom-dust": "bg-dom-dust-soft text-dom-dust",
        "dom-clay": "bg-dom-clay-soft text-dom-clay",
        "dom-plum": "bg-dom-plum-soft text-dom-plum",
        "dom-mustard": "bg-dom-mustard-soft text-dom-mustard",
        "dom-slate": "bg-dom-slate-soft text-dom-slate",
        // Legacy alias kept for any caller that still passes "destructive"
        destructive: "bg-[hsl(var(--urgency-now)/0.18)] text-[hsl(var(--urgency-now))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
