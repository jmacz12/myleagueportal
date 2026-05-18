/**
 * Complimentary / comped plan access (no Stripe subscription required).
 * Future Phase 9 admin can toggle `organizations.plan_complimentary`.
 */

export type OrgBillingRow = {
  plan?: unknown
  plan_complimentary?: boolean | null
}

export function isComplimentaryPlan(org: OrgBillingRow | null | undefined): boolean {
  return org?.plan_complimentary === true
}
