# MyLeaguePortal — product roadmap

Readable breakdown of what exists today versus what is planned. Update this file when scope changes or a milestone ships.

---

## Phase 1–3 — Foundation & core (**completed**)

### Infrastructure

- **Auth:** Clerk.
- **Data:** Supabase (PostgreSQL + RLS).
- **Billing:** Stripe subscriptions (checkout, customer portal, webhooks, plan on `organizations`).

### Core management

- **Seasons, teams, players:** Full CRUD-style flows with **plan limits** enforced in UI/API.

### Season games & scoring

- **Live scoring:** Game clock, period (quarter) selector, per-player stats (**PTS, AST, REB, STL, BLK, TOV, PF**).
- **Lifecycle:** Scheduled → live → final.
- **Post-game:** Highlights UI and **Player of the Game** scoring formula.

### Drop-in essentials

- **Sessions:** Create/manage sessions; **recurring schedules** where implemented.
- **Day-of:** Check-in, payment tracking, **organizer-only standings** (includes **reputation points / tiers** — Gold / Silver / Bronze / warning — and inactive handling in dashboard).
- **Pro:** **Automated team builder** for balanced lineups.

### Public portal

- **Marketing:** Professional landing page (`/`).
- **Join hub:** `**/join/[slug]`** — org branding, **season registration** → `/join/[slug]/register` (per competitive season: **Public season signup** + optional **opens/closes** window in Dashboard → Seasons), **drop-ins** → `/join/[slug]/dropins`; drop-in flows may still allow guests where configured; season signup is one player per account; **no jersey # on season signup** (numbers assigned later).
- **Fans:** Public **live scoreboard** for games (`/games/[gameId]/scoreboard`).

### Waivers

- **Digitizer:** PDF text extraction (**pdf-parse**) with separate **season** vs **drop-in** waivers, activation and settings wiring.

---

## Phase 4 — Communication & logistics (**in progress / polishing**)


| Area                            | Status           | Notes                                                                                                                                   |
| ------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **News banner**                 | Done             | Organizer-controlled; stored in Supabase; rendered on public surfaces.                                                                  |
| **Public drop-in registration** | Shipped / polish | List + sign up for upcoming sessions (`/join/[slug]/…`); tighten edge cases as needed.                                                  |
| **League timezone**             | Done / verify    | Consistent local rendering for organizers vs travelers.                                                                                 |
| **Automation**                  | Partial          | **Midnight cron:** session close (`/api/cron/close-sessions` + `CRON_SECRET`). Extend if you add pruning, reminders, or retention jobs. |
| **Developer tools**             | Done             | Dev-only **seed drop-in** route for fast UI testing.                                                                                    |
| **Season signup schedule**      | Done             | Optional `online_registration_opens_at` / `closes_at` on `seasons`; hub respects window. Migration: `20260207100000_season_online_registration_window.sql`. |
| **Jerseys (dashboard)**         | Done             | Organizers set **jersey #** on **Dashboard → Players** (per season uniqueness); not collected on public season signup.                    |


---

## Phase 5 — Team organizer & player tools (**future**)

- **Team jersey poll:** After rosters exist, organizer sends a **poll from the team page** so players claim jersey numbers; results visible under **Teams** / **Players** (replaces or complements manual entry).
- **Sport-aware positions / roster fields:** Let each league pick a **sport template** (or custom field set) at onboarding or in settings so registration and lineups use the right positions (e.g. basketball vs soccer vs volleyball) instead of a single hard-coded list.
- **Reputation — finalization:** Extend beyond today’s organizer-facing tiers (e.g. player-visible summaries, refinements, exports — scope TBD).
- **Pre-set home game rules:** Facility access, jersey colors, equipment checklists, automated distribution.
- **Automated polls:** Attendance / availability (e.g. Supabase Realtime).
- **Mass messaging:** In-app or integrated blast to reduce reliance on group chats.

---

## Phase 6 — Advanced scheduling & AI (**future**)

- **Calendar imports:** `.ics` / `.csv` bulk upload.
- **Automated reminders:** ~24h SMS/email (e.g. Twilio / Resend) to cut no-shows.
- **AI schedule generator:** Natural-language prompts → season schedules.

---

## Phase 7 — Premium expansion (**future**)

- **Custom domains:** Enterprise branded URLs.
- **OBS overlay builder:** Stream graphics for YouTube/Twitch.
- **Multi-admin:** Roles for refs / scorekeepers vs full org admin.

---

## Maintenance notes (for humans & agents)

- When you **ship** or **cancel** a roadmap item, edit the relevant phase and add a short **changelog line** at the bottom (date + one sentence).
- When code changes **materially** affect a bullet above, update this doc in the **same PR** when possible.

### Changelog

- **2026-05-04:** Public `**/join/[slug]` hub**: landing page with links to **season registration** (`/join/[slug]/register`) and **drop-ins** (`/join/[slug]/dropins`); hub API at `**GET /api/join/[slug]/hub`**.
- **2026-05-04:** Roadmap reformatted for clarity; aligned completed work with live scoring, public scoreboard, drop-in reputation (organizer), Phase 4 table, and cron scope.
- **2026-05-04:** Season signup **schedule** (opens/closes); **competitive-only** seasons (removed drop-in season type); **jersey #** removed from public season registration—dashboard Players + planned **team jersey poll** (Phase 5).

