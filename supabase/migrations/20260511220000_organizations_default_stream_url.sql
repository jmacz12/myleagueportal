-- Optional league-wide stream used when a live game has no team stream_url (or as fallback ordering in API).
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS default_stream_url text;

COMMENT ON COLUMN public.organizations.default_stream_url IS 'Optional YouTube/Twitch watch URL for the league; used for live game stream tab when teams have no stream_url.';
