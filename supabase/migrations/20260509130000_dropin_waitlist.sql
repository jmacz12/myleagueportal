-- Drop-in waitlist: after roster (max_players) is full, up to max_waitlist non-guest spots are waitlisted.

ALTER TABLE public.dropin_sessions
  ADD COLUMN IF NOT EXISTS max_waitlist integer NOT NULL DEFAULT 0;

ALTER TABLE public.dropin_registrations
  ADD COLUMN IF NOT EXISTS is_waitlist boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dropin_sessions.max_waitlist IS 'After roster is full, allow up to this many waitlist rows (0 = no waitlist).';
