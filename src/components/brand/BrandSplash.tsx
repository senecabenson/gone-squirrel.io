import { IconMark } from "@/components/brand/svg/IconMark";
import { WordmarkTagline } from "@/components/brand/svg/WordmarkTagline";

export default function BrandSplash() {
  return (
    <main
      aria-label="GoneSquirrel splash"
      className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center gap-6 overflow-hidden px-6 py-6 text-ink"
    >
      <div className="animate-in fade-in zoom-in-95 duration-700">
        <div
          className="animate-pulse"
          style={{
            width: "clamp(80px, 10vmin, 160px)",
            height: "clamp(80px, 10vmin, 160px)",
          }}
        >
          <IconMark className="w-full h-auto" />
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200 fill-mode-both">
        <WordmarkTagline
          className="h-auto"
          style={{ width: "clamp(280px, 32vmin, 520px)" }}
        />
      </div>
    </main>
  );
}
