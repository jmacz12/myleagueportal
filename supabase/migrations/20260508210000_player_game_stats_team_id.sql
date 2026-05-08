-- Denormalized team on box score rows (used for score aggregation + dashboards).
-- No FK: keeps apply order flexible across environments.
ALTER TABLE player_game_stats
  ADD COLUMN IF NOT EXISTS team_id uuid;

CREATE INDEX IF NOT EXISTS idx_player_game_stats_team_game ON player_game_stats (game_id, team_id);

-- Optional; API does not require this column (avoids schema-cache errors on older DBs).
ALTER TABLE player_game_stats
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
