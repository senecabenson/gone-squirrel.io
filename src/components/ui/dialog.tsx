"use client";

import * as React from "react";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-canvas/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> & {
  /**
   * `dialog` (default): centered modal on all viewports.
   * `sheet`: bottom sheet on mobile (<sm), centered modal on sm+.
   */
  variant?: "dialog" | "sheet";
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, variant = "dialog", ...props }, ref) => {
  const sheetClass =
    variant === "sheet"
      ? // Mobile: bottom sheet. sm+: centered modal.
        "fixed inset-x-0 bottom-0 z-50 grid w-full max-h-[90vh] gap-block rounded-t-2xl border-t border-[hsl(var(--border-subtle))] bg-surface-raised p-block shadow-raised overflow-y-auto " +
        "data-[state=open]:animate-in data-[state=closed]:animate-out " +
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom " +
        "sm:left-1/2 sm:top-1/2 sm:right-auto sm:bottom-auto sm:inset-x-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:max-h-[85vh] " +
        "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 " +
        "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0"
      : "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-block rounded-2xl border border-[hsl(var(--border-subtle))] bg-surface-raised p-block shadow-raised duration-200 max-h-[85vh] overflow-y-auto " +
        "data-[state=open]:animate-in data-[state=closed]:animate-out " +
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 " +
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(sheetClass, className)}
        {...props}
      >
        {/* Sheet grab handle on mobile */}
        {variant === "sheet" && (
          <div className="sm:hidden mx-auto -mt-1 mb-2 h-1 w-10 rounded-full bg-[hsl(var(--border-default))]" />
        )}
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1 text-ink-soft opacity-70 transition-all hover:bg-surface-sunken hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-action/40 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-2 text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "font-display text-display-sm leading-tight tracking-[-0.014em] text-ink",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-body-sm text-ink-soft", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
