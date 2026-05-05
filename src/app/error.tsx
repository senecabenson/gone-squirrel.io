"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { inter } from "@/lib/fonts";

import "../app/globals.css";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Use client-side rendering to avoid hydration issues
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set document title on the client side
    document.title = "Error - FluidCalendar";
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  // Only render the full content after mounting on the client
  if (!mounted) {
    return null;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="description" content="An error occurred" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-canvas text-foreground">
          <h1 className="font-display text-display mb-4">Hmm, that didn&apos;t work.</h1>
          <p className="mb-6 max-w-[44ch] text-ink-soft">Not your fault. Want to try again, or head home?</p>
          <div className="flex space-x-4">
            <button
              onClick={reset}
              className="bg-action text-action-on hover:bg-action-hover px-4 py-2 rounded-md font-medium"
            >
              Try again
            </button>
            <Link
              href="/"
              className="bg-action-soft text-ink border border-[hsl(var(--border-default))] hover:bg-surface-sunken px-4 py-2 rounded-md font-medium"
            >
              Return home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
