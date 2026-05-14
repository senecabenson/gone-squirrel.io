"use client";

import { useEffect, useState } from "react";

import { usePathname } from "next/navigation";

import BrandSplash from "@/components/brand/BrandSplash";
import { getTitleFromPathname } from "@/lib/utils/page-title";

import "../app/globals.css";

export default function Loading() {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const title = getTitleFromPathname(pathname);
    document.title = `Loading ${title}`;
  }, [pathname]);

  if (!mounted) {
    return null;
  }

  return <BrandSplash />;
}
