# 🐿️ GoneSquirrel

> ADHD-tuned auto-scheduling task + calendar for brains that scan, not read.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Personal-use fork. Originally based on [FluidCalendar](https://github.com/dotnetfactory/fluid-calendar) by @dotnetfactory (MIT). The fork rebuilds the visual layer around a **calm-stimulation** design system meant to act like a friend, not a boss.

> "My brain just exhaled." — north-star feeling. The user opens the app overwhelmed, closes it feeling held.

---

## Screenshots

> Drop in once captured. Placeholder paths kept so layout works.

- `docs/screenshots/calendar.png` — Calendar week view, light mode
- `docs/screenshots/tasks-list.png` — Task list with sticky header + resizable meta column
- `docs/screenshots/now-mode.png` — Now Mode hero with the focused task
- `docs/screenshots/settings-appearance.png` — Sensory regulation toggles

---

## What's distinctive

- **Color as infrastructure** — burnt-sienna single-action accent + woodsy energy palette (forest / honey / moss / acorn). Tokens are semantic (`--urgency-today`, not `--coral-500`); meanings lock once assigned.
- **Sensory regulation toggles** — Motion off, Reduced color, High contrast, Time-of-day shift. For dysregulated days when the app needs to go quiet.
- **Friend-voice copy** — "Slipped" not "Overdue". "Nothing on the docket. Want to capture something, or just breathe?" not blank state. Anti-shame: streak shaming, exclamation marks, motivational-poster energy banned.
- **Editorial typography** — Fraunces variable serif for hero copy + Plus Jakarta Sans humanist body + JetBrains Mono for numerals. No system stack.
- **Responsive shell** — sticky LeftRail (collapsible) on desktop, bottom tabs + bottom-sheet modals on mobile.
- **Resizable task list** — drag the column boundary to grow the title or meta cluster. Width persists.
- **Overdue decay** — old slipped tasks soften via `--urgency-overdue-soft` after 3 days. Never escalates indefinitely. ADHD brains get red-blindness fast; we don't make it worse.
- **Warm completions** — single-burst gold-and-sage confetti + friend-voice toast rotation, gated by Motion toggle and `prefers-reduced-motion`.
- **No dark patterns** — no streak shaming, no SaaS upsells, no sponsorship pitches, no marketing landing.

---

## Stack

Next.js 15 (App Router) · React 19 · Prisma + Postgres · NextAuth · Tailwind 3 · shadcn/Radix primitives · dnd-kit · FullCalendar · Zustand · TanStack Query · Sonner · framer-motion · canvas-confetti.

Icons: Phosphor via `react-icons/pi` for duotone weight.

---

## Quick start (Docker)

1. Install Docker Desktop.
2. Clone:
   ```bash
   git clone https://github.com/senecabenson/gone-squirrel.io.git
   cd gone-squirrel.io
   ```
3. Copy + fill the env file:
   ```bash
   cp .env.example .env
   ```
   Minimum:
   ```
   DATABASE_URL=postgresql://fluid:fluid@db:5432/fluid_calendar
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   ```
4. Run:
   ```bash
   docker compose up -d
   ```
5. Open http://localhost:3000 and create an account.

Database name + user kept as `fluid_calendar` / `fluid` to avoid migrating existing volumes — cosmetic only.

---

## Local development

```bash
npm install
npm run db:up        # postgres only, port 5432 on host
npm run dev          # next dev --turbopack on http://localhost:3000
```

Useful:
- `npm run type-check` — `tsc --noEmit`
- `npm run lint` — Next/ESLint
- `npm run prisma:studio` — DB browser
- `npx playwright test` — e2e (requires DB seeded with test user; see `tests/e2e/`)

Pre-commit hook (Husky) runs lint + type-check on every commit.

---

## Google Calendar setup

1. **Create a Google Cloud project** — [Google Cloud Console](https://console.cloud.google.com), New Project.
2. **Enable APIs** — APIs & Services → Library → enable **Google Calendar API** and **Google People API**. If you plan to sync Google Tasks, also enable **Google Tasks API**.
3. **OAuth consent screen** — APIs & Services → OAuth consent screen, choose "External". App name: `GoneSquirrel`. Scopes:
   - `./auth/calendar.events`
   - `./auth/calendar`
   - `./auth/userinfo.email`
   - `openid`
   - `/auth/tasks` *(only if syncing Google Tasks)*
   Add yourself as a test user.
4. **OAuth credentials** — APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
   - Authorized JavaScript origins: `http://localhost:3000` (+ your production URL when deployed)
   - Authorized redirect URIs: `http://localhost:3000/api/calendar/google` (+ production equivalent)
5. **Wire credentials** — paste Client ID + Client Secret into Settings → System inside the app, or set env vars:
   ```
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   ```

---

## Microsoft Outlook setup

1. **Register app** — [Azure Portal](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) → New registration. Name: `GoneSquirrel`. "Accounts in any organizational directory and personal Microsoft accounts."
2. **Authentication** — Add platform → Web. Redirect URI: `http://localhost:3000/api/auth/callback/azure-ad` (+ production equivalent). Implicit grant: tick Access tokens + ID tokens.
3. **API permissions** — Microsoft Graph delegated:
   - `Calendars.ReadWrite`
   - `Tasks.ReadWrite`
   - `User.Read`
   - `offline_access`
4. **Client secret** — Certificates & secrets → New client secret. Copy immediately.
5. **Wire credentials** — paste into Settings → System, or set:
   ```
   AZURE_AD_CLIENT_ID="your-client-id"
   AZURE_AD_CLIENT_SECRET="your-client-secret"
   AZURE_AD_TENANT_ID="your-tenant-id-or-common"
   ```

---

## Project conventions

- **Architecture map** — [CODEBASE_MAP.md](./CODEBASE_MAP.md) — high-level walkthrough of the data model, scheduler, and surface composition.
- **Session log** — [WORKING_NOTES.md](./WORKING_NOTES.md) — end-of-session handoff log. Future-you reads it cold to re-orient.
- **Friction journal** — [FRICTIONS.md](./FRICTIONS.md) — daily annoyances. Drives prioritization, never roadmap-by-fiat.
- **North star** — [GoneSquirrel.io — Vision & Reference](./GoneSquirrel.io%20—%20Vision%20%26%20Reference) — feature vision + ADHD-native interaction rules. Every change checks against this.
- **Design tokens** — [src/app/globals.css](./src/app/globals.css) — semantic CSS vars (foundation / text / urgency / state / domain / energy / action). Never use raw `bg-blue-500` etc.
- **Icons** — Phosphor (`react-icons/pi`) duotone.

---

## License + credits

MIT — [LICENSE](./LICENSE).

This project is a personal-use fork of [FluidCalendar](https://github.com/dotnetfactory/fluid-calendar) by @dotnetfactory. All upstream copyright notices preserved per MIT terms. Substantial visual + UX changes; the core scheduler, calendar sync, and Prisma data model retain their FluidCalendar lineage.

**Not soliciting contributions or sponsorships.** This is one person's daily-driver. Issues are welcome but no PRs without prior conversation. The vision evolves with use, not committee.
