import * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Action accent — single-color discipline. Use ONLY for primary CTA.
        default:
          "bg-action text-action-on hover:bg-action-hover active:bg-action-pressed",
        // True emergency only
        destructive:
          "bg-[hsl(var(--urgency-critical))] text-white hover:bg-[hsl(var(--urgency-critical)/0.9)]",
        // Quiet support — paired with a default in the same row
        outline:
          "border border-[hsl(var(--border-default))] bg-surface text-ink hover:bg-surface-sunken",
        secondary:
          "bg-action-soft text-ink hover:bg-surface-sunken",
        ghost:
          "text-ink hover:bg-surface-sunken",
        link:
          "text-action underline-offset-4 hover:underline",
        // Subtle text-only action — for utility rows that shouldn't pull the eye
        subtle:
          "text-ink-soft hover:text-ink hover:bg-surface-sunken",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6 text-body",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
