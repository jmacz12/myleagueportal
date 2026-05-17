import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureLiveStreamDemoGame } from '@/lib/ensure-live-stream-demo'
import { fetchOrganizationForPublicJoin, normalizeJoinSlugParam } from '@/lib/join-public-org'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Development only: create or refresh a single “in-game” live fixture with scores,
 * quarter, clock, and sample player stats — for Stream tab + overlay demos.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  let slug = ''
  try {
    const body = await req.json()
    slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  slug = normalizeJoinSlugParam(slug)
  if (!slug) {
    return NextResponse.json({ error: 'Body must include { "slug": "your-league-slug" }' }, { status: 400 })
  }

  const orgHub = await fetchOrganizationForPublicJoin(supabaseAdmin, slug)
  if (!orgHub?.id) {
    return NextResponse.json({ error: `No organization with slug "${slug}"` }, { status: 404 })
  }

  const result = await ensureLiveStreamDemoGame(supabaseAdmin, orgHub.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return NextResponse.json({
    ok: true,
    message:
      'Demo game is LIVE with Q3 4:52 and sample scores. Re-run this endpoint anytime to refresh. Game stays live until you change status in Dashboard.',
    gameId: result.gameId,
    homeTeam: result.homeTeam,
    awayTeam: result.awayTeam,
    urls: {
      leagueStreamTab: `${origin}/league/${slug}?tab=stream`,
      publicStreamTab: `${origin}/league/${slug}?tab=stream&game=${result.gameId}`,
      overlayOnly: `${origin}/games/${result.gameId}/overlay`,
      streamPreview: `${origin}/games/${result.gameId}/stream-preview`,
      dashboardScoring: `${origin}/dashboard/games/${result.gameId}/scoring`,
    },
  })
}
