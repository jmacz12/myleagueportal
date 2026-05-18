import { normalizeOrgPlan, type OrgPlanSlug } from '@/lib/org-plan-tier'

const DEFAULT_DEMO_SLUGS = ['vancouvarites']

export function demoPlanSwitcherSlugs(): Set<string> {
  const fromEnv = process.env.DEMO_PLAN_SWITCHER_SLUGS?.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return new Set([...DEFAULT_DEMO_SLUGS.map((s) => s.toLowerCase()), ...(fromEnv ?? [])])
}

/** Owner-only demo control: switch tier without Stripe (complimentary leagues only). */
export function demoPlanSwitcherAllowed(slug: string | null | undefined, planComplimentary: boolean): boolean {
  if (!planComplimentary || !slug?.trim()) return false
  return demoPlanSwitcherSlugs().has(slug.trim().toLowerCase())
}

export function parseDemoPlanSwitch(value: unknown): OrgPlanSlug | null {
  const p = normalizeOrgPlan(typeof value === 'string' ? value : null)
  return p === 'basic' || p === 'pro' || p === 'enterprise' ? p : null
}
