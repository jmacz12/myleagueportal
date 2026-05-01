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
    console.log('Step 1: Auth check')
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.log('Step 2: userId =', userId)

    const { plan } = await req.json()
    console.log('Step 3: plan =', plan)

    const selectedPlan = PLANS[plan as keyof typeof PLANS]
    if (!selectedPlan?.priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }
    console.log('Step 4: priceId =', selectedPlan.priceId)

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, stripe_customer_id')
      .eq('clerk_user_id', userId)
      .single()

    if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    console.log('Step 5: org =', org.id)

    let customerId = org.stripe_customer_id

    if (!customerId) {
      console.log('Step 6: Creating Stripe customer')
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
    console.log('Step 7: customerId =', customerId)

    console.log('Step 8: Creating checkout session')
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: selectedPlan.priceId!, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?cancelled=true`,
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
    console.log('Step 9: session url =', session.url)

    return NextResponse.json({ url: session.url })

  } catch (err) {
    console.error('CHECKOUT ERROR:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}