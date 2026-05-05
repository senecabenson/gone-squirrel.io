"use client";

import { useTheme } from "next-themes";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={3200}
      toastOptions={{
        classNames: {
          toast:
            "group toast " +
            "group-[.toaster]:bg-[hsl(var(--bg-surface-raised))] " +
            "group-[.toaster]:text-[hsl(var(--text-primary))] " +
            "group-[.toaster]:border " +
            "group-[.toaster]:border-[hsl(var(--border-subtle))] " +
            "group-[.toaster]:rounded-xl " +
            "group-[.toaster]:shadow-card " +
            "group-[.toaster]:font-sans",
          title: "group-[.toast]:text-body-sm group-[.toast]:font-medium",
          description: "group-[.toast]:text-body-sm group-[.toast]:text-[hsl(var(--text-secondary))]",
          actionButton:
            "group-[.toast]:bg-[hsl(var(--action-primary))] group-[.toast]:text-[hsl(var(--action-on-accent))] group-[.toast]:hover:bg-[hsl(var(--action-primary-hover))]",
          cancelButton:
            "group-[.toast]:bg-transparent group-[.toast]:text-[hsl(var(--text-secondary))] group-[.toast]:hover:bg-[hsl(var(--bg-sunken))]",
          success:
            "group-[.toaster]:border-[hsl(var(--state-complete)/0.4)]",
          error:
            "group-[.toaster]:border-[hsl(var(--urgency-critical)/0.4)]",
          warning:
            "group-[.toaster]:border-[hsl(var(--urgency-soon)/0.4)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
