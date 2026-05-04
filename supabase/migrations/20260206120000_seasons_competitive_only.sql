-- Legacy "drop-in season" rows are redundant with Dashboard → Drop-ins (dropin_sessions).
-- All seasons rows represent competitive league seasons only.
update public.seasons
set type = 'season'
where type = 'dropin';
