-- Team manager workspace data: team-scoped news + calendar events.
-- Access from app uses service role with Clerk checks in API routes.

create table if not exists public.team_news_posts (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  season_id uuid null references public.seasons (id) on delete set null,
  title text not null,
  body text not null,
  pinned boolean not null default false,
  created_by_clerk_user_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_news_posts_team_created_idx
  on public.team_news_posts (team_id, created_at desc);

create table if not exists public.team_calendar_events (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  season_id uuid null references public.seasons (id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz null,
  location text null,
  notes text null,
  source text not null default 'manual',
  created_by_clerk_user_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_calendar_events_team_starts_idx
  on public.team_calendar_events (team_id, starts_at asc);

alter table public.team_news_posts enable row level security;
alter table public.team_calendar_events enable row level security;
