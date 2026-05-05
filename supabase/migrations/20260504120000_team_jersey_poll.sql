-- Team jersey number polls: organizers open a poll per team; roster players submit a preferred
-- number via public join URL + email verification. Preferences complement dashboard jersey assignment
-- (still unique per season on players.jersey_number).

create table public.jersey_polls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- At most one open poll per team
create unique index jersey_polls_one_open_per_team on public.jersey_polls (team_id)
  where (status = 'open');

comment on table public.jersey_polls is
  'Organizer-started jersey preference poll for one team roster; public responses via Next.js API only.';

create index jersey_polls_org_idx on public.jersey_polls (organization_id);
create index jersey_polls_team_idx on public.jersey_polls (team_id);

create table public.jersey_poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.jersey_polls (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  preferred_number integer not null check (preferred_number >= 0 and preferred_number <= 99),
  submitted_at timestamptz not null default now(),
  unique (poll_id, player_id)
);

comment on table public.jersey_poll_responses is
  'One preferred jersey number per player per poll; duplicates allowed for organizer resolution.';

create index jersey_poll_responses_poll_idx on public.jersey_poll_responses (poll_id);

alter table public.jersey_polls enable row level security;
alter table public.jersey_poll_responses enable row level security;

-- Direct Supabase client access is not used for these tables; Next.js routes use the service role.
-- With RLS enabled and no policies, anon/authenticated roles receive no rows via PostgREST.
