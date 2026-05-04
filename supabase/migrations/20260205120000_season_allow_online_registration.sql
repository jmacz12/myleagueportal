-- Per-season gate for public /join/[slug]/register (replaces org-wide toggle).
alter table public.seasons
  add column if not exists allow_online_registration boolean not null default false;

comment on column public.seasons.allow_online_registration is
  'When true, active competitive seasons show online season signup on the public join hub.';
