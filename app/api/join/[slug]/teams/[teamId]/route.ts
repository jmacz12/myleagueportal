import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { EMPTY_LEAGUE_SITE, isLeagueSiteNewsSurfaceSection, parseLeagueSitePayload } from '@/lib/league-site'
import { fetchOrganizationForPublicJoin, normalizeJoinSlugParam } from '@/lib/join-public-org'
import { jerseyPollsEnabledForOrgPlan } from '@/lib/jersey-poll-tier'
import { getJerseyPollSelfPayload } from '@/lib/jersey-poll-self'
import { normalizeOrgPlan } from '@/lib/org-plan-tier'
import { normalizePublicPrimaryStatKeys } from '@/lib/public-primary-stats'
import { buildPublicTeamSeasonExtras } from '@/lib/public-team-page-payload'
import { normalizePublicTeamTier } from '@/lib/public-team-season-view'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatPosition(row: {
  positions?: string[] | null
}): string | null {
  const arr = row.positions
  if (Array.isArray(arr) && arr.length > 0) return arr.join(', ')
  return null
}

/**
 * Public team page payload — roster without email/phone.
 * Basic: identity + roster + poll link only.
 * Pro: + record, rank, five headline stat totals, last game teaser, optional team logo.
 * Enterprise: + TOV/PF columns + recent games list (still uses recorded games only).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; teamId: string }> }
) {
  const { slug: slugRaw, teamId } = await params
  const slug = normalizeJoinSlugParam(slugRaw)
  if (!slug) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const orgHub = await fetchOrganizationForPublicJoin(supabaseAdmin, slug)
  if (!orgHub?.id) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const org = {
    id: orgHub.id,
    name: orgHub.name,
    slug: orgHub.slug,
    primary_color: orgHub.primary_color,
    logo_url: orgHub.logo_url,
    league_theme_preset: orgHub.league_theme_preset,
    league_appearance_mode: orgHub.league_appearance_mode,
    plan: orgHub.plan,
    sport_template_id: orgHub.sport_template_id,
  }

  type TeamRow = {
    id: string
    name: string
    color: string | null
    season_id: string
    organization_id: string
    logo_url?: string | null
    stream_url?: string | null
    house_rules?: string | null
  }

  let team: TeamRow | null = null

  let teamFull = await supabaseAdmin
    .from('teams')
    .select('id, name, color, season_id, organization_id, logo_url, stream_url, house_rules')
    .eq('id', teamId)
    .single()

  if (teamFull.error) {
    const msg = String(teamFull.error.message || '')
    if (msg.includes('stream_url') || msg.includes('house_rules') || msg.includes('column')) {
      teamFull = await supabaseAdmin
        .from('teams')
        .select('id, name, color, season_id, organization_id, logo_url')
        .eq('id', teamId)
        .single()
    }
  }

  if (teamFull.error) {
    const msg = String(teamFull.error.message || '')
    if (msg.includes('logo_url') || msg.includes('column')) {
      const fallback = await supabaseAdmin
        .from('teams')
        .select('id, name, color, season_id, organization_id')
        .eq('id', teamId)
        .single()
      if (!fallback.error && fallback.data) {
        team = {
          ...(fallback.data as Omit<TeamRow, 'logo_url' | 'stream_url' | 'house_rules'>),
          logo_url: null,
          stream_url: null,
          house_rules: null,
        }
      }
    }
  } else if (teamFull.data) {
    team = teamFull.data as TeamRow
  }

  if (!team || team.organization_id !== org.id) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 })
  }

  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('id, name')
    .eq('id', team.season_id)
    .maybeSingle()

  const playersFull = await supabaseAdmin
    .from('players')
    .select('id, full_name, jersey_number, positions, avatar_url')
    .eq('team_id', teamId)
    .order('full_name', { ascending: true })

  let players = playersFull.data
  let playersError = playersFull.error
  if (playersError) {
    const msg = String(playersError.message || '')
    if (msg.includes('avatar_url') || msg.includes('column')) {
      const fb = await supabaseAdmin
        .from('players')
        .select('id, full_name, jersey_number, positions')
        .eq('team_id', teamId)
        .order('full_name', { ascending: true })
      players = (fb.data || []).map((p) => ({ ...p, avatar_url: null as string | null }))
      playersError = fb.error
    }
  }

  if (playersError) {
    return NextResponse.json({ error: 'Failed to load roster' }, { status: 500 })
  }

  let openJerseyPollId: string | null = null
  if (jerseyPollsEnabledForOrgPlan(org.plan)) {
    const { data: openPoll } = await supabaseAdmin
      .from('jersey_polls')
      .select('id')
      .eq('team_id', teamId)
      .eq('status', 'open')
      .maybeSingle()
    openJerseyPollId = openPoll?.id ?? null
  }

  const { userId } = await auth()
  let jersey_poll_self: Awaited<ReturnType<typeof getJerseyPollSelfPayload>> | null = null
  if (openJerseyPollId) {
    jersey_poll_self = await getJerseyPollSelfPayload(supabaseAdmin, {
      userId: userId ?? null,
      teamId,
      pollId: openJerseyPollId,
    })
  }

  let publicFontKey: string | null = EMPTY_LEAGUE_SITE.publicFontKey
  let leagueNews: Array<{ id: string; title: string; body: string; pinned: boolean; created_at: string }> = []
  const { data: siteRow, error: siteErr } = await supabaseAdmin
    .from('league_site_content')
    .select('published')
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!siteErr && siteRow?.published != null) {
    const parsedSite = parseLeagueSitePayload(siteRow.published)
    publicFontKey = parsedSite.publicFontKey
    leagueNews = parsedSite.sections
      .filter(isLeagueSiteNewsSurfaceSection)
      .slice(0, 6)
      .map((sec, idx) => ({
        id: `league-news-${idx}-${sec.id}`,
        title: sec.title,
        body: sec.body,
        pinned: idx === 0,
        created_at: new Date().toISOString(),
      }))
  }

  const roster = (players || []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    jersey_number: p.jersey_number,
    position_label: formatPosition(p as { positions?: string[] | null }),
    avatar_url: (p as { avatar_url?: string | null }).avatar_url ?? null,
  }))

  const tier = normalizePublicTeamTier(org.plan)
  const rosterIds = roster.map((r) => r.id)

  const extras = await buildPublicTeamSeasonExtras(supabaseAdmin, {
    organizationId: org.id,
    teamId,
    seasonId: team.season_id,
    rosterPlayerIds: rosterIds,
    tier,
    publicPrimaryStatKeys: orgHub.public_stream_primary_stat_keys,
  })

  const nowIso = new Date().toISOString()
  const [newsRes, calRes] = await Promise.all([
    supabaseAdmin
      .from('team_news_posts')
      .select('id, title, body, pinned, created_at')
      .eq('team_id', teamId)
      .eq('organization_id', org.id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(12),
    supabaseAdmin
      .from('team_calendar_events')
      .select('id, title, starts_at, ends_at, location, notes')
      .eq('team_id', teamId)
      .eq('organization_id', org.id)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(15),
  ])

  const DEMO_LIVE_LOCATION = 'MLP_DEMO_LIVE_STREAM'
  let liveGameRow: { id: string } | null = null
  const { data: demoLive } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('organization_id', org.id)
    .eq('season_id', team.season_id)
    .eq('status', 'live')
    .eq('location', DEMO_LIVE_LOCATION)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .maybeSingle()
  liveGameRow = demoLive
  if (!liveGameRow?.id) {
    const { data: anyLive } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('organization_id', org.id)
      .eq('season_id', team.season_id)
      .eq('status', 'live')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .limit(1)
      .maybeSingle()
    liveGameRow = anyLive
  }

  const team_news =
    !newsRes.error && Array.isArray(newsRes.data)
      ? newsRes.data.map((row) => ({
          id: row.id as string,
          title: row.title as string,
          body: row.body as string,
          pinned: Boolean(row.pinned),
          created_at: row.created_at as string,
        }))
      : []
  const team_calendar_upcoming =
    !calRes.error && Array.isArray(calRes.data)
      ? calRes.data.map((row) => ({
          id: row.id as string,
          title: row.title as string,
          starts_at: row.starts_at as string,
          ends_at: (row.ends_at as string | null) ?? null,
          location: (row.location as string | null) ?? null,
          notes: (row.notes as string | null) ?? null,
        }))
      : []

  const public_primary_stat_keys = normalizePublicPrimaryStatKeys(orgHub.public_stream_primary_stat_keys)

  return NextResponse.json({
    organization: {
      name: org.name,
      slug: org.slug,
      primary_color: org.primary_color,
      logo_url: org.logo_url,
      league_theme_preset: org.league_theme_preset ?? 'classic',
      league_appearance_mode: org.league_appearance_mode ?? 'light',
      plan: normalizeOrgPlan(org.plan),
      sport_template_id: orgHub.sport_template_id,
    },
    public_primary_stat_keys,
    public_tier: tier,
    team: {
      id: team.id,
      name: team.name,
      color: team.color,
      logo_url: team.logo_url ?? null,
      season_name: season?.name || 'Season',
      stream_url: team.stream_url ?? null,
      house_rules: team.house_rules ?? null,
    },
    roster,
    open_jersey_poll_id: openJerseyPollId,
    jersey_poll_self,
    publicFontKey,
    season_record: extras.season_record,
    league_rank: extras.league_rank,
    league_team_count: extras.league_team_count,
    player_totals: extras.player_totals,
    last_game: extras.last_game,
    recent_games: extras.recent_games,
    next_game: extras.next_game,
    leader_badges: extras.leader_badges,
    team_news,
    league_news: leagueNews,
    team_calendar_upcoming,
    live_game_id: liveGameRow?.id ?? null,
  })
}
