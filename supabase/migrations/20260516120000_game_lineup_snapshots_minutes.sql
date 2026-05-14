-- Lineup snapshots at each on-court change (with game clock) drive minutes played.
-- Assumes 600s (10:00) regulation quarters for timeline math until configurable length exists.

CREATE TABLE IF NOT EXISTS public.game_lineup_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  period integer NOT NULL CHECK (period >= 1),
  clock_remaining_seconds integer NOT NULL CHECK (clock_remaining_seconds >= 0),
  home_starter_slot_ids jsonb NOT NULL DEFAULT '[null,null,null,null,null]'::jsonb,
  away_starter_slot_ids jsonb NOT NULL DEFAULT '[null,null,null,null,null]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_lineup_snapshots_game_created
  ON public.game_lineup_snapshots (game_id, created_at);

ALTER TABLE public.player_game_stats
  ADD COLUMN IF NOT EXISTS seconds_played integer NOT NULL DEFAULT 0;

COMMENT ON TABLE public.game_lineup_snapshots IS
  'One row per lineup change during scoring; used with games.period/game_clock to compute seconds_played.';
