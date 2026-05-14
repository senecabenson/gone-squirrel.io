import { Providers } from "@/components/providers";
import { metadata as baseMetadata } from "./metadata";
import { cn } from "@/lib/utils";
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono, Nunito } from "next/font/google";

const displayFont = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-body",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono",
});

const brandFont = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata = baseMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn("h-full", displayFont.variable, bodyFont.variable, monoFont.variable, brandFont.variable)}
      suppressHydrationWarning
    >
      <body className="flex h-full flex-col bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
