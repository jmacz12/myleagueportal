import type Stripe from 'stripe'
import { normalizeOrgPlan } from '@/lib/org-plan-tier'

export type PaidPlanSlug = 'pro' | 'enterprise'

/** Normalize plan string from Stripe metadata or DB. */
export function normalizeBillingPlan(plan: string | undefined | null): 'basic' | 'pro' | 'enterprise' {
  return normalizeOrgPlan(plan)
}

/** Map Stripe Price id → plan (subscription updates when metadata is missing). */
export function paidPlanFromStripePriceId(priceId: string | undefined | null): PaidPlanSlug | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) return 'enterprise'
  return null
}

export type CheckoutOrgPlanSync = {
  organizationId: string
  clerkUserId: string
  plan: PaidPlanSlug
  subscriptionId: string | null
  customerId: string | null
}

/**
 * Extract org + plan from a completed Checkout Session (subscription mode).
 * Returns null if required metadata is missing or plan is not a paid tier.
 */
export function checkoutSessionOrgPlanSync(session: Stripe.Checkout.Session): CheckoutOrgPlanSync | null {
  if (session.mode !== 'subscription') return null
  const meta = session.metadata || {}
  const organizationId = typeof meta.organization_id === 'string' ? meta.organization_id.trim() : ''
  const clerkUserId = typeof meta.clerk_user_id === 'string' ? meta.clerk_user_id.trim() : ''
  const plan = normalizeBillingPlan(typeof meta.plan === 'string' ? meta.plan : null)
  if (!organizationId || !clerkUserId) return null
  if (plan !== 'pro' && plan !== 'enterprise') return null

  const sub = session.subscription
  const subscriptionId =
    typeof sub === 'string'
      ? sub
      : sub && typeof sub === 'object' && 'id' in sub
        ? (sub as Stripe.Subscription).id
        : null

  const cust = session.customer
  const customerId =
    typeof cust === 'string'
      ? cust
      : cust && typeof cust === 'object' && 'id' in cust
        ? (cust as Stripe.Customer).id
        : null

  return { organizationId, clerkUserId, plan, subscriptionId, customerId }
}
