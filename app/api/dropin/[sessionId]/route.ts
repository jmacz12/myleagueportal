import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await params

  const { data: session } = await supabaseAdmin
    .from('dropin_sessions').select('*').eq('id', sessionId).single()

  const { data: registrations } = await supabaseAdmin
    .from('dropin_registrations').select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ session, registrations: registrations || [] })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await params
  const body = await req.json()
  const { registration_id, checked_in, payment_status } = body

  // ─── Registration row (check-in / payment) ─────────────────────────────────
  if (registration_id != null && registration_id !== '') {
    const updates: Record<string, unknown> = {}
    if (checked_in !== undefined) updates.checked_in = checked_in
    if (payment_status !== undefined) updates.payment_status = payment_status

    const { error } = await supabaseAdmin
      .from('dropin_registrations').update(updates).eq('id', registration_id)

    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ─── Session metadata (dashboard edit) ─────────────────────────────────────
  const {
    name,
    date,
    start_time,
    end_time,
    location,
    max_players,
    fee_amount,
    payment_method,
    etransfer_info,
    signup_opens,
    signup_opens_days_before,
    signup_opens_at,
  } = body

  if (!name || !date || !start_time) {
    return NextResponse.json(
      { error: 'Name, date and start time required' },
      { status: 400 }
    )
  }

  const { data: org } = await supabaseAdmin
    .from('organizations').select('id')
    .eq('clerk_user_id', userId).single()
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: existing } = await supabaseAdmin
    .from('dropin_sessions')
    .select('id, organization_id')
    .eq('id', sessionId)
    .single()

  if (!existing || existing.organization_id !== org.id) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const mode = signup_opens || 'open_now'
  const allow_signups =
    mode === 'immediately' || mode === 'open_now' || mode === undefined
  const signupDaysBefore =
    mode === 'days_before' || mode === 'scheduled'
      ? parseInt(String(signup_opens_days_before), 10) || 3
      : null
  const signupAt =
    mode === 'specific' || mode === 'custom' ? (signup_opens_at || null) : null

  const row = {
    name,
    scheduled_at: `${date}T${start_time}:00`,
    ends_at: end_time ? `${date}T${end_time}:00` : null,
    location: location || null,
    max_players: parseInt(String(max_players), 10) || 16,
    fee_amount: parseFloat(String(fee_amount)) || 0,
    payment_method: payment_method || 'cash_or_etransfer',
    etransfer_info: etransfer_info || null,
    allow_signups,
    signup_opens: mode,
    signup_opens_days_before: signupDaysBefore,
    signup_opens_at: signupAt,
  }

  const { error: updErr } = await supabaseAdmin
    .from('dropin_sessions')
    .update(row)
    .eq('id', sessionId)

  if (updErr) return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  return NextResponse.json({ success: true })
}