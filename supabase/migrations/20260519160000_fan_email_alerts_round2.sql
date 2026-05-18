-- Fan email alerts round 2: league/team news publish + final-game stats highlights.

alter table public.organizations
  add column if not exists fan_email_news_publish_enabled boolean not null default true;

alter table public.organizations
  add column if not exists fan_email_stats_highlights_enabled boolean not null default true;

comment on column public.organizations.fan_email_news_publish_enabled is
  'When true (Pro/Enterprise), roster players receive emails when league website news is published or a team posts news.';

comment on column public.organizations.fan_email_stats_highlights_enabled is
  'When true (Pro/Enterprise), roster players on final games receive a box-score highlights email after stats are recorded.';

alter table public.players
  add column if not exists fan_email_news_publish_opt_out boolean not null default false;

alter table public.players
  add column if not exists fan_email_stats_highlights_opt_out boolean not null default false;

comment on column public.players.fan_email_news_publish_opt_out is
  'When true, skip news publish alert emails for this player.';

comment on column public.players.fan_email_stats_highlights_opt_out is
  'When true, skip stats highlight emails for this player.';

create table if not exists public.league_site_news_email_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  site_updated_at timestamptz not null,
  sent_at timestamptz not null default now(),
  constraint league_site_news_email_sends_org_updated unique (organization_id, site_updated_at)
);

create index if not exists league_site_news_email_sends_org_id_idx
  on public.league_site_news_email_sends (organization_id);

comment on table public.league_site_news_email_sends is
  'Dedupes league website publish alert blasts (one row per org + league_site_content.updated_at).';

create table if not exists public.team_news_email_sends (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.team_news_posts (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  sent_at timestamptz not null default now(),
  constraint team_news_email_sends_post_player unique (post_id, player_id)
);

create index if not exists team_news_email_sends_post_id_idx on public.team_news_email_sends (post_id);

comment on table public.team_news_email_sends is
  'Dedupes team news post alert emails (one row per post + player).';

create table if not exists public.stats_highlight_email_sends (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  sent_at timestamptz not null default now(),
  constraint stats_highlight_email_sends_game_player unique (game_id, player_id)
);

create index if not exists stats_highlight_email_sends_game_id_idx on public.stats_highlight_email_sends (game_id);

comment on table public.stats_highlight_email_sends is
  'Dedupes stats highlight emails after final games (one row per game + player).';

alter table public.league_site_content
  add column if not exists published_at timestamptz null;

comment on column public.league_site_content.published_at is
  'Set when organizers publish the league website; fan news emails key off this timestamp.';
