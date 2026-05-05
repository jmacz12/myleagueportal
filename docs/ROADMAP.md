# MyLeaguePortal — product roadmap

Readable breakdown of what exists today versus what is planned. Update this file when scope changes or a milestone ships.

---

## Product direction — public league & team pages (plan tiers, target)

Most of this is **not built yet**; this section records **Basic / Pro / Enterprise** intent so public surfaces and billing stay aligned.

### Basic

- Public **league hub** (`/join/[slug]`) and a **minimal public team page** (team identity, season context, links such as jersey poll).
- **Roster on public** for all plans (names, jersey #, positions as configured)—**no emails/phones on public** by default; plain roster presentation (no stat strips).
- **No public team/player stats** on Basic.

### Pro

- **Live / final scores** on public league/team surfaces as a **teaser** (not necessarily full historical dumps everywhere—keep UX readable).
- **Five headline stats** on public Pro surfaces (fixed platform-wide set until sport templates ship—e.g. tied to core tracked stats).
- **Optional headshot slots** on public roster cards—**organizer opts in** per league/team/player policy.
- **Team logo** upload on the public team page.

### Enterprise

- **All stats** the platform can derive from recorded games, with **organizer toggles** (which stats appear where: league home, team page, scoreboard).
- **Sport-oriented analytics** (aggregates, trends) built from existing game data—scope grows with templates.
- **Auto season award maker**; **final weeks of season** prompts/notifications for organizers; **award race** callouts eligible for **league home** promotion.
- Public **team page**: **full edit** within supported templates/layout (copy, sections, branding)—not necessarily arbitrary HTML at first.
- Pairs with **Phase 7** custom domains and multi-admin for operational scale.

### Org “employees” / staff (not payroll)

- **Roadmap:** **Phase 7 — Multi-admin** — **Additional dashboard access** the **primary organizer grants and can revoke** (e.g. refs, scorekeepers, league staff). Delegated roles vs full org owner—not payroll “employees.”

### Messaging & in-app chat

- **Deferred / TBD:** Revisit when communication milestones are closer. Many leagues already use **Messenger / WhatsApp**; avoid committing to a **group-chat clone v1** until scope and moderation are clear.
- **Placeholder intent:** **Pro+** might include **structured** league/team messaging (announcements, moderation, optional private team channel)—**evaluate at delivery time**.

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

## Phase 5 — Team organizer & player tools (**in progress**)

- **Team jersey poll:** **Shipped (MVP).** Dashboard **Teams** — **Start poll** (requires roster on team + org slug in Settings); **Copy link** to public `**/join/[slug]/jersey-poll/[pollId]**`; players submit **email** (must match season registration) + **preferred 0–99**; **Close** ends submissions. **Teams** shows preferences + **Conflict** when two players want the same number. **Players** shows **Poll** (pending or number) while a team poll is open. Final jersey **#** remains organizer-assigned on **Players** (per-season uniqueness). **Follow-ups:** one-click “apply poll to jersey #”, email/notify players, optional stricter rules.
- **Sport-aware positions / roster fields:** Let each league pick a **sport template** (or custom field set) at onboarding or in settings so registration and lineups use the right positions (e.g. basketball vs soccer vs volleyball) instead of a single hard-coded list.
- **Reputation — finalization:** Extend beyond today’s organizer-facing tiers (e.g. player-visible summaries, refinements, exports — scope TBD).
- **Pre-set home game rules:** Facility access, jersey colors, equipment checklists, automated distribution.
- **Automated polls:** Attendance / availability (e.g. Supabase Realtime).
- **Mass / in-app messaging:** See **Product direction — Messaging & in-app chat** (deferred; scope TBD—may consolidate with Phase 4 comms when ready).

---

## Phase 6 — Advanced scheduling & AI (**future**)

- **Calendar imports:** `.ics` / `.csv` bulk upload.
- **Automated reminders:** ~24h SMS/email (e.g. Twilio / Resend) to cut no-shows.
- **AI schedule generator:** Natural-language prompts → season schedules.

---

## Phase 7 — Premium expansion (**future**)

- **Custom domains:** Enterprise branded URLs.
- **OBS overlay builder:** Stream graphics for YouTube/Twitch.
- **Multi-admin / delegated dashboard access:** The **primary organizer** can **invite** additional users to the dashboard (e.g. refs, scorekeepers, staff) with scoped roles, and **revoke access** anytime—not payroll “employees,” but **trusted operators** with less than full org ownership where the product supports it.

---

## Phase 8 — Help & documentation (**late / after major surfaces stabilize**)

- **In-app Help / docs hub** for the marketing site and (later) dashboard: **search** across articles; jump to the right page when users have a problem.
- **Content scope:** Why the product works the way it does; **Basic vs Pro vs Enterprise** (and **Pro+** if distinct); **what each plan includes**; **billing / payments** (Stripe, what they’re charged for); **per-feature or per-area** explainers (season signup, drop-ins, jersey poll, scoring, etc.).
- **Timing:** Intentionally **one of the last** major additions—content and IA churn while the roadmap keeps moving; add when core flows and tiers are stable enough to document without constant rewrites.

---

## Maintenance notes (for humans & agents)

- When you **ship** or **cancel** a roadmap item, edit the relevant phase and add a short **changelog line** at the bottom (date + one sentence).
- When code changes **materially** affect a bullet above, update this doc in the **same PR** when possible.

### Changelog

- **2026-05-06:** **Phase 8 — Help & documentation** (searchable help hub, plans/payments explainers—late phase). **Phase 7** multi-admin clarified as **invited dashboard access, revocable by organizer**. **Product direction** staff bullet aligned with same wording.
- **2026-05-05:** **Product direction** section: plan tiers for **public league & team pages** (Basic / Pro / Enterprise): roster-on-public for all tiers with upgrade depth (stats, headshots, logos, Enterprise awards/analytics/page edit); **Phase 7** multi-admin framed as **delegated staff**; **messaging / in-app chat** marked **deferred TBD** with Pro+ placeholder.
- **2026-05-04:** **Team jersey poll (Phase 5 MVP):** tables `jersey_polls` / `jersey_poll_responses`, organizer APIs `**/api/jersey-polls**`, public `**/api/join/[slug]/jersey-poll/...**` + page `**/join/[slug]/jersey-poll/[pollId]**`. Migration: `**20260504120000_team_jersey_poll.sql**`.
- **2026-05-04:** Public `**/join/[slug]` hub**: landing page with links to **season registration** (`/join/[slug]/register`) and **drop-ins** (`/join/[slug]/dropins`); hub API at `**GET /api/join/[slug]/hub`**.
- **2026-05-04:** Roadmap reformatted for clarity; aligned completed work with live scoring, public scoreboard, drop-in reputation (organizer), Phase 4 table, and cron scope.
- **2026-05-04:** Season signup **schedule** (opens/closes); **competitive-only** seasons (removed drop-in season type); **jersey #** removed from public season registration—dashboard Players + planned **team jersey poll** (Phase 5).

