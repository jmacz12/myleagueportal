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

  let { data: orgWithTz, error: orgWithTzError } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, slug, primary_color, plan, stripe_customer_id, stripe_subscription_id, news_banner, news_banner_color, league_timezone'
    )
    .eq('clerk_user_id', userId)
    .single()

  // Backward compatibility for databases that do not yet have league_timezone.
  const { data: orgWithoutTz } = orgWithTzError
    ? await supabaseAdmin
        .from('organizations')
        .select('id, name, slug, primary_color, plan, stripe_customer_id, stripe_subscription_id, news_banner, news_banner_color')
        .eq('clerk_user_id', userId)
        .single()
    : { data: null as any }

  const org = orgWithTz || (orgWithoutTz ? { ...orgWithoutTz, league_timezone: null } : null)

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

  const { name, slug, primary_color, news_banner, news_banner_color, league_timezone } = await req.json()

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

  // Allow update of name, slug, and news_banner
  const updateData: any = { name, slug, news_banner, news_banner_color, league_timezone: league_timezone || null }

  // Only allow color change on pro/enterprise
  if (org.plan !== 'basic') {
    updateData.primary_color = primary_color
  }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update(updateData)
    .eq('id', org.id)

  if (error) {
    const msg = String(error.message || '')
    // Backward compatibility: retry without league_timezone if column does not exist yet.
    if (msg.includes('league_timezone')) {
      const fallbackUpdate = { ...updateData }
      delete fallbackUpdate.league_timezone

      const { error: fallbackError } = await supabaseAdmin
        .from('organizations')
        .update(fallbackUpdate)
        .eq('id', org.id)

      if (fallbackError) return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
      return NextResponse.json({
        success: true,
        warning: 'Saved, but league timezone is not available until the database column is added.',
      })
    }
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}