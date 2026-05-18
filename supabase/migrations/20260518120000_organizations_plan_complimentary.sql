-- Complimentary plan: Pro/Enterprise features without Stripe billing (demo, comps, admin grants).
alter table organizations
  add column if not exists plan_complimentary boolean not null default false;

comment on column organizations.plan_complimentary is
  'When true, organizations.plan is granted access (no Stripe required); webhooks do not change plan.';
