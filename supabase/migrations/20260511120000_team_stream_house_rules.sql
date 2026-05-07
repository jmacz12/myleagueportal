-- Optional public team page extras: live stream/watch link and house rules (manager-edited).
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS stream_url text,
  ADD COLUMN IF NOT EXISTS house_rules text;

COMMENT ON COLUMN public.teams.stream_url IS 'External URL for live stream or watch page; shown on public team Overview when set.';
COMMENT ON COLUMN public.teams.house_rules IS 'Plain text house rules / reminders for players; shown on public team Overview when set.';
