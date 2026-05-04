-- Optional schedule for public season signup (timestamps in UTC).
alter table public.seasons
  add column if not exists online_registration_opens_at timestamptz;

alter table public.seasons
  add column if not exists online_registration_closes_at timestamptz;

comment on column public.seasons.online_registration_opens_at is
  'If set, public signup is not shown until this instant (UTC).';

comment on column public.seasons.online_registration_closes_at is
  'If set, public signup stops after this instant (UTC).';
