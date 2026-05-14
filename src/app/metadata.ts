import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "GoneSquirrel",
  description: "Calm-stimulation calendar + tasks for ADHD brains. Auto-scheduled, energy-aware, no shame.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/brand/icon-mark.png", type: "image/png", sizes: "any" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "GoneSquirrel",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#C2410C" },
    { media: "(prefers-color-scheme: dark)", color: "#16161A" },
  ],
};
