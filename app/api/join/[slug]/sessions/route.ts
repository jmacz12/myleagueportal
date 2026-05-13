import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { EMPTY_LEAGUE_SITE, parseLeagueSitePayload } from '@/lib/league-site'
import { pickFeaturedPublicScheduleItem } from '@/lib/league-public-home-schedule'
import { normalizeOrgPlan } from '@/lib/org-plan-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type DropinSessionRow = {
  id: string
  scheduled_at: string
  signup_opens: string | null
  signup_opens_days_before: number | null
  signup_opens_at: string | null
  allow_signups: boolean | null
  name: string | null
  location: string | null
  fee_amount: number | null
  max_players?: number | null
  max_waitlist?: number | null
  is_recurring?: boolean | null
}

type SessionWithSignups = DropinSessionRow & {
  signups: { full_name: string }[]
  waitlist: { full_name: string }[]
}

type GameScheduleRow = {
  id: string
  season_id: string
  home_team_id: string | null
  away_team_id: string | null
  status: string | null
  scheduled_at: string | null
  location: string | null
}

function isSignupOpen(session: DropinSessionRow, now: Date) {
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

async function getSignedInEmails(): Promise<string[]> {
  const { userId } = await auth()
  if (!userId) return []
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const emails = (user.emailAddresses || [])
      .map((row) => String(row.emailAddress || '').trim().toLowerCase())
      .filter(Boolean)
    return [...new Set(emails)]
  } catch {
    return []
  }
}

export async function GET(
  _req: Request,
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
    : { data: null as null }

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
  const upcoming = ((sessions || []) as DropinSessionRow[]).filter((s) => {
    const t = new Date(s.scheduled_at).getTime()
    const isUpcoming = !Number.isNaN(t) && t >= now.getTime() - 60_000
    return isUpcoming && isSignupOpen(s, now)
  })

  const sessionIds = upcoming.map((s) => s.id)
  const rosterBySession = new Map<string, { full_name: string }[]>()
  const waitlistBySession = new Map<string, { full_name: string }[]>()
  if (sessionIds.length > 0) {
    const { data: regs } = await supabaseAdmin
      .from('dropin_registrations')
      .select('session_id, full_name, created_at, is_waitlist')
      .in('session_id', sessionIds)
      .eq('is_guest', false)
      .order('session_id', { ascending: true })
      .order('created_at', { ascending: true })

    for (const row of regs || []) {
      const sid = row.session_id as string
      const name = { full_name: String(row.full_name || '').trim() || 'Player' }
      const wl = Boolean((row as { is_waitlist?: boolean }).is_waitlist)
      const map = wl ? waitlistBySession : rosterBySession
      const list = map.get(sid) || []
      list.push(name)
      map.set(sid, list)
    }
  }

  const sessionsWithSignups = upcoming.map((s) => ({
    ...s,
    /** Confirmed roster (counts toward max_players). */
    signups: rosterBySession.get(s.id) || [],
    /** Waitlist after roster is full (counts toward max_waitlist). */
    waitlist: waitlistBySession.get(s.id) || [],
  }))

  const { data: seasonRows } = await supabaseAdmin
    .from('seasons')
    .select('id')
    .eq('organization_id', org.id)
    .eq('type', 'season')

  const seasonIds = (seasonRows || []).map((row) => row.id as string)
  const { data: games } =
    seasonIds.length > 0
      ? await supabaseAdmin
          .from('games')
          .select('id, season_id, home_team_id, away_team_id, status, scheduled_at, location')
          .eq('organization_id', org.id)
          .in('season_id', seasonIds)
      : { data: [] as GameScheduleRow[] }

  const upcomingGames = ((games || []) as GameScheduleRow[]).filter((g) => {
    if (!g.scheduled_at) return false
    if (g.status === 'final') return false
    const ts = new Date(g.scheduled_at).getTime()
    return Number.isFinite(ts) && ts >= now.getTime() - 60_000
  })

  const teamIds = Array.from(
    new Set(
      upcomingGames
        .flatMap((g) => [g.home_team_id, g.away_team_id])
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
    )
  )
  const { data: teams } =
    teamIds.length > 0
      ? await supabaseAdmin.from('teams').select('id, name').in('id', teamIds)
      : { data: [] as { id: string; name: string | null }[] }
  const teamNameById = new Map((teams || []).map((t) => [String(t.id), String(t.name || 'Team')]))

  const signedInEmails = await getSignedInEmails()
  let playingTeamIds = new Set<string>()
  let signedUpSessionIds = new Set<string>()
  if (signedInEmails.length > 0) {
    const [myPlayersRes, myDropinsRes] = await Promise.all([
      supabaseAdmin
        .from('players')
        .select('team_id')
        .eq('organization_id', org.id)
        .in('email', signedInEmails),
      sessionIds.length > 0
        ? supabaseAdmin
            .from('dropin_registrations')
            .select('session_id')
            .in('session_id', sessionIds)
            .in('email', signedInEmails)
            .eq('is_guest', false)
        : Promise.resolve({ data: [] as { session_id: string }[] }),
    ])
    playingTeamIds = new Set(
      (myPlayersRes.data || [])
        .map((p) => (typeof p.team_id === 'string' ? p.team_id : null))
        .filter((v): v is string => !!v)
    )
    signedUpSessionIds = new Set(
      (myDropinsRes.data || [])
        .map((r) => (typeof r.session_id === 'string' ? r.session_id : null))
        .filter((v): v is string => !!v)
    )
  }

  const seasonScheduleItems = upcomingGames
    .map((g) => {
      const homeName = g.home_team_id ? teamNameById.get(g.home_team_id) || 'Home team' : 'Home team'
      const awayName = g.away_team_id ? teamNameById.get(g.away_team_id) || 'Away team' : 'Away team'
      const isUserPlaying =
        !!g.home_team_id &&
        !!g.away_team_id &&
        (playingTeamIds.has(g.home_team_id) || playingTeamIds.has(g.away_team_id))
      return {
        id: `game:${g.id}`,
        source_id: g.id,
        type: 'season_game' as const,
        name: `${awayName} at ${homeName}`,
        scheduled_at: g.scheduled_at as string,
        location_label: (g.location as string | null) ?? null,
        is_user_playing: isUserPlaying,
      }
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  const dropinScheduleItems = (sessionsWithSignups as SessionWithSignups[]).map((s) => {
    const rosterLen = s.signups.length
    const waitLen = s.waitlist.length
    const maxP = s.max_players
    const maxWl = s.max_waitlist
    return {
      id: `dropin:${s.id}`,
      source_id: s.id,
      type: 'drop_in' as const,
      name: s.name || 'Drop-in session',
      scheduled_at: s.scheduled_at as string,
      location_label: (s.location as string | null) ?? null,
      fee_amount: typeof s.fee_amount === 'number' ? s.fee_amount : null,
      is_user_playing: signedUpSessionIds.has(s.id),
      is_recurring: !!s.is_recurring,
      roster_count: rosterLen,
      waitlist_count: waitLen,
      max_players: typeof maxP === 'number' ? maxP : null,
      max_waitlist: typeof maxWl === 'number' && maxWl > 0 ? maxWl : null,
    }
  })

  const scheduleItems = [...seasonScheduleItems, ...dropinScheduleItems].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )

  const featuredGame = pickFeaturedPublicScheduleItem(scheduleItems)

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
    scheduleItems,
    featuredGame,
    organization: { ...org, plan: normalizeOrgPlan((org as { plan?: unknown }).plan) },
    leagueSite,
  })
}