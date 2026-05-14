"use client";

import { useEffect, useState } from "react";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import BrandSplash from "@/components/brand/BrandSplash";
import Landing from "@/components/landing/Landing";

const MIN_SPLASH_MS = 1800;

export default function HomeRedirect() {
  const { status } = useSession();
  const router = useRouter();
  const [minHeld, setMinHeld] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinHeld(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (minHeld && status === "authenticated") {
      router.replace("/calendar");
    }
  }, [minHeld, status, router]);

  if (!minHeld || status === "loading" || status === "authenticated") {
    return <BrandSplash />;
  }

  return <Landing />;
}
