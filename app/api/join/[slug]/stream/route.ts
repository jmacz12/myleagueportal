import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchOrganizationForPublicJoin, normalizeJoinSlugParam } from '@/lib/join-public-org'
import { normalizeStreamUrl } from '@/lib/stream-url'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Matches dev demo game from `POST /api/dev/live-demo-game` so Stream tab always picks it first. */
const DEMO_LIVE_LOCATION = 'MLP_DEMO_LIVE_STREAM'

/**
 * League-wide live stream context: first live season game in the org + a watch URL from either team.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: slugRaw } = await params
  const slug = normalizeJoinSlugParam(slugRaw)
  if (!slug) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const orgHub = await fetchOrganizationForPublicJoin(supabaseAdmin, slug)
  if (!orgHub?.id) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const { data: demoLive } = await supabaseAdmin
    .from('games')
    .select('id, home_team_id, away_team_id, home_score, away_score, status, period, game_clock, location')
    .eq('organization_id', orgHub.id)
    .eq('status', 'live')
    .eq('location', DEMO_LIVE_LOCATION)
    .maybeSingle()

  let live = demoLive
  if (!live?.id) {
    const { data: anyLive } = await supabaseAdmin
      .from('games')
      .select('id, home_team_id, away_team_id, home_score, away_score, status, period, game_clock, location')
      .eq('organization_id', orgHub.id)
      .eq('status', 'live')
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    live = anyLive
  }

  if (!live?.id) {
    return NextResponse.json({ live: null })
  }

  const pair = [live.home_team_id, live.away_team_id].filter(Boolean) as string[]
  if (pair.length === 0) {
    const g0 = live as { home_score?: unknown; away_score?: unknown; status?: unknown; period?: unknown; game_clock?: unknown; location?: unknown }
    return NextResponse.json({
      live: {
        gameId: live.id,
        streamPageUrl: null,
        homeName: null,
        awayName: null,
        homeScore: typeof g0.home_score === 'number' ? g0.home_score : null,
        awayScore: typeof g0.away_score === 'number' ? g0.away_score : null,
        status: typeof g0.status === 'string' ? g0.status : null,
        period: typeof g0.period === 'number' ? g0.period : null,
        gameClock: typeof g0.game_clock === 'string' ? g0.game_clock : null,
        location: typeof g0.location === 'string' && String(g0.location).trim() ? String(g0.location).trim() : null,
      },
    })
  }

  type TeamRow = { id: string; name: string; stream_url?: string | null }
  const teamsQ = await supabaseAdmin.from('teams').select('id, name, stream_url').in('id', pair)
  let rows: TeamRow[]
  if (teamsQ.error && String(teamsQ.error.message || '').includes('stream_url')) {
    const fb = await supabaseAdmin.from('teams').select('id, name').in('id', pair)
    rows = (fb.data || []).map((t) => ({ ...t, stream_url: null }))
  } else {
    rows = (teamsQ.data || []) as TeamRow[]
  }
  const home = rows.find((t) => t.id === live.home_team_id)
  const away = rows.find((t) => t.id === live.away_team_id)

  let orgDefault: string | null = null
  const orgStreamQ = await supabaseAdmin
    .from('organizations')
    .select('default_stream_url')
    .eq('id', orgHub.id)
    .maybeSingle()
  if (!orgStreamQ.error && orgStreamQ.data) {
    const raw = (orgStreamQ.data as { default_stream_url?: string | null }).default_stream_url
    orgDefault = normalizeStreamUrl(typeof raw === 'string' ? raw : null)
  }

  const streamRaw =
    normalizeStreamUrl((home as { stream_url?: string | null } | undefined)?.stream_url)
    || normalizeStreamUrl((away as { stream_url?: string | null } | undefined)?.stream_url)
    || orgDefault
    || null

  const g = live as {
    home_score?: number | null
    away_score?: number | null
    status?: string | null
    period?: number | null
    game_clock?: string | null
    location?: string | null
  }

  return NextResponse.json({
    live: {
      gameId: live.id,
      streamPageUrl: streamRaw,
      homeName: home?.name ?? null,
      awayName: away?.name ?? null,
      homeScore: typeof g.home_score === 'number' ? g.home_score : null,
      awayScore: typeof g.away_score === 'number' ? g.away_score : null,
      status: typeof g.status === 'string' ? g.status : null,
      period: typeof g.period === 'number' ? g.period : null,
      gameClock: typeof g.game_clock === 'string' ? g.game_clock : null,
      location: typeof g.location === 'string' && g.location.trim() ? g.location.trim() : null,
    },
  })
}
