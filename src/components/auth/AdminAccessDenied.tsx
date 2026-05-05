"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function AdminAccessDenied() {
  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <h1 className="mb-3 font-display text-display leading-[1.05] tracking-[-0.018em] text-ink">
        Looks like this section&apos;s locked.
      </h1>
      <p className="mb-8 max-w-sm text-body text-ink-soft">
        Ask an admin if you need access here.
      </p>
      <Button variant="outline" onClick={() => router.push("/")}>
        Back to home
      </Button>
    </div>
  );
}
