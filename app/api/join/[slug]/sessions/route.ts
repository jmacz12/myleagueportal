import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isSignupOpen(session: any, now: Date) {
  const mode = session.signup_opens
  const scheduledAt = new Date(session.scheduled_at)
  if (Number.isNaN(scheduledAt.getTime())) return false

  // Support both old and new naming used across the project.
  if (mode === 'closed') return false
  if (!mode || mode === 'open_now' || mode === 'immediately') return true

  if (mode === 'scheduled' || mode === 'days_before') {
    const daysBefore = Number(session.signup_opens_days_before || 0)
    const opensAt = new Date(scheduledAt)
    opensAt.setDate(opensAt.getDate() - Math.max(daysBefore, 0))
    return now >= opensAt
  }

  if (mode === 'custom' || mode === 'specific') {
    if (!session.signup_opens_at) return false
    const opensAt = new Date(session.signup_opens_at)
    if (Number.isNaN(opensAt.getTime())) return false
    return now >= opensAt
  }

  // Safe fallback for unknown values.
  return !!session.allow_signups
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // 1. Get Organization ID from Slug
  const { data: orgWithTz, error: orgWithTzError } = await supabaseAdmin
    .from('organizations')
    .select(
      'id, name, slug, primary_color, logo_url, news_banner, news_banner_color, league_timezone'
    )
    .eq('slug', slug)
    .single()

  const { data: orgWithoutTz } = orgWithTzError
    ? await supabaseAdmin
        .from('organizations')
        .select('id, name, slug, primary_color, logo_url, news_banner, news_banner_color')
        .eq('slug', slug)
        .single()
    : { data: null as any }

  const org = orgWithTz || (orgWithoutTz ? { ...orgWithoutTz, league_timezone: null } : null)
  const orgError = orgWithTzError && !orgWithoutTz ? orgWithTzError : null

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  // Public drop-in list (same table as the dashboard). Status + cron keep stale rows out;
  // do not require scheduled_at >= now here — naive timestamps / TZ mismatches were hiding real sessions.
  const { data: sessions, error: sessionError } = await supabaseAdmin
    .from('dropin_sessions')
    .select('*')
    .eq('organization_id', org.id)
    .eq('status', 'upcoming')
    .order('scheduled_at', { ascending: true })

  if (sessionError) {
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }

  const now = new Date()
  const upcoming = (sessions || []).filter((s) => {
    const t = new Date(s.scheduled_at).getTime()
    const isUpcoming = !Number.isNaN(t) && t >= now.getTime() - 60_000
    return isUpcoming && isSignupOpen(s, now)
  })

  return NextResponse.json({
    sessions: upcoming,
    organization: org,
  })
}