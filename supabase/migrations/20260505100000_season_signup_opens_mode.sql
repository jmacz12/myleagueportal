-- Drop-in–style signup timing for competitive seasons (dashboard + join hub).

alter table public.seasons
  add column if not exists signup_opens_mode text default 'open_now';

alter table public.seasons
  add column if not exists signup_opens_days_before integer;

comment on column public.seasons.signup_opens_mode is
  'open_now | closed | scheduled | custom — when public season signup opens on the join page.';

comment on column public.seasons.signup_opens_days_before is
  'For scheduled: whole days before season start_date that signup opens.';

update public.seasons
set signup_opens_mode = case
  when coalesce(allow_online_registration, false) = false then 'closed'
  when online_registration_opens_at is not null then 'custom'
  else 'open_now'
end;
