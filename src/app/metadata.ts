import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GoneSquirrel",
  description: "Calm-stimulation calendar + tasks for ADHD brains. Auto-scheduled, energy-aware, no shame.",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/logo.svg", type: "image/svg+xml", sizes: "64x64" },
    ],
    apple: [{ url: "/logo.svg", type: "image/svg+xml", sizes: "180x180" }],
  },
};
