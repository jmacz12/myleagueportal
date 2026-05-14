-- Minutes-played timeline uses regulation quarter length; organizers set it in Dashboard → Settings.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS scoring_quarter_minutes integer NOT NULL DEFAULT 10
    CHECK (scoring_quarter_minutes >= 4 AND scoring_quarter_minutes <= 20);

COMMENT ON COLUMN public.organizations.scoring_quarter_minutes IS
  'Regulation quarter length in whole minutes (4–20) for scoring clock + minutes-played math.';
