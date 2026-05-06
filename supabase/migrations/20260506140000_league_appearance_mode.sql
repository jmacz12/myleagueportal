-- Public league page brightness: light (default) vs dark ("Midnight") shell
alter table organizations
  add column if not exists league_appearance_mode text;

update organizations
set league_appearance_mode = 'light'
where league_appearance_mode is null or trim(league_appearance_mode) = '';

alter table organizations
  alter column league_appearance_mode set default 'light';
