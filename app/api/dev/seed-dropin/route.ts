import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Development only: insert one upcoming drop-in for a league slug so you can
 * test /join/[slug] without using the dashboard. Call:
 *   curl -X POST http://localhost:3000/api/dev/seed-dropin -H "Content-Type: application/json" -d "{\"slug\":\"your-slug\"}"
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  let slug = ''
  try {
    const body = await req.json()
    slug = typeof body.slug === 'string' ? body.slug : ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!slug.trim()) {
    return NextResponse.json({ error: 'Body must include { "slug": "your-league-slug" }' }, { status: 400 })
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug.trim())
    .single()

  if (orgErr || !org) {
    return NextResponse.json(
      { error: `No organization with slug "${slug}". Check spelling (copy slug from dashboard URL settings).` },
      { status: 404 }
    )
  }

  const start = new Date()
  start.setDate(start.getDate() + 3)
  start.setHours(19, 0, 0, 0)

  const { data: row, error } = await supabaseAdmin
    .from('dropin_sessions')
    .insert({
      organization_id: org.id,
      name: `Quick test drop-in (${start.toLocaleDateString()})`,
      scheduled_at: start.toISOString(),
      max_players: 16,
      fee_amount: 10,
      payment_method: 'cash_or_etransfer',
      etransfer_info: null,
      allow_signups: true,
      status: 'upcoming',
      signup_opens: 'immediately',
      signup_opens_days_before: null,
      signup_opens_at: null,
      is_recurring: false,
      recurring_frequency: null,
      recurring_until: null,
      location: 'Test venue (delete in dashboard after verifying)',
    })
    .select('id, name, scheduled_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    message: 'Refresh /join/{slug} — you should see this session under Available Drop-ins.',
    session: row,
  })
}
