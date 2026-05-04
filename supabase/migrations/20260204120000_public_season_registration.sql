-- Run in Supabase SQL editor if migrations are not auto-applied.
-- Gates public /join/[slug]/register when organizer enables it.

alter table public.organizations
  add column if not exists public_season_registration boolean not null default false;

comment on column public.organizations.public_season_registration is
  'When true, hub shows season registration for an active competitive season.';
