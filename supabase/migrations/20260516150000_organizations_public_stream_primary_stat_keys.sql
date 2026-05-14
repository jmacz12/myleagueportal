-- Organizers choose five stats for Basic/Pro public stream + team season table; Enterprise shows full grid.
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS public_stream_primary_stat_keys jsonb NOT NULL DEFAULT '["min","pts","fg3m","tov","pf"]'::jsonb;

COMMENT ON COLUMN organizations.public_stream_primary_stat_keys IS
  'JSON array of five stat keys (min, pts, fg2m, fg3m, ftm, ast, reb, stl, blk, tov, pf) shown on Basic/Pro public fan surfaces.';
