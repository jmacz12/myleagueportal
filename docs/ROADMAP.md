# MyLeaguePortal — product roadmap

Readable breakdown of what exists today versus what is planned. Update this file when scope changes or a milestone ships.

---

## Roadmap structure (past / current / future)

- **Past (shipped):** `Phase 1–3 — Foundation & core`, plus dated entries in **Changelog**.
- **Current (active):** `Phase 4` and `Phase 5` (in progress / polishing).
- **Future (planned):** `Phase 6`, `Phase 7`, `Phase 8`, `Phase 9` (platform ops), and `Product direction` bullets marked planned/deferred.
- **History log:** `Changelog` is the authoritative timeline of delivered changes.

---

## Product direction — public league & team pages (plan tiers, target)

Most of this is **not built yet**; this section records **Basic / Pro / Enterprise** intent so public surfaces and billing stay aligned.

### Information architecture (target)

- **League home** — A **dedicated public home for the league**: the place for everything **browse, follow, and watch**—teams & rosters, standings/stats (tiered), featured games, **video/stream**, stream **overlays** (tiered), news/banner, and clear paths to **join** the season or **drop-ins**. **Target route:** e.g. `**/league/[slug]`** (exact path TBD; Enterprise may pair with **custom domains** from Phase 7).
- **Join** — `**/join/[slug]`** is for **people taking action**: **season registration**, **drop-ins**, and **player tasks** (e.g. **jersey poll**). It should read as **“sign up / participate,”** not the full league destination. League home and join **cross-link** (e.g. “Register” on league home → join flows; “League home” from join when helpful).
- **Shipped (Basic shell):** `**/league/[slug]`** — league home with **sticky tab nav** (Home, News, Schedule, Standings, Teams, About): Home = participate CTAs + league status; News = organizer updates; Schedule = combined season+drop-in list (+ venues/personalization); Standings = Basic upgrade messaging vs Pro data table; Teams = directory; About = evergreen CMS sections (history/media). News banner, season context, **team directory** → `**/league/[slug]/teams/[teamId]`**, links to `**/join/...`**. `**/join/[slug]**` redirects to league home; legacy `**/join/[slug]/teams/[id]**` redirects to `**/league/.../teams/[id]**`.
- **Shipped (CMS v1):** Dashboard **League website** (`**/dashboard/league-site`**) and on-page editing at `**/league/[slug]?edit=1`** (owners / website editors) — **Save draft** / **Publish**; **hero** upload; **text**, **news**, **media** blocks with **Up / Down** reorder in dashboard and on-page editor. **Basic plan:** public league uses **MyLeaguePortal house branding** (fixed green + Classic preset + Bright); **no** custom hero / logo on public; **league-site save, publish, and uploads are API-blocked**; edit UI shows **locked** Pro previews and upgrade paths. **Pro+:** brand color, **five named presets** (**Classic / Bold / Soft / Bright / Midnight**; canonical ids on `**organizations.league_theme_preset**`, migration `**20260506200000_league_theme_choice_ids.sql**`), **Bright / Midnight** via `**organizations.league_appearance_mode**` (migration `**20260506140000_league_appearance_mode.sql**`) synced with **Dashboard → Settings** and on-page **Save brand & look** (`**/api/league-org-appearance**`); optional **page fonts** via `**league_site_content**` (`**publicFontKey**`). **Theme tokens** are **contrast-harmonized** in **`lib/leagueTheme.ts`** (readable type on page + card surfaces; **Midnight** = dark shell + light foreground; **public hero** keeps near-white hero type on the dark gradient). **Preset pickers:** compact **pill rows** in Settings and on-page editor (descriptions on hover/`title`). **Public tab bar:** **centered wrap** (no horizontal scroll / scrollbar) and **no** full-width border under the row—only the **active** tab accent underline. Live **theme preview** while editing (owner) before save. `**GET /api/join/[slug]/hub`** includes `**leagueSite`**, `**plan`**, appearance fields. APIs: `**/api/league-site`** (GET returns `**appearance**` meta + `**maxGalleryImages**`; PUT 403 on Basic), `**/api/league-site/upload`** (403 Basic), `**/api/me/org-access**`, `**/api/organization-editors**`. Join surfaces use `**resolveThemePreset(brand, preset, appearanceMode)**` + `**getPublicThemeInputsForOrg**` for tier-aware theming. Dev seed: `**POST /api/dev/seed-teams-players**` — `**withLeagueSiteDemo: true**` upserts rich `**league_site_content**`. Migrations: `**20260505213000_league_site_content.sql**` (+ `**20260505213039**` no-op).

### Basic

