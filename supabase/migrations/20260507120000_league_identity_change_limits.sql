-- Track league display name / URL slug changes for tiered cooldowns (Settings).

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS league_name_change_count integer NOT NULL DEFAULT 0;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS league_name_last_changed_at timestamptz NULL;

COMMENT ON COLUMN organizations.league_name_change_count IS 'Number of times league name or slug was changed after creation (identity edits).';
COMMENT ON COLUMN organizations.league_name_last_changed_at IS 'When the league name or slug was last changed; used for Pro/Enterprise cooldowns.';
