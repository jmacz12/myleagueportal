-- Fan email alerts (Phase 6): registration opens + drop-in reminders.

alter table public.organizations
  add column if not exists fan_email_registration_opens_enabled boolean not null default true;

alter table public.organizations
  add column if not exists fan_email_dropin_reminders_enabled boolean not null default true;

comment on column public.organizations.fan_email_registration_opens_enabled is
  'When true (Pro/Enterprise), roster players with email receive an email when season online registration opens.';

comment on column public.organizations.fan_email_dropin_reminders_enabled is
  'When true (Pro/Enterprise), drop-in registrants with email receive ~24h session reminder emails.';

alter table public.players
  add column if not exists fan_email_registration_opens_opt_out boolean not null default false;

comment on column public.players.fan_email_registration_opens_opt_out is
  'When true, skip registration-opens alert emails for this player.';

alter table public.dropin_registrations
  add column if not exists dropin_reminder_opt_out boolean not null default false;

comment on column public.dropin_registrations.dropin_reminder_opt_out is
  'When true, skip automated drop-in reminder emails for this registration.';

create table if not exists public.registration_opens_email_sends (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  sent_at timestamptz not null default now(),
  constraint registration_opens_email_sends_season_player unique (season_id, player_id)
);

create index if not exists registration_opens_email_sends_season_id_idx
  on public.registration_opens_email_sends (season_id);

comment on table public.registration_opens_email_sends is
  'Dedupes registration-opens alert emails (one row per season + player).';

create table if not exists public.dropin_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.dropin_sessions (id) on delete cascade,
  registration_id uuid not null references public.dropin_registrations (id) on delete cascade,
  sent_at timestamptz not null default now(),
  constraint dropin_reminder_sends_session_registration unique (session_id, registration_id)
);

create index if not exists dropin_reminder_sends_session_id_idx on public.dropin_reminder_sends (session_id);

comment on table public.dropin_reminder_sends is
  'Dedupes automated drop-in reminder emails (one row per session + registration).';
