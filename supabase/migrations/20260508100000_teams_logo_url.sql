-- Optional team logo for public team page (Pro+); upload UI can follow later.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS logo_url text NULL;

COMMENT ON COLUMN public.teams.logo_url IS 'Public team page avatar when set (Pro/Enterprise); falls back to league logo or initials.';
