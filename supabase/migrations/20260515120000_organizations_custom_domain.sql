-- Pro / Enterprise: bring-your-own hostname for public league + join URLs (DNS TXT verify).

alter table public.organizations
  add column if not exists custom_domain text,
  add column if not exists custom_domain_verification_token text,
  add column if not exists custom_domain_verified_at timestamptz;

comment on column public.organizations.custom_domain is
  'Lowercase ASCII hostname (no scheme/port). Public traffic on this host serves this org after DNS verification.';

comment on column public.organizations.custom_domain_verification_token is
  'Secret token expected at TXT _mlp-domain-verify.<hostname> until verified.';

comment on column public.organizations.custom_domain_verified_at is
  'When DNS verification succeeded; null means pending or disconnected.';

create unique index if not exists organizations_one_verified_custom_domain
  on public.organizations (lower(btrim(custom_domain)))
  where custom_domain_verified_at is not null
    and custom_domain is not null
    and length(btrim(custom_domain)) > 0;
