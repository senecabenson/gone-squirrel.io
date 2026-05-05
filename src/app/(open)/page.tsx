"use client";

import { useEffect } from "react";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * Public root for the open build. Personal-use fork — no marketing landing
 * needed. Punt straight to the calendar (if signed in) or sign-in.
 */
export default function HomeRedirect() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    router.replace(status === "authenticated" ? "/calendar" : "/auth/signin");
  }, [status, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-canvas">
      <span className="block h-3 w-3 animate-pulse rounded-full bg-action" />
      <p className="text-body-sm text-ink-soft">One moment.</p>
    </div>
  );
}
