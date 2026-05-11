import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')!

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const meta = (session.metadata ?? null) as {
        clerk_user_id?: string
        plan?: string
      } | null
      const clerk_user_id = meta?.clerk_user_id
      const plan = meta?.plan
      if (!clerk_user_id || !plan) break

      await supabaseAdmin
        .from('organizations')
        .update({
          plan,
          stripe_subscription_id: session.subscription,
        })
        .eq('clerk_user_id', clerk_user_id)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const plan = subscription.metadata?.plan

      if (plan) {
        await supabaseAdmin
          .from('organizations')
          .update({ plan })
          .eq('stripe_subscription_id', subscription.id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription

      await supabaseAdmin
        .from('organizations')
        .update({
          plan: 'basic',
          stripe_subscription_id: null,
        })
        .eq('stripe_subscription_id', subscription.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}