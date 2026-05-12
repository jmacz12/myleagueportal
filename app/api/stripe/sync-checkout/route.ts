import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { checkoutSessionOrgPlanSync } from '@/lib/stripe-org-billing'
import { getOrgAccessForClerkUser } from '@/lib/org-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * After Checkout redirect, the webhook may not have run yet. Owner calls this
 * with `session_id` so we read Stripe, verify the session, and upsert plan + ids
 * (idempotent with the webhook).
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const sessionId =
    typeof body === 'object' && body !== null && 'sessionId' in body
      ? String((body as { sessionId?: unknown }).sessionId || '').trim()
      : ''
  if (!sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'Missing or invalid sessionId' }, { status: 400 })
  }

  const access = await getOrgAccessForClerkUser(userId)
  if (!access || access.role !== 'owner') {
    return NextResponse.json({ error: 'Only league owners can complete billing sync.' }, { status: 403 })
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (session.status !== 'complete') {
    return NextResponse.json({ error: 'Checkout session is not complete yet.' }, { status: 409 })
  }

  const sync = checkoutSessionOrgPlanSync(session)
  if (!sync) {
    return NextResponse.json({ error: 'Session is missing billing metadata.' }, { status: 422 })
  }

  if (sync.clerkUserId !== userId) {
    return NextResponse.json({ error: 'Session does not belong to the signed-in user.' }, { status: 403 })
  }

  if (sync.organizationId !== access.organization.id) {
    return NextResponse.json({ error: 'Session does not match your organization.' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {
    plan: sync.plan,
    stripe_subscription_id: sync.subscriptionId,
  }
  if (sync.customerId) {
    updates.stripe_customer_id = sync.customerId
  }

  const { error } = await supabaseAdmin.from('organizations').update(updates).eq('id', sync.organizationId)

  if (error) {
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, plan: sync.plan })
}
