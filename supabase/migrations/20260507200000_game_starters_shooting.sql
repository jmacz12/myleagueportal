-- Fixed 5 starter slots per side (null = empty slot); preserves gaps for scorekeeper layout
ALTER TABLE games DROP COLUMN IF EXISTS home_starter_player_ids;
ALTER TABLE games DROP COLUMN IF EXISTS away_starter_player_ids;

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS home_starter_slot_ids jsonb NOT NULL DEFAULT '[null,null,null,null,null]'::jsonb,
  ADD COLUMN IF NOT EXISTS away_starter_slot_ids jsonb NOT NULL DEFAULT '[null,null,null,null,null]'::jsonb;

-- Shooting makes; pts = 2*fg2m + 3*fg3m + ftm (kept in sync in API)
ALTER TABLE player_game_stats
  ADD COLUMN IF NOT EXISTS fg2m integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fg3m integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ftm integer NOT NULL DEFAULT 0;

-- Legacy rows: approximate as 2PT + FT only (no 3PT history)
UPDATE player_game_stats
SET
  fg2m = GREATEST(0, COALESCE(pts, 0)) / 2,
  ftm = MOD(GREATEST(0, COALESCE(pts, 0)), 2),
  fg3m = 0
WHERE COALESCE(pts, 0) > 0
  AND COALESCE(fg2m, 0) = 0
  AND COALESCE(fg3m, 0) = 0
  AND COALESCE(ftm, 0) = 0;
