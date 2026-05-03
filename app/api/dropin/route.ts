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
    .from('organizations').select('id')
    .eq('clerk_user_id', userId).single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: sessions } = await supabaseAdmin
    .from('dropin_sessions').select('*')
    .eq('organization_id', org.id)
    .order('scheduled_at', { ascending: true })

  return NextResponse.json({ sessions: sessions || [] })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: org } = await supabaseAdmin
    .from('organizations').select('id')
    .eq('clerk_user_id', userId).single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const {
    name, date, start_time, end_time, location,
    max_players, fee_amount, payment_method,
    etransfer_info, allow_signups,
    signup_opens, signup_opens_days_before, signup_opens_at,
    is_recurring, recurring_frequency, recurring_until,
  } = await req.json()

  if (!name || !date || !start_time) {
    return NextResponse.json({ error: 'Name, date and start time required' }, { status: 400 })
  }

  const dates: string[] = [date]

  if (is_recurring && recurring_until && recurring_frequency) {
    const end = new Date(recurring_until)
    const current = new Date(date)
    const increment = recurring_frequency === 'weekly' ? 7
      : recurring_frequency === 'biweekly' ? 14 : 30

    while (true) {
      current.setDate(current.getDate() + increment)
      if (current > end) break
      dates.push(current.toISOString().split('T')[0])
      if (dates.length > 52) break
    }
  }

  const inserts = dates.map((d) => ({
    organization_id: org.id,
    name: is_recurring
      ? `${name} — ${new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`
      : name,
    scheduled_at: `${d}T${start_time}:00`,
    ends_at: end_time ? `${d}T${end_time}:00` : null,
    location: location || null,
    max_players: parseInt(max_players) || 16,
    fee_amount: parseFloat(fee_amount) || 0,
    payment_method: payment_method || 'cash_or_etransfer',
    etransfer_info: etransfer_info || null,
    allow_signups: signup_opens === 'immediately' || signup_opens === undefined,
    status: 'upcoming',
    signup_opens: signup_opens || 'immediately',
    signup_opens_days_before: signup_opens === 'days_before' ? parseInt(signup_opens_days_before) : null,
    signup_opens_at: signup_opens === 'specific' ? signup_opens_at : null,
    is_recurring: is_recurring || false,
    recurring_frequency: is_recurring ? recurring_frequency : null,
    recurring_until: is_recurring ? recurring_until : null,
  }))

  const { error } = await supabaseAdmin.from('dropin_sessions').insert(inserts)
  if (error) return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })

  return NextResponse.json({ success: true, count: inserts.length })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { session_id } = await req.json()
  const { error } = await supabaseAdmin
    .from('dropin_sessions').delete().eq('id', session_id)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  return NextResponse.json({ success: true })
}