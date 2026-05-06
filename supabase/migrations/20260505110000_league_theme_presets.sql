alter table organizations
  add column if not exists league_theme_preset text,
  add column if not exists brand_color_change_count integer not null default 0,
  add column if not exists brand_color_change_period_start timestamptz;

update organizations
set league_theme_preset = coalesce(league_theme_preset, 'preset-1')
where league_theme_preset is null;
