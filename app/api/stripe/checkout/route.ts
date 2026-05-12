import { NextResponse } from 'next/server'
import { stripe, PLANS } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { plan } = await req.json()

    const selectedPlan = PLANS[plan as keyof typeof PLANS]
    if (!selectedPlan?.priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, stripe_customer_id')
      .eq('clerk_user_id', userId)
      .single()

    if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

    let customerId = org.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          clerk_user_id: userId,
          organization_id: org.id,
        },
      })
      customerId = customer.id

      await supabaseAdmin
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', org.id)
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: selectedPlan.priceId!, quantity: 1 }],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard/settings?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/settings?cancelled=true`,
      metadata: {
        clerk_user_id: userId,
        organization_id: org.id,
        plan,
      },
      subscription_data: {
        metadata: {
          clerk_user_id: userId,
          organization_id: org.id,
          plan,
        },
      },
    })

    return NextResponse.json({ url: session.url })

  } catch (err) {
    console.error('CHECKOUT ERROR:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}