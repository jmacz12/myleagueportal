import { NextResponse } from 'next/server'
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
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as any
      const { clerk_user_id, plan } = session.metadata

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
      const subscription = event.data.object as any
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
      const subscription = event.data.object as any

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