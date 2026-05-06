-- Public league page CMS: draft/published JSON + optional extra editors (Clerk user ids).
-- Access from app uses service role + Clerk checks in API routes.

create table if not exists public.league_site_content (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  draft jsonb not null default '{"heroBackgroundUrl":null,"sections":[]}'::jsonb,
  published jsonb not null default '{"heroBackgroundUrl":null,"sections":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.league_site_content is
  'Organizer-editable public league home: draft vs published JSON payloads.';

create table if not exists public.organization_editors (
  id uuid primary key default gen_random_uuid (),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  clerk_user_id text not null,
  invited_email text,
  created_at timestamptz not null default now(),
  constraint organization_editors_org_user unique (organization_id, clerk_user_id)
);

comment on table public.organization_editors is
  'Additional Clerk users who may edit league public site content (not org owner).';

create index if not exists organization_editors_clerk_user_id_idx on public.organization_editors (clerk_user_id);

alter table public.league_site_content enable row level security;
alter table public.organization_editors enable row level security;

-- Private to service role / Postgres; app uses Clerk + service client.
-- (No policies: deny direct PostgREST access for anon/authenticated.)

-- Storage for hero + gallery uploads (uploads go through Next API + service role).
insert into storage.buckets (id, name, public)
values ('league-site', 'league-site', true)
on conflict (id) do nothing;
