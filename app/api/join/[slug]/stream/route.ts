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
    .select('id, home_team_id, away_team_id')
    .eq('organization_id', orgHub.id)
    .eq('status', 'live')
    .eq('location', DEMO_LIVE_LOCATION)
    .maybeSingle()

  let live = demoLive
  if (!live?.id) {
    const { data: anyLive } = await supabaseAdmin
      .from('games')
      .select('id, home_team_id, away_team_id')
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
    return NextResponse.json({ live: { gameId: live.id, streamPageUrl: null, homeName: null, awayName: null } })
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

  return NextResponse.json({
    live: {
      gameId: live.id,
      streamPageUrl: streamRaw,
      homeName: home?.name ?? null,
      awayName: away?.name ?? null,
    },
  })
}
