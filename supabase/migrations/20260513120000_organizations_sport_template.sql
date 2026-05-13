-- League sport template: drives season registration position options and public payloads.
alter table public.organizations
  add column if not exists sport_template_id text not null default 'basketball';

comment on column public.organizations.sport_template_id is
  'Sport template key (e.g. basketball, soccer). Controls default registration positions; see lib/sport-templates.ts.';
