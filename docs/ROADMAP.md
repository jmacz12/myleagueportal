# MyLeaguePortal — product roadmap

Readable breakdown of what exists today versus what is planned. Update this file when scope changes or a milestone ships.

---

## Roadmap structure (past / current / future)

- **Past (shipped):** `Phase 1–3 — Foundation & core`, plus dated entries in **Changelog**.
- **Current (active):** `Phase 4` and `Phase 5` (in progress / polishing).
- **Future (planned):** `Phase 6`, `Phase 7`, `Phase 8`, and `Product direction` bullets marked planned/deferred.
- **History log:** `Changelog` is the authoritative timeline of delivered changes.

---

## Product direction — public league & team pages (plan tiers, target)

Most of this is **not built yet**; this section records **Basic / Pro / Enterprise** intent so public surfaces and billing stay aligned.

### Information architecture (target)

- **League home** — A **dedicated public home for the league**: the place for everything **browse, follow, and watch**—teams & rosters, standings/stats (tiered), featured games, **video/stream**, stream **overlays** (tiered), news/banner, and clear paths to **join** the season or **drop-ins**. **Target route:** e.g. `**/league/[slug]`** (exact path TBD; Enterprise may pair with **custom domains** from Phase 7).
- **Join** — `**/join/[slug]`** is for **people taking action**: **season registration**, **drop-ins**, and **player tasks** (e.g. **jersey poll**). It should read as **“sign up / participate,”** not the full league destination. League home and join **cross-link** (e.g. “Register” on league home → join flows; “League home” from join when helpful).
- **Shipped (Basic shell):** `**/league/[slug]`** — league home with **sticky tab nav** (Home, Schedule, Standings, Teams, About): Home = participate CTAs + league status; Schedule = upcoming drop-ins (+ venue when present); Standings = Basic upgrade messaging vs Pro placeholder; Teams = directory; About = CMS sections. News banner, season context, **team directory** → `**/league/[slug]/teams/[teamId]`**, links to `**/join/...`**. `**/join/[slug]**` — signup hub. Legacy `**/join/[slug]/teams/[id]**` redirects to `**/league/.../teams/[id]**`.
- **Shipped (CMS v1):** Dashboard **League website** (`**/dashboard/league-site`**) and on-page editing at `**/league/[slug]?edit=1`** (owners / website editors) — **Save draft** / **Publish**; **hero** upload; **text**, **news**, **media** blocks with **Up / Down** reorder in dashboard and on-page editor. **Basic plan:** public league uses **MyLeaguePortal house branding** (fixed green + Classic preset + Bright); **no** custom hero / logo on public; **league-site save, publish, and uploads are API-blocked**; edit UI shows **locked** Pro previews and upgrade paths. **Pro+:** brand color, **five named presets** (**Classic / Bold / Soft / Bright / Midnight**; canonical ids on `**organizations.league_theme_preset**`, migration `**20260506200000_league_theme_choice_ids.sql**`), **Bright / Midnight** via `**organizations.league_appearance_mode**` (migration `**20260506140000_league_appearance_mode.sql**`) synced with **Dashboard → Settings** and on-page **Save brand & look** (`**/api/league-org-appearance**`); optional **page fonts** via `**league_site_content**` (`**publicFontKey**`). **Theme tokens** are **contrast-harmonized** in **`lib/leagueTheme.ts`** (readable type on page + card surfaces; **Midnight** = dark shell + light foreground; **public hero** keeps near-white hero type on the dark gradient). **Preset pickers:** compact **pill rows** in Settings and on-page editor (descriptions on hover/`title`). **Public tab bar:** **centered wrap** (no horizontal scroll / scrollbar) and **no** full-width border under the row—only the **active** tab accent underline. Live **theme preview** while editing (owner) before save. `**GET /api/join/[slug]/hub`** includes `**leagueSite`**, `**plan`**, appearance fields. APIs: `**/api/league-site`** (GET returns `**appearance**` meta + `**maxGalleryImages**`; PUT 403 on Basic), `**/api/league-site/upload`** (403 Basic), `**/api/me/org-access**`, `**/api/organization-editors**`. Join surfaces use `**resolveThemePreset(brand, preset, appearanceMode)**` + `**getPublicThemeInputsForOrg**` for tier-aware theming. Dev seed: `**POST /api/dev/seed-teams-players**` — `**withLeagueSiteDemo: true**` upserts rich `**league_site_content**`. Migrations: `**20260505213000_league_site_content.sql**` (+ `**20260505213039**` no-op).

