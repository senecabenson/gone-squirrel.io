# Brand Rollout — Session Handoff

**Date:** 2026-05-13
**Status:** Landing + splash + signin + nav rewired with new logo system. PWA manifest live. Dark mode wired. Open issue: landing responsive scaling — design not yet feeling "right" to Seneca across screen sizes.

## What's Done

### Brand assets (`public/brand/`)
Generated from sources at `~/Documents/GoneSquirrel.io/`:

| File | Use | Source / Notes |
|---|---|---|
| `icon-mark.png` (395×395) | Squircle swirl mark, app icon, favicon, nav | PIL-cropped from `GoneSquirrelIconSoloTransparent.png` to remove transparent padding (was 38% squircle / 62% empty) |
| `wordmark-squirrel.png` (798×250) | Hero wordmark, splash, signin | PIL-cropped from `GoneSquirrelWithWordsTransparent.png` to remove vertical whitespace |
| `wordmark-squirrel-dark.png` (798×250) | Dark-mode variant | PIL HLS-invert (hue preserved, lightness flipped) — walnut text → cream, line art → light rust |
| `apple-touch-icon.png` (180×180) | iOS Add to Home Screen | sips-resized from icon-mark |
| `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | PWA manifest | sips-resized |
| `favicon-16.png`, `favicon-32.png` | Browser tab | sips-resized |

`wordmark-horizontal.svg` was **scrapped** — source was 2.7MB raster embedded in SVG, not a real vector. Composed lockup from icon-mark + display text in AppNav instead.

### Files Modified

- `src/app/metadata.ts` — PWA icons, apple-touch-icon, manifest link, appleWebApp config, viewport themeColor `#C2410C`
- `public/manifest.webmanifest` (NEW) — PWA standalone, background `#FAF7F2`, theme `#C2410C`, icons 192/512/maskable
- `src/components/brand/BrandSplash.tsx` (NEW) — Reusable splash: icon mark 128px (animate-pulse + fade-in zoom-in-95) + squirrel wordmark 400×125 (fade-in slide-in-from-bottom delayed). Grain texture bg. Dark-mode swap.
- `src/components/landing/Landing.tsx` (NEW) — Hero: wordmark 720px max + tagline (text-2xl md:text-display) + sub + rust CTA. Grain texture bg. Currently using max-w/breakpoint sizing, NOT fluid clamp (see open issue below).
- `src/app/(open)/page.tsx` — splash for 1800ms minimum hold, then Landing (unauth) or redirect to /calendar (auth)
- `src/app/(common)/auth/signin/page.tsx` — Wraps SignInForm with squirrel wordmark hero
- `src/app/loading.tsx` — Replaced bare pulse-dot with BrandSplash
- `src/components/navigation/AppNav.tsx` — Top bar: icon-mark 32px + "GoneSquirrel.io" display text
- `src/components/navigation/LeftRail.tsx` — Sidebar: icon-mark 32px (collapsed/expanded), "GoneSquirrel" display text when expanded

