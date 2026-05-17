-- Game-day reminder emails (~24h before scheduled league games).

alter table public.organizations
  add column if not exists game_email_reminders_enabled boolean not null default true;

comment on column public.organizations.game_email_reminders_enabled is
  'When true (Pro/Enterprise), roster players with email receive ~24h game reminder emails.';

alter table public.players
  add column if not exists game_reminders_opt_out boolean not null default false;

comment on column public.players.game_reminders_opt_out is
  'When true, skip automated game reminder emails for this player.';

create table if not exists public.game_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  sent_at timestamptz not null default now(),
  constraint game_reminder_sends_game_player unique (game_id, player_id)
);

create index if not exists game_reminder_sends_game_id_idx on public.game_reminder_sends (game_id);

comment on table public.game_reminder_sends is
  'Dedupes automated game reminder emails (one row per game + player).';
