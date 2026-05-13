/**
 * Canonical org billing tier from `organizations.plan`.
 * Use everywhere we gate features or compute limits so casing / stray DB values behave consistently.
 */

export type OrgPlanSlug = 'basic' | 'pro' | 'enterprise'

export function normalizeOrgPlan(plan: unknown): OrgPlanSlug {
  const p = String(plan ?? 'basic').toLowerCase().trim()
  if (p === 'enterprise') return 'enterprise'
  if (p === 'pro') return 'pro'
  return 'basic'
}

export function seasonLimitForPlan(plan: unknown): number {
  const n = normalizeOrgPlan(plan)
  if (n === 'enterprise') return 99999
  if (n === 'pro') return 3
  return 1
}

export function isBasic(plan: unknown): boolean {
  return normalizeOrgPlan(plan) === 'basic'
}

export function isPro(plan: unknown): boolean {
  return normalizeOrgPlan(plan) === 'pro'
}

export function isEnterprise(plan: unknown): boolean {
  return normalizeOrgPlan(plan) === 'enterprise'
}

export function isProOrEnterprise(plan: unknown): boolean {
  const n = normalizeOrgPlan(plan)
  return n === 'pro' || n === 'enterprise'
}
