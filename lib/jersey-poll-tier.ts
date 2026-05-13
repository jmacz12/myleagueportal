import { isProOrEnterprise } from '@/lib/org-plan-tier'

/** Jersey number polls: collect preferred numbers before you assign final roster numbers (Pro+). */
export const JERSEY_POLL_PRO_REQUIRED_MESSAGE =
  'Jersey number polls are a Pro and Enterprise feature. Upgrade in Dashboard → Settings.'

export function jerseyPollsEnabledForOrgPlan(plan: unknown): boolean {
  return isProOrEnterprise(plan)
}