### Brand Color System (already in `globals.css`)
- `--action-primary: 17 90% 41%` (#C2410C burnt sienna) — matches swirl mark exactly
- `--bg-canvas: 38 47% 96%` (#FAF7F2 warm paper)
- `--text-primary: 22 23% 13%` (#2A1F1A warm walnut)
- Dark mode: graphite #16161A canvas, cream #F0EDE6 text

### Dark Mode
- ThemeProvider already wired in `src/components/providers/index.tsx` with `attribute="data-theme" enableSystem={true}` — respects macOS pref
- Image swap via Tailwind `block dark:hidden` / `hidden dark:block` in Landing, BrandSplash, signin
- Icon mark (rust squircle) reads fine on both bgs — no dark variant needed
- Tailwind `darkMode: ["class", "[data-theme='dark']"]` triggers on the html attribute

## Open Issues / Where Seneca Wants More Polish

### 1. Landing responsive scaling (UNRESOLVED, current pain point)
Seneca's complaint: landing doesn't "auto-expand symmetrically" when moved between a 14" laptop and a 24" external monitor.

**What we tried:**
- Static `max-w-[720px]` breakpoints (md/lg/xl/2xl) — predictable but stepped, not smooth
- CSS `clamp()` on width/font/spacing — smooth but ratios felt off
- Fluid root font-size + em-based sizing — Seneca said this "looked terrible"

**Current state:** Reverted to the static Tailwind version (`max-w-[720px]`, `text-2xl md:text-display`). Wordmark caps at 720px regardless of viewport. Predictable but doesn't feel hero-like on big screens.

**Likely next step in new chat:** Probably need to either (a) commit to clamp-based fluid scaling with carefully chosen min/max ratios via utopia.fyi or similar, (b) add explicit lg/xl/2xl breakpoint bumps that hit "right" sizes per common screen, or (c) accept that the design baseline is 1440 and don't scale beyond.

Seneca may need a fresh designer eye more than a code change here — the source asset is a low-res raster (1024×764 source PNG) so big-screen quality is fundamentally limited. He noted he ran out of GenSpark tokens before generating an SVG version.

### 2. Pre-existing button text contrast (NOT fixed)
The `Button` default variant uses `text-action-on` which resolves to `--action-on-accent` = white in light mode. In rendering, the "Sign in" button on SignInForm shows DARK text on rust BG. Site-wide rust CTAs all show dark text.

I worked around this on Landing's CTA only by adding `!text-white` className. Real fix would be patching `src/components/ui/button.tsx` line ~17 `text-action-on` → `text-white` (or fixing the token mapping).

### 3. Wordmark quality at large sizes
Source `GoneSquirrelWithWordsTransparent.png` is 1024×764 (post-crop: 798×250). Sharp up to ~800px display width. Above that, soft. To go bigger crisp, need:
- SVG version (Seneca planned to make via GenSpark, ran out of tokens)
- Auto-trace via `vtracer` (install: `brew install vtracer`) — offered, not yet done
- Or 2x+ raster re-export at native 1600w+ from source design tool

### 4. LeftRail visible on `/auth/signin`
Signin page lives under `(common)/` layout that includes LeftRail nav. Means even unauth users see the rail. Pre-existing layout issue. Fix would be either:
- Move signin to `(open)/auth/signin/`
- Add layout opt-out flag

## Splash Behavior
- Holds minimum 1800ms before routing decision
- Component animation: icon fade-in zoom-in (700ms), wordmark fade-in slide-from-bottom (700ms, 200ms delay)
- After hold + auth check resolves: redirect to /calendar (authed) or render Landing (unauth)

## PWA / iOS Home Screen Setup
- `manifest.webmanifest` linked in metadata
- `apple-touch-icon.png` at 180×180
- `appleWebApp: { capable: true, title: "GoneSquirrel", statusBarStyle: "default" }`
- Theme color `#C2410C` (rust) for browser chrome / iOS status bar
- Test: iPhone Safari → Share → Add to Home Screen → tap icon → opens standalone, branded splash, no Safari chrome

## Build Status
- `npm run type-check` clean (last verified)
- `npm run build` succeeds (last verified before responsive iteration loop)

## Critical Files Reference
```
public/brand/                         <- generated PNG assets
public/manifest.webmanifest            <- PWA manifest
src/app/metadata.ts                    <- icons + manifest + theme
src/app/loading.tsx                    <- splash on route transitions
src/app/(open)/page.tsx                <- home: splash 1800ms → landing or redirect
src/app/(common)/auth/signin/page.tsx  <- signin with wordmark
src/components/brand/BrandSplash.tsx   <- reusable splash
src/components/landing/Landing.tsx     <- landing hero (OPEN ISSUE: scaling)
src/components/navigation/AppNav.tsx   <- top bar
src/components/navigation/LeftRail.tsx <- sidebar
src/components/ui/button.tsx           <- pre-existing text-action-on bug
```

## What to Tell the New Chat
1. Read this file first
2. Brand work is largely done. Look at Landing.tsx + the screenshots in repo root (landing-normal.png, em-1280.png, em-2560.png) to see what's been tried
3. Seneca wants landing to scale symmetrically without feeling stretched/sparse — needs design judgment on baseline size, scaling ratios, and the source asset quality ceiling
4. Don't burn tokens on iterating sizing without first proposing the approach and getting alignment