### Basic

- **League home (Basic):** **House public theme** (MyLeaguePortal default green + Classic + Bright); **hosted-on** lockup instead of league logo on public; teams, registration, and drop-ins unchanged. **Custom league website** (hero, sections, fonts) is **Pro+**; Basic visitors do not see org custom colors/hero on the public web.
- **Team directory** → **public team pages** at `**/league/[slug]/teams/[teamId]`** (identity, season, **roster** without contact info, jersey poll link when open). **Roster on public** for all plans (names, jersey #, positions)—**no emails/phones on public** by default; plain roster (no stat strips). **Shipped:** tabbed layout (**Overview / News / Schedule / Roster / Stats** with `**?tab=`**); **Overview** can show a **Watch live** button when **`teams.stream_url`** is set (organizer-managed; external YouTube/Twitch/etc. for now).
- **No public team/player stats** on Basic.
- **League schedule UI (single list):** Keep season + drop-in items in one list, but require strong **type indicators** (`Season game` vs `Drop-in`) and action-safe CTAs (e.g. reserve/join only appears on drop-ins).

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
- **Stream overlay:** **Basic overlay** for OBS/streaming—**template-based**, limited customization (on-brand, not full white-label).
- **Personalized schedule highlight:** signed-in players can see `Your upcoming games` (priority rows at top + `You’re playing` markers), while the full schedule remains visible to everyone.

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
| **League timezone**             | Done / verify    | Consistent local rendering for organizers vs travelers.                                                                                                                               |
| **Automation**                  | Partial          | **Midnight cron:** session close (`/api/cron/close-sessions` + `CRON_SECRET`). Extend if you add pruning, reminders, or retention jobs.                                               |
| **Developer tools**             | Done             | Dev-only **seed drop-in** route for fast UI testing.                                                                                                                                  |
| **Season signup schedule**      | Done             | Optional `online_registration_opens_at` / `closes_at` on `seasons`; hub respects window. Migration: `20260207100000_season_online_registration_window.sql`.                           |
| **Jerseys (dashboard)**         | Done             | Organizers set **jersey #** on **Dashboard → Players** (per season uniqueness); not collected on public season signup.                                                                |
| **League website (CMS v1)**     | Done / verify    | Tabbed public league home; Basic vs Pro **gates** on save/upload; **Settings ↔ on-page** brand sync; **five named presets** + **Bright/Midnight** + fonts; **contrast harmonization** + compact **preset pills**; **tab bar** wrap (no scroll chrome) and no full-width border under tabs. Confirm Storage bucket + RLS; apply **`league_appearance_mode`** + **`league_theme_choice_ids`** migrations on deploy. |
| **League identity (Settings)** | Done             | **League name** + registration **slug** (public `/join/[slug]` + `/league/[slug]`) change limits in **`PATCH /api/settings`**: **Basic** — one lifetime **name** change; **slug** not editable (API rejects slug changes). **Pro** — **90-day** cooldown after any **name or slug** change. **Enterprise** — **30-day** cooldown. Tracking: **`organizations.league_name_change_count`**, **`league_name_last_changed_at`** (migration **`20260507120000_league_identity_change_limits.sql`**); logic in **`lib/league-identity-change-policy.ts`**; Dashboard Settings locks fields + helper copy while cooling down. |


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

- **2026-05-11:** **Roadmap structure + schedule direction update:** Added explicit roadmap framing for **Past / Current / Future** sections. Captured schedule IA decision to keep a **single combined schedule list** with required type indicators (**Season game** vs **Drop-in**) and safe CTA behavior. Added planned **Pro** personalization for signed-in players (`Your upcoming games` + `You’re playing` highlights).
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