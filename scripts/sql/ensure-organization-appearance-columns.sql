-- Paste into Supabase → SQL Editor if preset/theme saves fall back to "only color saved".
-- Mirrors supabase/migrations/20260505110000_* and 20260506140000_* (safe to re-run).

alter table organizations
  add column if not exists league_theme_preset text;

alter table organizations
  add column if not exists brand_color_change_count integer;

alter table organizations
  add column if not exists brand_color_change_period_start timestamptz;

alter table organizations
  add column if not exists league_appearance_mode text;

update organizations set brand_color_change_count = 0 where brand_color_change_count is null;

alter table organizations
  alter column brand_color_change_count set default 0;

alter table organizations
  alter column brand_color_change_count set not null;

update organizations
set league_theme_preset = coalesce(league_theme_preset, 'preset-1')
where league_theme_preset is null;

update organizations
set league_appearance_mode = 'light'
where league_appearance_mode is null or trim(league_appearance_mode) = '';

alter table organizations
  alter column league_appearance_mode set default 'light';
