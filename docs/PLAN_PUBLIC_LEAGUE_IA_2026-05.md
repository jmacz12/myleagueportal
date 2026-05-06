# Plan snapshot — public league IA, tabs, tiered branding (May 2026)

Archived decisions and implementation map. **Authoritative product narrative:** `ROADMAP.md` (changelog **2026-05-07**).

## Goals

- **Information architecture:** Public league at `/league/[slug]` uses real tabs — **Home | Schedule | Standings | Teams | About** — with `?tab=` for shareable URLs (not in-page anchor-only jumps).
- **Tiers:** **Basic** = house branding on the public web (MyLeaguePortal defaults), no custom hero/logo for visitors, CMS save/upload blocked in API; owners still see upgrade paths and locked controls in edit mode. **Pro+** = brand color, five presets, **Bright / Midnight** (`organizations.league_appearance_mode`), optional public fonts (`publicFontKey` in league site JSON), live preview while editing, parity with **Dashboard → Settings**.
- **Theme resolution:** `getPublicThemeInputsForOrg` + `resolveThemePreset(brand, preset, appearanceMode)` on league, join, register, drop-ins, and public team page where wired.

## Key surfaces

| Area | Notes |
|------|--------|
| `app/league/[slug]/page.tsx` | Tab shell, section routing |
| `lib/public-league-branding.ts` | Tier inputs for public theme |
| `lib/leagueTheme.ts` | Presets + `LeagueAppearanceMode` |
| `components/league-site/*` | On-page editor, look controls, sticky bar |
| `app/api/league-site/route.ts` | GET `appearance`; PUT 403 Basic |
| `app/api/league-org-appearance/route.ts` | Owner PATCH brand / preset / mode |
| `app/dashboard/settings/page.tsx` | Bright/Midnight + preset preview |

## Database

- Migration: `supabase/migrations/20260506140000_league_appearance_mode.sql` — apply on Supabase before relying on mode in production.

## Next (product, not this snapshot)

- **Public team page** polish per roadmap; **jersey poll** team-context UI (Phase 5).
