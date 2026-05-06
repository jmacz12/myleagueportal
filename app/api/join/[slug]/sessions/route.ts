import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { EMPTY_LEAGUE_SITE, parseLeagueSitePayload } from '@/lib/league-site'

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
      'id, name, slug, primary_color, logo_url, news_banner, news_banner_color, league_timezone, league_theme_preset, league_appearance_mode, plan'
    )
    .eq('slug', slug)
    .single()

  const { data: orgWithoutTz } = orgWithTzError
    ? await supabaseAdmin
        .from('organizations')
        .select('id, name, slug, primary_color, logo_url, news_banner, news_banner_color, plan')
        .eq('slug', slug)
        .single()
    : { data: null as any }

  const org =
    orgWithTz ||
    (orgWithoutTz
      ? {
          ...orgWithoutTz,
          league_timezone: null,
          league_theme_preset: 'classic',
          league_appearance_mode: 'light',
        }
      : null)
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

  const sessionIds = upcoming.map((s) => s.id)
  const signupsBySession = new Map<string, { full_name: string }[]>()
  if (sessionIds.length > 0) {
    const { data: regs } = await supabaseAdmin
      .from('dropin_registrations')
      .select('session_id, full_name, created_at')
      .in('session_id', sessionIds)
      .eq('is_guest', false)
      .order('session_id', { ascending: true })
      .order('created_at', { ascending: true })

    for (const row of regs || []) {
      const sid = row.session_id as string
      const list = signupsBySession.get(sid) || []
      list.push({ full_name: String(row.full_name || '').trim() || 'Player' })
      signupsBySession.set(sid, list)
    }
  }

  const sessionsWithSignups = upcoming.map((s) => ({
    ...s,
    signups: signupsBySession.get(s.id) || [],
  }))

  let leagueSite = EMPTY_LEAGUE_SITE
  const { data: siteRow, error: siteErr } = await supabaseAdmin
    .from('league_site_content')
    .select('published')
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!siteErr && siteRow?.published != null) {
    leagueSite = parseLeagueSitePayload(siteRow.published)
  }

  return NextResponse.json({
    sessions: sessionsWithSignups,
    organization: org,
    leagueSite,
  })
}