import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { requireOwnerOrgForDashboard } from '@/lib/org-access'
import { maxActiveDropinSessionsForPlan, normalizeOrgPlan } from '@/lib/org-plan-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parseMaxWaitlist(raw: unknown): number {
  const n = parseInt(String(raw ?? '').trim(), 10)
  if (Number.isNaN(n)) return 5
  return Math.max(0, Math.min(100, n))
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireOwnerOrgForDashboard(userId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { data: sessions } = await supabaseAdmin
    .from('dropin_sessions').select('*')
    .eq('organization_id', gate.organizationId)
    .order('scheduled_at', { ascending: true })

  const rows = sessions || []
  const sessionIds = rows.map((s) => s.id as string).filter(Boolean)

  const rosterCountBySession = new Map<string, number>()
  if (sessionIds.length > 0) {
    const { data: regs } = await supabaseAdmin
      .from('dropin_registrations')
      .select('session_id, is_guest, is_waitlist')
      .in('session_id', sessionIds)

    for (const row of regs || []) {
      const sid = String(row.session_id || '')
      if (!sid) continue
      if (Boolean(row.is_guest)) continue
      if (Boolean((row as { is_waitlist?: boolean }).is_waitlist)) continue
      rosterCountBySession.set(sid, (rosterCountBySession.get(sid) || 0) + 1)
    }
  }

  const sessionsWithCounts = rows.map((s) => ({
    ...s,
    _count: rosterCountBySession.get(String(s.id)) || 0,
  }))

  return NextResponse.json({ sessions: sessionsWithCounts })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireOwnerOrgForDashboard(userId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const {
    name, date, start_time, end_time, location,
    max_players, max_waitlist, fee_amount, payment_method,
    etransfer_info,
    signup_opens, signup_opens_days_before, signup_opens_at,
    is_recurring, recurring_frequency, recurring_until,
  } = await req.json()

  if (!name || !date || !start_time) {
    return NextResponse.json({ error: 'Name, date and start time required' }, { status: 400 })
  }

  const { data: orgRow } = await supabaseAdmin
    .from('organizations')
    .select('plan')
    .eq('id', gate.organizationId)
    .maybeSingle()

  const sessionCap = maxActiveDropinSessionsForPlan(orgRow?.plan)
  if (sessionCap !== null) {
    const { count: activeCount } = await supabaseAdmin
      .from('dropin_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', gate.organizationId)
      .eq('status', 'upcoming')

    const current = activeCount ?? 0
    const datesPreview: string[] = [date]
    if (is_recurring && recurring_until && recurring_frequency) {
      const end = new Date(recurring_until)
      const currentDate = new Date(date)
      const increment =
        recurring_frequency === 'weekly' ? 7 : recurring_frequency === 'biweekly' ? 14 : 30
      while (true) {
        currentDate.setDate(currentDate.getDate() + increment)
        if (currentDate > end) break
        datesPreview.push(currentDate.toISOString().split('T')[0])
        if (datesPreview.length > 52) break
      }
    }
    if (current + datesPreview.length > sessionCap) {
      const planLabel = normalizeOrgPlan(orgRow?.plan) === 'basic' ? 'Basic' : 'Pro'
      return NextResponse.json(
        {
          error:
            sessionCap === 1
              ? `${planLabel} allows 1 active drop-in session at a time. End or delete your current session, or upgrade for more.`
              : `${planLabel} allows up to ${sessionCap} active drop-in sessions. You have ${current}; this would add ${datesPreview.length} more.`,
        },
        { status: 403 }
      )
    }
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
    organization_id: gate.organizationId,
    name: is_recurring
      ? `${name} — ${new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`
      : name,
    scheduled_at: `${d}T${start_time}:00`,
    ends_at: end_time ? `${d}T${end_time}:00` : null,
    location: location || null,
    max_players: parseInt(max_players) || 16,
    max_waitlist: parseMaxWaitlist(max_waitlist),
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
  if (!session_id) return NextResponse.json({ error: 'session_id is required' }, { status: 400 })

  const gate = await requireOwnerOrgForDashboard(userId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { data: session } = await supabaseAdmin
    .from('dropin_sessions')
    .select('id, organization_id')
    .eq('id', session_id)
    .single()

  if (!session || session.organization_id !== gate.organizationId) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { error: regErr } = await supabaseAdmin
    .from('dropin_registrations')
    .delete()
    .eq('session_id', session_id)
  if (regErr) {
    return NextResponse.json({ error: regErr.message || 'Failed to delete session registrations' }, { status: 500 })
  }

  const { error: sessionErr } = await supabaseAdmin
    .from('dropin_sessions')
    .delete()
    .eq('id', session_id)
    .eq('organization_id', gate.organizationId)
  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message || 'Failed to delete session' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}