- **League home (Basic):** **House public theme** (MyLeaguePortal default green + Classic + Bright); **hosted-on** lockup instead of league logo on public; teams, registration, and drop-ins unchanged. **Custom league website** (hero, sections, fonts) is **Pro+**; Basic visitors do not see org custom colors/hero on the public web.
- **Team directory** → **public team pages** at `**/league/[slug]/teams/[teamId]`** (identity, season, **roster** without contact info, jersey poll link when open). **Roster on public** for all plans (names, jersey #, positions)—**no emails/phones on public** by default; plain roster (no stat strips). **Shipped:** tabbed layout (**Overview / News / Schedule / Roster / Stats** with `**?tab=`**); **Overview** can show a **Watch live** button when **`teams.stream_url`** is set (organizer-managed; external YouTube/Twitch/etc. for now).
- **No public team/player stats** on Basic.
- **League schedule UI (single list):** Keep season + drop-in items in one list, but require strong **type indicators** (**League game** vs **Drop-in** / **Repeating drop-in**) and action-safe CTAs (e.g. reserve/join only appears on drop-ins).

### Pro

- **Live / final scores** on public league/team surfaces as a **teaser** (not necessarily full historical dumps everywhere—keep UX readable).
- **Five headline stats** on public Pro surfaces (fixed platform-wide set until sport templates ship—e.g. tied to core tracked stats). **Shipped on public team page** `**/league/[slug]/teams/[teamId]`**: exactly **five** season totals (**PTS, REB, AST, STL, BLK**) + **W–L** + **league rank** (among teams in season) + **last final** teaser from recorded games; **no extra stat columns on Pro**—Enterprise unlocks **TOV**, **PF**, and a **recent games** table.
- **Optional headshot slots** on public roster cards—**organizer opts in** per league/team/player policy.
- **Team logo** upload on the public team page.
- **Brand-aware theme presets (Pro):** League page styling derives from league **brand color** in Settings. Generate **5 automatic theme presets** and let organizer choose one (no full free-form theme editing in Pro).
- **Preset behavior guardrail (Pro):** Presets must stay **brand-derived** (hue/tone variants from chosen brand color), not unrelated/random palettes.
- **Brand color change policy (Pro):** Brand color changes are **rate-limited monthly** (target default: **5/month**, configurable). Changing brand color regenerates the 5 presets for that league.
- **Optional logo-assisted branding (Pro):** Provide an **“Extract suggested brand color from logo”** helper; saved brand color remains the source of truth.
- **Video / stream:** featured **YouTube** and **Twitch** (embeds and/or prominent outbound links) on **league home** / team surfaces. **Shipped (MVP):** per-team **stream URL** on the public team **Overview** tab (`**teams.stream_url`**). **Planned:** a **league-owned “live game”** route that the team page can link to when the team has an active broadcast (first-party stream / scoreboard hub)—replacing or augmenting the generic outbound URL.
- **iPhone / “true fullscreen” + score overlay (web constraint):** Safari does **not** allow a parent-page **custom HTML overlay** (live scores) on top of an embedded YouTube/Twitch player in **native video fullscreen**—fullscreen is owned inside the iframe. **Product stance:** keep **“Full screen with overlay”** as **immersive page mode** + optional **landscape lock** where browsers allow it; treat **player fullscreen** as the path for **system fullscreen** only (no site overlay). For **broadcast-style** “scores always on the video in true fullscreen,” organizers should **burn scores in OBS** (or similar) or use **first-party streaming** when that ships (**Enterprise** / Phase 7)—not something a web embed alone can fix on iOS.
- **Stream overlay:** **Basic overlay** for OBS/streaming—**template-based**, limited customization (on-brand, not full white-label).
- **Personalized schedule highlight:** **Shipped** on public league `Schedule` tab — signed-in players see `Your upcoming games` (priority strip) plus `You’re playing` markers on relevant season fixtures and reserved drop-ins while the full schedule stays visible to everyone.

### Enterprise

- **All stats** the platform can derive from recorded games, with **organizer toggles** (which stats appear where: **league home**, team page, scoreboard).
- **Sport-oriented analytics** (aggregates, trends) built from existing game data—scope grows with templates.
- **Auto season award maker**; **final weeks of season** prompts/notifications for organizers; **award race** callouts eligible for **league home** promotion.
- Public **team page**: **full edit** within supported templates/layout (copy, sections, branding)—not necessarily arbitrary HTML at first.
- **Theme controls (Enterprise):** Includes all Pro auto-brand behavior plus **fully customizable theme controls** (manual colors/tokens/section styling) with **unlimited edits**.
- **Video / stream:** **First-party / league-owned streaming** on the platform (full product—**scope TBD**). Complements Pro’s **YouTube/Twitch-first** positioning for leagues that want an owned destination.
- **Stream overlay:** **Fully customizable** overlays—layouts, branding, **sponsor placements**, advanced OBS/stream integration (see Phase 7).
- Pairs with **Phase 7** custom domains and multi-admin for operational scale.

### Org “employees” / staff (not payroll)

- **Roadmap:** **Phase 7 — Multi-admin** — **Additional dashboard access** the **primary organizer grants and can revoke** (e.g. refs, scorekeepers, league staff). Delegated roles vs full org owner—not payroll “employees.”
- **Shipped (narrow):** **Website editors** — extra users who may edit **League website** only (`**organization_editors`**); not full multi-admin for seasons, teams, billing, etc.

### Messaging & in-app chat

- **Deferred / TBD:** Revisit when communication milestones are closer. Many leagues already use **Messenger / WhatsApp**; avoid committing to a **group-chat clone v1** until scope and moderation are clear.
- **Placeholder intent:** **Pro+** might include **structured** league/team messaging (announcements, moderation, optional private team channel)—**evaluate at delivery time**.

### Team manager / club workspace (future — separate from league organizer)

**Persona:** **Team managers / captains / club leads** running **their team’s** logistics—not the **league-wide** organizer. This is **not** the same as **Phase 7 multi-admin** (league staff on the **organizer dashboard**).

**From manager interviews (prioritize when building):**

- **Calendar uploads / import** — Bring in `**.ics`** (and similar) so practice, league games, and team events live in one place; **subscribe / export** as a follow-on.
- **Calendar reminders to members** — Notifications tied to events (**email** first; **SMS / push** TBD—reuse Phase 6-style delivery when it exists).
- **Automated polls + reminders** — e.g. **attendance / “who’s bringing X”** polls, scheduled **by default ~24 hours before game time** or at **offsets the manager chooses**; results and nudges go to **team members** as reminders (not only league-wide blasts).
- **Pre-set home game rules** — **Facility, arrival time, jersey colors, equipment checklists**, etc., configured under **team management** and shown on the **team workspace** (league-level defaults vs team overrides need a **single source of truth** rule—design before shipping).
- **Team front page** — A **home** for the team: **news** (team-only posts; optional surfacing of **league news** if the organizer allows), **next events**, quick links (polls, rules, files).

**Other ideas (validate with managers):**

- **Next game** strip: opponent, time, **directions/map**, RSVP or poll shortcut.
- **League schedule (read-only)** on the team calendar with **team-only** overlays (practices, socials)—avoid duplicating editable league fixtures on the team side.
- **Lightweight file stash** (parking PDFs, permit scans, music links).
- **Simple roles** later (coach vs player vs parent) if one “member” view is too blunt.

**Status:** **Not started** — park after **League home**; **invites and permissions** (who is a team manager, roster membership) need explicit modeling so team tools don’t grant league-admin powers.

---

## Phase 1–3 — Foundation & core (**completed**)

### Infrastructure

- **Auth:** Clerk with a root **`proxy.ts`** request boundary (Next.js 16 **`clerkMiddleware`**; same matchers as before—public **`/join`**, **`/league`**, **`/api/join`**, **`/games`**, auth pages; protect **`/dashboard`** and **`/onboarding`**). The deprecated **`middleware.ts`** filename was renamed per [Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy). **Social sign-in:** **Google** and **Facebook** (Clerk Dashboard → **User & Authentication → Social connections**); app uses **`app/(auth)/sign-in/[[...rest]]/page.tsx`** (`<SignIn />`).
- **Data:** Supabase (PostgreSQL + RLS).
- **Billing:** Stripe subscriptions (checkout, customer portal, webhooks, plan on `organizations`).

### Core management

- **Seasons, teams, players:** Full CRUD-style flows with **plan limits** enforced in UI/API.

### Season games & scoring

- **Live scoring:** Game clock, period (quarter) selector, per-player stats (**PTS, AST, REB, STL, BLK, TOV, PF**).
- **Shipped scoring operator UX:** fixed **5 starters per side** on the scoring page, jersey-first tap flow, and one-tap event buttons (**+3, +2, +1 FT**, plus AST/REB/STL/BLK/TOV/PF).
- **Shooting breakdown:** `player_game_stats` now tracks **2PM / 3PM / FTM** (`fg2m`, `fg3m`, `ftm`) with team scores kept in sync from player totals.
- **Shipped stream + overlay (fan-facing):** League and team public pages embed **`StreamWithOverlay`** (watch URL + `/games/[id]/overlay?embed=1` score band). Public overlay route polls **~1s** while live so clock/score stay aligned with the scorer. Dashboard scoring exposes a single **public watch link** (canonical **`https://www.myleagueportal.com`** via **`lib/public-site-origin.ts`**, override **`NEXT_PUBLIC_PUBLIC_SITE_URL`**) — visible URL, opens in new tab, **Copy link** uses the same string.
- **Lifecycle:** Scheduled → live → final.
- **Post-game:** Highlights UI and **Player of the Game** scoring formula.

### Drop-in essentials

- **Sessions:** Create/manage sessions; **recurring schedules** where implemented.
- **Day-of:** Check-in, payment tracking, **organizer-only standings** (includes **reputation points / tiers** — Gold / Silver / Bronze / warning — and inactive handling in dashboard).
- **Pro:** **Automated team builder** for balanced lineups.

### Public portal

- **Marketing:** Professional landing page (`/`).
- **Join (`/join/[slug]`):** **Season registration** → `/join/[slug]/register`, **drop-ins** → `/join/[slug]/dropins`, **jersey poll** → `/join/[slug]/jersey-poll/[pollId]`; link to `**/league/[slug]`** for browse. Guests where configured for drop-ins; season signup one player per account; **no jersey # on season signup**.
- **League home:** `**/league/[slug]`** — Basic shell shipped (teams, rosters, news banner, participate links, **CMS v1** sections + optional hero background); Pro/Enterprise depth (stats, stream, overlays) per **Product direction**.
- **Fans:** Public **live scoreboard** for games (`/games/[gameId]/scoreboard`).

### Waivers

- **Digitizer:** PDF text extraction (**pdf-parse**) with separate **season** vs **drop-in** waivers, activation and settings wiring.

---

## Phase 4 — Communication & logistics (**in progress / polishing**)


| Area                            | Status           | Notes                                                                                                                                                                                 |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **News banner**                 | Done             | Organizer-controlled; stored in Supabase; rendered on public surfaces.                                                                                                                |
| **Public drop-in registration** | Shipped / polish | List + sign up for upcoming sessions (`/join/[slug]/…`); tighten edge cases as needed.                                                                                                |
| **Public drop-in visual polish** | Done | `**/join/[slug]/dropins`** — mobile-first session cards (stacked actions, 44px touch targets), `**dropinPublicPageBackdrop`** + preset tokens, 16px inputs on small screens (iOS zoom), waiver scroll + checkbox hit area, safe-area padding. |
| **Mobile-first hardening (drop-ins)** | Done | Dashboard **Drop-in** — responsive list rows, check-in/payments/team builder, standings sub-tabs and tier grid; shared **`dropin-*`** classes in **`app/globals.css`**; larger **`dropin-action-btn`** and help control; form action stacks on narrow viewports. |
| **Copy & clarity (public + dashboard)** | Done | End-user wording pass: public **Schedule** labels (**League game**, **Repeating drop-in**), drop-in **?** help modal + list/signup hints, **Games** / **Season signup timing**, **Settings** (logo, URLs, theme, waivers, brand-color cap), **League website** intro + section explainer, **team manage panel** stats/jersey blurbs, **`leagueIdentityUiHint`** helpers + **`PRO_BRAND_COLOR_COUNTER_HELPER`**. |
| **League home — Up next widget** | Done | **`/league/[slug]`** Home tab: **LIVE** strip → Stream when a game is live; **Up next** (≤6 rows, same recurring grouping as Schedule); league game → **scoreboard**, drop-in → **drop-ins**; **Full schedule** link; **Latest update** from first **News** CMS section → News tab. Reuses **`/api/join/[slug]/sessions`** (no new route). |
| **Public league — Stream & Schedule UX** | Done | **`StreamWithOverlay`**: top-right **Full screen** control only (no bottom overlay stealing taps from YouTube/Twitch play/pause); helper text under player. **Stream tab**: plain intro copy; desktop layout **`maxWidth: min(960px)`** so title + copy align with the **16:9** player. **Schedule tab**: entire schedule card navigates (**scoreboard** / **drop-ins**); recurring row **Show more dates** does not trigger navigation. **`GET /api/join/[slug]/sessions`**: exposes **`max_waitlist`** on drop-in **`scheduleItems`**; **`dropinSignupSummary`** shows **Roster full**, **waitlist closed**, etc. **Demo:** **`/games/demo/scoreboard`** (static preview; real games use **`/games/[id]/scoreboard`**). |
| **League timezone**             | Done / verify    | Consistent local rendering for organizers vs travelers.                                                                                                                               |
| **Automation**                  | Partial          | **Midnight cron:** session close (`/api/cron/close-sessions` + `CRON_SECRET`). Extend if you add pruning, reminders, or retention jobs.                                               |
| **Developer tools**             | Done             | Dev-only **seed drop-in** route for fast UI testing.                                                                                                                                  |
| **Season signup schedule**      | Done             | Optional `online_registration_opens_at` / `closes_at` on `seasons`; hub respects window. Migration: `20260207100000_season_online_registration_window.sql`.                           |
| **Jerseys (dashboard)**         | Done             | Organizers set **jersey #** on **Dashboard → Players** (per season uniqueness); not collected on public season signup.                                                                |
| **League website (CMS v1)**     | Done / verify    | Tabbed public league home; Basic vs Pro **gates** on save/upload; **Settings ↔ on-page** brand sync; **five named presets** + **Bright/Midnight** + fonts; **contrast harmonization** + compact **preset pills**; **tab bar** wrap (no scroll chrome) and no full-width border under tabs. **Shipped (May 2026):** theme save + usage counter scoped by **`organization_id`** / league slug; owner-only **Typography & theme** on public edit. Confirm Storage bucket + RLS; run **`npm run db:apply-pending`** (includes theme migrations) on deploy or paste **`scripts/sql/ensure-organization-appearance-columns.sql`** if columns missing. |
| **League identity (Settings)** | Done             | **League name** + registration **slug** (public `/join/[slug]` + `/league/[slug]`) change limits in **`PATCH /api/settings`**: **Basic** — one lifetime **name** change; **slug** not editable (API rejects slug changes). **Pro** — **90-day** cooldown after any **name or slug** change. **Enterprise** — **30-day** cooldown. Tracking: **`organizations.league_name_change_count`**, **`league_name_last_changed_at`** (migration **`20260507120000_league_identity_change_limits.sql`**); logic in **`lib/league-identity-change-policy.ts`**; Dashboard Settings locks fields + helper copy while cooling down. |


### Suggested next focus (near term)

1. **League home content (continued):** **Shipped (May 2026):** Home tab **Up next** strip — live game banner → Stream tab; next **6** schedule rows (league games + drop-ins, recurring series collapsed like Schedule tab); **Latest update** teaser from first **News** CMS block → News tab. **Next:** optional **mini month calendar**, **featured game** block, or richer **CMS section types** (see Changelog).
2. **League website (multi-org):** **Public `?edit=1` path shipped** — **`PUT /api/league-site`** and **`POST /api/league-site/upload`** accept optional **`organization_id`** (public league page sends **`org.id`**). Dashboard **League website** still uses default org access when omitted (fine until an org switcher exists).
3. **Phase 5:** Continue **jersey poll** polish and validate **sport templates** when ready to replace hard-coded positions.
4. **Copy & clarity:** **Shipped (May 2026)** — broad pass across public schedule, drop-in dashboard, Settings, League website, Games/season signup, identity helpers, and team panel (see **Changelog**). **Optional follow-up:** shorten **`evaluateLeagueIdentityChange`** error messages the same way (API responses when renames are blocked).

---

## Phase 5 — Team organizer & player tools (**in progress**)

- **Team jersey poll:** **Shipped (MVP backend/public flow)**. Public poll path stays `**/join/[slug]/jersey-poll/[pollId]`**; players submit **email** (must match season registration) + **preferred 0–99**; final jersey **#** remains organizer-assigned on **Players** (per-season uniqueness). **Shipped (Dashboard → Teams):** per-team **Jersey numbers…** modal — **Request jersey numbers** (open poll), **Copy poll link**, **Close poll**, and response table with **Conflict** when two players want the same number. **Public team page** `**/league/[slug]/teams/[teamId]`** — Basic **house** logo + roster + poll CTA; **Pro** five headline stat totals + record/rank + last-game teaser; **Enterprise** TOV/PF + recent games; optional **`teams.logo_url`**; **`publicFontKey`** parity with league home.
- **Sport-aware positions / roster fields:** Let each league pick a **sport template** (or custom field set) at onboarding or in settings so registration and lineups use the right positions (e.g. basketball vs soccer vs volleyball) instead of a single hard-coded list.
- **Reputation — finalization:** Extend beyond today’s organizer-facing tiers (e.g. player-visible summaries, refinements, exports — scope TBD).
- **Pre-set home game rules (league):** Facility access, jersey colors, equipment checklists, automated distribution. **Team-scoped** presets and **team manager UI** → see **Product direction — Team manager / club workspace**.
- **Automated polls (league / tooling):** Attendance / availability (e.g. Supabase Realtime). **Team manager** poll + **game-day reminder** flows → same section.
- **Mass / in-app messaging:** See **Product direction — Messaging & in-app chat** (deferred; scope TBD—may consolidate with Phase 4 comms when ready).

---

## Phase 6 — Advanced scheduling & AI (**future**)

- **Calendar imports:** `.ics` / `.csv` bulk upload (league and, later, **team manager** calendars—see **Team manager / club workspace**).
- **Automated reminders:** ~24h SMS/email (e.g. Twilio / Resend) to cut no-shows; **shared plumbing** for **team manager** event and poll reminders.
- **AI schedule generator:** Natural-language prompts → season schedules.

---

## Phase 7 — Premium expansion (**future**)

- **Custom domains:** Enterprise branded URLs (often paired with **League home**).
- **Stream overlays:** **Pro** — template/basic OBS overlays; **Enterprise** — **fully customizable** graphics including **sponsor** placements and deeper layout control (pairs with **Product direction** stream tiers).
- **Multi-admin / delegated dashboard access:** The **primary organizer** can **invite** additional users to the dashboard (e.g. refs, scorekeepers, staff) with scoped roles, and **revoke access** anytime—not payroll “employees,” but **trusted operators** with less than full org ownership where the product supports it.

---

## Phase 8 — Help & documentation (**late / after major surfaces stabilize**)

- **In-app Help / docs hub** for the marketing site and (later) dashboard: **search** across articles; jump to the right page when users have a problem.
- **Content scope:** Why the product works the way it does; **Basic vs Pro vs Enterprise** (and **Pro+** if distinct); **what each plan includes**; **billing / payments** (Stripe, what they’re charged for); **per-feature or per-area** explainers (season signup, drop-ins, jersey poll, scoring, etc.).
- **Timing:** Intentionally **one of the last** major additions—content and IA churn while the roadmap keeps moving; add when core flows and tiers are stable enough to document without constant rewrites.

---

## Phase 9 — Platform admin / operations (**future — MyLeaguePortal staff only**)

**Not** the same as **Phase 7 multi-admin** (league staff invited by an organizer) or the **organizer dashboard**. This is an **internal** surface for **you / trusted operators** to see health and volume across **all leagues** on the platform.

**Status:** **Not started** — add after billing and core league flows are stable enough that aggregates are meaningful.

### Access & safety

- **Gate hard:** e.g. **Clerk allowlist** (specific user ids or org) + **server-only** APIs; no “secret URL” or client-side PIN. **Audit log** for sensitive actions (exports, any future impersonation).
- **Principle of least privilege:** read-mostly v1; destructive or PII-heavy actions behind explicit steps.

### Dashboard ideas (prioritize v1 vs later)

- **At a glance:** Count of **organizations (leagues)**; split by **`plan`** (**Basic / Pro / Enterprise**); **new orgs** in last 7 / 30 days; optional **Stripe** summary (MRR, active subs, failed payments) when webhooks are trustworthy.
- **People / activity (coarse):** Total **season players** or **profiles** if the schema supports it without heavy joins; **signed-in activity** proxies only if you add lightweight analytics—avoid guessing from Clerk alone.
- **Drop-ins & registration (aggregate):** Sessions created, signups, waitlist pressure — enough to spot “is anyone using this?”
- **Games / scoring:** Games recorded, live vs final — validates the scoring product is getting real use.
- **Reports / exports:** CSV or **scheduled** exports for accounting and support (orgs, plans, key dates) — **no** bulk PII export by default.
- **Suggestions & feedback:** Queue from an in-app **“Send feedback”** form or email capture — triage states (**new / in progress / done**), link to **org slug** for context.
- **Support tools (later):** **Org lookup** by slug or name; read-only **org detail** (plan, Stripe customer id, feature flags). **Impersonation** only if legally/contractually clear — defer until needed.

### Nice-to-have after v1

- **Error / health:** API error rates, cron last-run (`**/api/cron/**`), Supabase storage usage.
- **Churn risk:** Orgs on Pro with **failed renewal** or **canceled** Stripe status in the last N days.

---

## Maintenance notes (for humans & agents)

- When you **ship** or **cancel** a roadmap item, edit the relevant phase and add a short **changelog line** at the bottom (date + one sentence).
- When code changes **materially** affect a bullet above, update this doc in the **same PR** when possible.

### Verification checklist — League website CMS (after deploy / migration)

Use this when validating `**league_site_content`**, organization_editors, and `**league-site`** storage are live.

1. **Database:** Tables `**league_site_content`** and `**organization_editors`** exist; RLS enabled (app uses service role in API routes).
2. **Storage:** Bucket `**league-site`** exists and is **public**; uploads from **League website** return a URL that loads in the browser.
3. **Owner flow:** **Save draft** does not change the public page; **Publish** updates `**/league/[slug]`** (and hub JSON `**leagueSite`**) for anonymous visitors.
4. **Editor flow:** Invited user (email must resolve in Clerk) sees only **League website**; cannot open other dashboard areas without redirect.
5. **Public safety:** Draft-only content never appears in `**GET /api/join/[slug]/hub`** or on the league home for logged-out users.
6. `**?edit=1`:** Banner appears only when signed in as owner/editor **for that slug**; others see no banner.

### Changelog

- **2026-05-11:** **Auth — Facebook sign-in:** Enabled **Facebook** alongside **Google** in **Clerk** (Dashboard → **Social connections**). Sign-in UI unchanged (`**app/(auth)/sign-in/[[...rest]]/page.tsx`**). **Roadmap:** documented **iPhone / true fullscreen vs embed overlay** constraint under **Pro → Video / stream** (immersive web mode vs player fullscreen vs OBS / first-party stream).
- **2026-05-11:** **Public league — Stream & Schedule polish:** **`components/public-stream/StreamWithOverlay.tsx`** — fullscreen control moved to **top-right** only (~52px target); removed transparent **bottom-half** layer that blocked embed **play/pause** on mobile/desktop; overlay score band unchanged (**pointer-events: none**). **`app/league/[slug]/page.tsx`** — Stream tab intro matches video column width on desktop (**`maxWidth: min(960px)`**, centered); simplified Stream tab helper sentence; Schedule cards are **whole-row links** to scoreboard or drop-ins (**Enter/Space** + click); recurring **Show more dates** uses **`stopPropagation`**. **`GET /api/join/[slug]/sessions`** — **`max_waitlist`** on drop-in schedule rows; **`dropinSignupSummary`** reads roster + waitlist caps (**Full — waitlist closed**, **Roster full**, etc.). **`/games/demo/scoreboard`** — static demo scoreboard (**`gameId === demo`** in **`app/games/[gameId]/scoreboard/page.tsx`** + **`demo-scoreboard.tsx`**).
- **2026-05-11:** **League home — Up next (Home tab):** **`/league/[slug]`** — **LIVE** banner when **`/api/join/[slug]/stream`** reports a live game (→ Stream tab); **Calendar / Up next** card with up to **6** rows using **`buildLeagueScheduleDisplayRows`** (same recurring drop-in grouping as Schedule); links to **`/games/[id]/scoreboard`**, **`/join/[slug]/dropins`**, and **`?tab=schedule`**; empty state when nothing upcoming; **Latest update** card from first published **News** section (excerpt + link to **News** tab). Implemented in **`app/league/[slug]/page.tsx`** (`**truncatePlainText**`, **`homeSchedulePreviewRows`**).
- **2026-05-11:** **Copy pass (public + dashboard):** Plain-language helper and legend text—public league **Schedule** uses **League game** (replacing “Season game” in UI), **Repeating drop-in** for recurring clusters; dashboard **Drop-ins** subtitle + **?** help modal, session list/signup option blurbs, standings privacy + history retention lines; **Games** tab label/subtitle; **Season signup timing** copy; **Settings** (logo, registration URLs, brand color + cap note, theme blurbs, waiver PDF hints); **League website** intro + section order explainer; **team manage panel** stats/jersey poll text; **`leagueIdentityUiHint`** in **`lib/league-identity-change-policy.ts`**; **`PRO_BRAND_COLOR_COUNTER_HELPER`** in **`lib/pro-brand-color-limits.ts`**.
- **2026-05-11:** **Phase 4 drop-ins complete:** Public **`/join/[slug]/dropins`** mobile-first layout (stacked cards, touch-friendly controls, safe-area padding, form field sizing) and dashboard drop-in surfaces (list, check-in, payments, team builder, standings tabs) hardened via shared **`dropin-*`** utilities in **`app/globals.css`**.
- **2026-05-09:** **Roadmap — Phase 9 (platform admin):** Added **`Phase 9 — Platform admin / operations`** for **MyLeaguePortal staff** only (distinct from organizer dashboard and Phase 7 league staff): plan/org aggregates, Stripe-oriented summaries, coarse activity, drop-in and scoring usage signals, exports, feedback queue, and gated support tools — **not started**; access via hard-gated auth (e.g. Clerk allowlist) + audit trail for sensitive actions.
- **2026-05-09:** **Pro counter UX + org-scoped CMS saves/uploads:** Exported **`PRO_BRAND_COLOR_COUNTER_HELPER`** (`**lib/pro-brand-color-limits.ts`**) for **Dashboard → Settings** (Brand color) and public **`?edit=1`** look controls; clarifies presets/fonts vs brand-color cap and that **Publish** is for website **page drafts**, not org appearance. **`PUT /api/league-site`** accepts optional **`organization_id`** (same auth pattern as GET); **`POST /api/league-site/upload`** accepts **`organization_id`** in **FormData**. **`/league/[slug]?edit=1`** sends **`organization_id`** on save/publish/hero/gallery upload so **multi-org** accounts target the league on the URL.
- **2026-05-09:** **Public league edit — org-scoped theme & Pro color counter:** Introduced **`getOrgAccessForOrganization`** / **`getOrgAccessForClerkUserAndSlug`**, **`GET /api/me/org-access?slug=`**, and scoped **`PATCH /api/league-org-appearance`** + **`GET /api/league-site?organization_id=`** so brand/theme saves and **Pro “color changes left”** always refer to the **same league** as the URL (fixes counters stuck or wrong when multiple org relationships exist). **Typography & theme** (`?edit=1`) is **owner-only**; website editors no longer see that panel. **`proBrandColorChangesRemaining`** fixed when **`brand_color_change_period_start`** is null (UI was stuck at **5/5**). **`npm run db:apply-pending`** now includes **theme** migrations (`20260505110000`, `20260506140000`, `20260506200000`); optional **`scripts/sql/ensure-organization-appearance-columns.sql`** for Supabase SQL Editor. **Product rule:** **preset** changes are unlimited; **brand color** edits consume the **Pro** monthly cap (**Publish** applies only to CMS draft → public site content, not org appearance). BroadcastChannel keeps Settings / dashboard league-site / public edit in sync for appearance meta.
- **2026-05-08:** **Next.js 16 proxy convention:** Renamed root **`middleware.ts`** → **`proxy.ts`** (Clerk **`clerkMiddleware`** and **`config.matcher`** unchanged). Clears the build deprecation notice; behavior for public league/join/games routes and protected dashboard is the same.
- **2026-05-08:** **Live overlay + public watch URL:** Game overlay page polls **1s** when status is live (backup to realtime). Scoring dashboard shows **public watch link** as visible **`https://www.myleagueportal.com/...`** ( **`getPublicSiteOrigin()`** / **`NEXT_PUBLIC_PUBLIC_SITE_URL`** ) plus copy — league homepage when org slug exists, else public scoreboard. Removed duplicate OBS/preview copy rows from scorer (fans use site embed).
- **2026-05-08:** **Scoring operator pass (starters + shot buttons) + DB migration applied:** Dashboard scoring now supports fixed **5-on-5 starter slots**, jersey-first tap workflow, and one-tap **+3 / +2 / +1 FT** plus core box-score actions. Added `**games.home_starter_slot_ids`** / `**away_starter_slot_ids`** and `**player_game_stats.fg2m/fg3m/ftm`** via migration `**20260507200000_game_starters_shooting.sql`**, with API score recompute and public scoreboard columns updated.
- **2026-05-09:** **Drop-ins UX polish + ordering controls:** Dashboard drop-in check-in now supports roster/waitlist views with numbered order and organizer move up/down + move across lists. Public drop-ins now mirror numbered roster/waitlist order. Visual refresh started for public drop-ins with subtle **preset-aware** gradient background and cleaner spacing; responsive pass started for dashboard drop-ins forms/stats/tabs.
- **2026-05-07:** **League News tab + syndicated team news + standings endpoint:** league home now has a dedicated **News** tab (separate from About). Team News tab merges team posts with league-level `news` CMS sections so organizers can post once and fan-facing team pages inherit those updates. Added `**GET /api/join/[slug]/standings`** and wired league `Standings` tab to render W/L/PCT and leader callouts from recorded finals.
- **2026-05-07:** **Edit-page reliability + UI polish:** on-page theme save (`**PATCH /api/league-org-appearance`**) now has migration-safe org lookup fallbacks (id/slug/owner) to avoid false organizer “Organization not found” failures. League team cards removed mixed shorthand `border` + `borderLeft` style updates, and hero edit control hides uploaded URL text for cleaner editing.
- **2026-05-07:** **Public league schedule personalization + public roster headshots:** `GET /api/join/[slug]/sessions` now emits a combined `scheduleItems` feed (season games + drop-ins) with per-user `is_user_playing` flags resolved from signed-in player/drop-in records. `**/league/[slug]` Schedule tab now renders **Your upcoming games** and **You’re playing** highlights while preserving one full list with safe drop-in-only CTAs. Public team payload/roster now supports optional `players.avatar_url` and renders headshots on `**/league/[slug]/teams/[teamId]` roster/stats rows with initials fallback.
- **2026-05-07:** **Join hub route consolidation:** `**/join/[slug]` now redirects to `**/league/[slug]` so browse traffic lands on the main public league home while keeping registration/drop-in routes (`**/join/[slug]/register` and `**/join/[slug]/dropins`).
- **2026-05-11:** **Roadmap structure + schedule direction update:** Added explicit roadmap framing for **Past / Current / Future** sections. Captured schedule IA decision to keep a **single combined schedule list** with required type indicators (**League game** vs **Drop-in** in product UI; was “Season game” in early notes) and safe CTA behavior. Added planned **Pro** personalization for signed-in players (`Your upcoming games` + `You’re playing` highlights).
- **2026-05-11:** **Public team page tabs + stream/house rules + manage “Page & links”:** `**/league/[slug]/teams/[teamId]`** — **Overview / News / Schedule / Roster / Stats** (`**?tab=`** shareable). **Basic:** **Stats** tab shows a **locked** preview with upgrade CTA; **Pro:** full season stat columns + last-game line; **Enterprise:** **Game log** on **Stats**; **Pro** sees a locked upsell for the full log. **Overview:** optional **Watch live** (`**teams.stream_url`**) and **House rules** (`**teams.house_rules`**); jersey poll + next game + news preview + sponsors shell. Migration **`20260511120000_team_stream_house_rules.sql`**; **`PATCH /api/teams/[teamId]/public-page`**. **Manage team** adds **Page & links** (edit stream URL, house rules, reminder to use **Dashboard → Games** for score sheets) plus renamed **Logo & poll** / **News** / **Events** tabs. **Next:** deep link from Overview to an in-app **live game / stream** page when that surface exists (see Pro **Video / stream** bullet).
- **2026-05-06:** **Public team page shows team news + calendar:** `**GET /api/join/[slug]/teams/[teamId]`** returns `**team_news`** and `**team_calendar_upcoming`** from `**team_news_posts`** / `**team_calendar_events`**; `**/league/[slug]/teams/[teamId]`** renders **Team news** and **Team calendar · upcoming** (with map links) above the roster when data exists.
- **2026-05-06:** **Team Manager mode now functional (news + calendar):** added team-scoped data + APIs for Team Manager workspace: `**team_news_posts`** and `**team_calendar_events`** (migration `**20260507013000_team_manager_news_calendar.sql**`), endpoints under `**/api/teams/[teamId]/news`** and `**/api/teams/[teamId]/calendar`** (+ CSV import route), and wired `**/dashboard/teams/[teamId]`** tabs for create/list/delete team posts and events.
- **2026-05-06:** **Team Manager mode shell in Teams:** added dedicated route `**/dashboard/teams/[teamId]`** for team-page operations (logo + jersey poll controls) with tabs for **Team Page / News / Calendar** so team editing is no longer forced into the main Teams list. Shared org access now allows owner + editor roles to manage team-page logo/poll operations; team create/delete remains owner-only.
- **2026-05-06:** **Team page permissions + layout polish:** Team page management APIs now honor shared org access (owner + website editor) for team-page operations (team logo upload/remove and jersey poll controls via Dashboard Teams), while destructive team create/delete remains owner-only. Public team page content width increased for stronger visual hierarchy.
- **2026-05-06:** **Public team page engagement pass + hook fix:** fixed React hook-order issue in `**/league/[slug]/teams/[teamId]`** by keeping hook calls unconditional. Added roster avatar placeholders, league-leader stat badges (top-5 league totals on visible stat columns), and an Enterprise **Team sponsors** section shell on the public team page.
- **2026-05-06:** **Public team page fan-experience pass:** `**/league/[slug]/teams/[teamId]`** now includes a high-visibility jersey poll banner when open, breadcrumb-style league navigation, explicit season context in hero, team-color top accent strip, and a **Next game** card (opponent + date/time + optional map link from `games.location`). Enterprise game history section is labeled **Game log**.
- **2026-05-06:** **Public team page reliability + logo tooling:** Public team APIs `**GET /api/join/[slug]/teams`** and `**GET /api/join/[slug]/teams/[teamId]`** now resolve orgs through `**fetchOrganizationForPublicJoin`** (trim + case-tolerant slug fallback), preventing false **Organization not found** on valid public links. Middleware marks `**/league(.*)`** + `**/api/join(.*)`** (+ `**/games(.*)`**) as public routes. **Dashboard → Teams** now includes per-team logo upload/remove wiring (`**POST/DELETE /api/teams/[teamId]/logo`**) so Pro/Enterprise organizers can set `**teams.logo_url`** used by `**/league/[slug]/teams/[teamId]`**.
- **2026-05-06:** **Dev: DB migrations script + season games seed:** `npm run db:apply-pending` runs `scripts/db-apply-pending.mjs` against **`DATABASE_URL`** (or `DIRECT_URL` / `POSTGRES_URL`) from **`.env.local`** — applies identity + `teams.logo_url` migrations. **`POST /api/dev/seed-teams-players`** accepts **`withGamesAndStats`** (round-robin **final** games + **`player_game_stats`**) and optional **`previewPublicTier`**: `"pro"` \| `"enterprise"` to temporarily set **`organizations.plan`** for public team page previews (dev only).
- **2026-05-06:** **Public team page tier depth:** **`GET /api/join/[slug]/teams/[teamId]`** returns **`public_tier`**, **`season_record`**, **`league_rank`**, **`player_totals`** (from **`player_game_stats`**), **`last_game`**, Enterprise **`recent_games`**; hero prefers **`teams.logo_url`** when set (migration **`20260508100000_teams_logo_url.sql`**). UI: Basic roster only + upgrade hint; Pro five headline stats + record/rank/teaser; Enterprise adds TOV/PF + recent games list. Helpers **`lib/public-team-season-view.ts`**, **`lib/public-team-page-payload.ts`**.
- **2026-05-06:** **Public team surface + organizer tools + league identity:** **`/league/[slug]/teams/[teamId]`** — **`GET /api/join/[slug]/teams/[teamId]`** adds **`publicFontKey`**; page uses **`getPublicThemeInputsForOrg`** (Basic: no custom org logo on public), optional league-site Google font. **Dashboard → Teams** — **Public team page** link, **Jersey numbers…** modal (open/close poll, copy link, conflicts). **Dashboard → Settings** — **League name** + **registration slug** tier limits (**Basic:** one lifetime name change, slug API-locked; **Pro:** **90**-day cooldown on name or slug change; **Enterprise:** **30** days); **`organizations.league_name_change_count`**, **`league_name_last_changed_at`**, **`lib/league-identity-change-policy.ts`**, migration **`20260507120000_league_identity_change_limits.sql`**, **`PATCH /api/settings`** enforcement.
- **2026-05-11:** **League public theme & tab UX polish:** **`lib/leagueTheme.ts`** — **`harmonizePresetContrast`** improves heading/body/muted vs page + card backgrounds across presets; **Midnight** uses explicit light foreground; **`publicHeroThemeFromPreset`** keeps hero title/subtitle readable on the dark gradient; on-page sticky bar **Save draft** uses **`preset.body`**. **Dashboard → Settings** and on-page **Typography & theme** use **compact preset pills** (names in a row; descriptions via **`title`**). **`LeaguePublicTabBar`:** removed full-width **`borderBottom`** under the tab row; **flex-wrap** instead of **`overflow-x: auto`** so there is no horizontal scrollbar/track beside **Home / Schedule / …**; removed unused **`.league-public-tab-scroll`** in **`app/globals.css`**. Product doc: **five named** theme ids + migration **`20260506200000_league_theme_choice_ids.sql`** called out in **Shipped (CMS v1)**.
- **2026-05-07:** **Public league IA + tiers + theme system:** Tab navigation on `**/league/[slug]`** (Home / Schedule / Standings / Teams / About; `**?tab=`** shareable). **Basic** public experience uses **house branding** (fixed palette, no custom hero/logo on web); **`PUT /api/league-site`** and **upload** return **403**; on-page edit shows **locked** Pro controls. **Pro+:** **`league_appearance_mode`** (Bright/Midnight), **`PATCH /api/league-org-appearance`**, live **preview** while editing, **Dashboard → Settings** parity for color/preset/mode; **`publicFontKey`** on league site JSON; **Pro** brand-color monthly limit surfaced in editor. **Join / register / drop-ins / team** pages use **`getPublicThemeInputsForOrg`** + **`resolveThemePreset(..., appearanceMode)`**. **`GET /api/league-site`** returns **`appearance`** + **`maxGalleryImages`**. Typescript fixes in **`PATCH /api/seasons`** (legacy row shape + signup branch). Migration: **`20260506140000_league_appearance_mode.sql`**.
- **2026-05-06:** **Season settings save reliability + signup mode schema alignment:** Dashboard Seasons now supports inline season rename/date edits for active cards with compact signup timing controls, and `PATCH /api/seasons` is hardened for owner/editor access checks and clearer save errors. Applied remote migration `**20260505100000_season_signup_opens_mode.sql**` so season signup mode fields exist in production and season saves no longer fail on missing columns.
- **2026-05-05:** **League home — pro sports polish + CMS ergonomics:** `**/league/[slug]`** — hero **stat pills** (teams / players / active season), stronger participate band (**Get on the floor**), upgraded CMS sections (accent rail, typography), **season headquarters** card + **team cards** (initial badge, gradient wash, season hint). **Section blocks:** explicit **Up / Down** controls on **Dashboard → League website** (plus existing on-page editor). **Dev-only:** `**POST /api/dev/seed-teams-players`** with `**withLeagueSiteDemo: true`** seeds demo **text / news / media** + arena hero for leagues like `**vancouvarites`** during local design review.
- **2026-05-05:** **League website CMS v1:** dashboard **League website** (draft/publish, hero background upload, text/news/media sections), `**leagueSite`** on hub, **organization_editors** + Clerk email lookup, `**/api/me/org-access`**, Storage bucket `**league-site`**. Migrations applied to Supabase (`**20260505213000**` / `**20260505213039**`). **Next:** calendar/games widgets, richer text.
- **2026-05-05:** **Public visual pass (creative polish):** upgraded `**/league/[slug]`** and `**/league/[slug]/teams/[teamId]`** with professional hero cards, stronger information hierarchy, status chips, improved participation/CTA cards, and themed roster/table surfaces while preserving Basic-tier data boundaries (no public contact info or advanced stats). This is the new visual baseline for iterative adjustments.
- **2026-05-05:** **Theme UX sequencing:** prioritize polishing real **league page** and **team page** layouts first; then add a **mini league-page visual preview** in Settings (instead of simple color swatches) so preview mirrors the finalized live layout. Team page theming should align with league theme system.
- **2026-05-05:** **Theme tiering update:** **Pro** gets brand-color-driven league themes with **5 auto-generated presets**, optional logo color extraction helper, and monthly brand-color change limits (default target **5/month**, configurable). **Enterprise** keeps all Pro behavior plus **fully customizable themes with unlimited edits**.
- **2026-05-05:** **Public league/team stability fix:** team page roster API now reads `players.positions` (removed invalid `position` select) so `**/league/[slug]/teams/[teamId]`** loads reliably; began league-home copy/spacing polish. **Next focus:** page-by-page visual refinement with final approved designs (league page first, then team page).
- **2026-05-10:** **League home** route `**/league/[slug]`** (news, season context, teams → `**/league/[slug]/teams/[teamId]`**, participate → join). `**/join/[slug]`** slimmed to signup hub + link to league home. `**/join/.../teams/[id]**` → redirect to `**/league/...**`. Settings shows public league home URL.
- **2026-05-09:** **Team manager / club workspace** (Product direction): calendar **upload/import**, **member reminders**, **scheduled polls** (e.g. default **24h before game** or manager-chosen times), **home game rule presets** in team management, **team front page** with **news**; extra ideas (next-game strip, file stash, roles). **Phase 5 / 6** cross-links. **Next product focus:** **League home**; team workspace deferred.
- **2026-05-08:** **Product direction:** **League home** vs **Join** IA — dedicated `**/league/[slug]`** (target) for browse/watch (teams, stats, **YouTube/Twitch** Pro vs **first-party stream** Enterprise, **overlay** tiers); `**/join/[slug]`** for signup/participate; **interim** Basic team shell on join until League home ships. **Phase 7** overlay bullet split **Pro basic** vs **Enterprise** customizable + sponsors.
- **2026-05-04:** **Public league + team shell (Basic):** `**GET /api/join/[slug]/teams`** (directory + open poll hints) and `**GET /api/join/[slug]/teams/[teamId]`** (public roster: name, jersey #, positions—no email/phone); pages `**/join/[slug]`** (team cards) and `**/join/[slug]/teams/[teamId]`** (roster table + jersey poll card).
- **2026-05-06:** **Phase 8 — Help & documentation** (searchable help hub, plans/payments explainers—late phase). **Phase 7** multi-admin clarified as **invited dashboard access, revocable by organizer**. **Product direction** staff bullet aligned with same wording.
- **2026-05-05:** **Product direction** section: plan tiers for **public league & team pages** (Basic / Pro / Enterprise): roster-on-public for all tiers with upgrade depth (stats, headshots, logos, Enterprise awards/analytics/page edit); **Phase 7** multi-admin framed as **delegated staff**; **messaging / in-app chat** marked **deferred TBD** with Pro+ placeholder.
- **2026-05-04:** **Team jersey poll (Phase 5 MVP):** tables `jersey_polls` / `jersey_poll_responses`, organizer APIs `**/api/jersey-polls`**, public `**/api/join/[slug]/jersey-poll/...`** + page `**/join/[slug]/jersey-poll/[pollId]**`. Migration: `**20260504120000_team_jersey_poll.sql**`.
- **2026-05-04:** Public `**/join/[slug]` hub**: landing page with links to **season registration** (`/join/[slug]/register`) and **drop-ins** (`/join/[slug]/dropins`); hub API at `**GET /api/join/[slug]/hub`**.
- **2026-05-04:** Roadmap reformatted for clarity; aligned completed work with live scoring, public scoreboard, drop-in reputation (organizer), Phase 4 table, and cron scope.
- **2026-05-04:** Season signup **schedule** (opens/closes); **competitive-only** seasons (removed drop-in season type); **jersey #** removed from public season registration—dashboard Players + planned **team jersey poll** (Phase 5).