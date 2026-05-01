import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, name, slug, primary_color, plan, stripe_customer_id, stripe_subscription_id')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  return NextResponse.json({ org })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, plan')
    .eq('clerk_user_id', userId)
    .single()

  if (!org) return NextResponse.json({ error: 'No organization found' }, { status: 404 })

  const { name, slug, primary_color } = await req.json()

  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
  }

  // Check if slug is taken by someone else
  const { data: existing } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .neq('id', org.id)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'That URL is already taken. Please choose a different one.' },
      { status: 400 }
    )
  }

  // Only allow color change on pro/enterprise
  const updateData: any = { name, slug }
  if (org.plan !== 'basic') {
    updateData.primary_color = primary_color
  }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update(updateData)
    .eq('id', org.id)

  if (error) return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })

  return NextResponse.json({ success: true })
}