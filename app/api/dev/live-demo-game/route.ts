import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchOrganizationForPublicJoin, normalizeJoinSlugParam } from '@/lib/join-public-org'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Marks this row as the league “demo live” game so /stream can prefer it. */
export const DEMO_LIVE_LOCATION = 'MLP_DEMO_LIVE_STREAM'

/** Public YouTube URL that embeds reliably for demos (not a real broadcast). */
const DEMO_YOUTUBE_WATCH = 'https://www.youtube.com/watch?v=ysz5S6PUM-U'

/**
 * Development only: create or refresh a single “in-game” live fixture with scores,
 * quarter, clock, and sample player stats — for Stream tab + overlay demos.
 * Does not set the game to final.
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

  const { data: teamRows, error: teamsErr } = await supabaseAdmin
    .from('teams')
    .select('id, name, season_id, stream_url')
    .eq('organization_id', orgHub.id)
    .order('name', { ascending: true })

  if (teamsErr || !teamRows?.length) {
    return NextResponse.json({ error: 'No teams found for this league' }, { status: 400 })
  }

  const firstSeason = teamRows[0].season_id
  const sameSeason = teamRows.filter((t) => t.season_id === firstSeason)
  if (sameSeason.length < 2) {
    return NextResponse.json({ error: 'Need at least two teams in the same season' }, { status: 400 })
  }

  const home = sameSeason[0]
  const away = sameSeason[1]

  if (!home.stream_url?.trim()) {
    await supabaseAdmin.from('teams').update({ stream_url: DEMO_YOUTUBE_WATCH }).eq('id', home.id)
  }

  const scheduledAt = new Date().toISOString()
  const gamePayload = {
    organization_id: orgHub.id,
    season_id: home.season_id,
    home_team_id: home.id,
    away_team_id: away.id,
    scheduled_at: scheduledAt,
    location: DEMO_LIVE_LOCATION,
    status: 'live' as const,
    home_score: 54,
    away_score: 51,
    period: 3,
    game_clock: '4:52',
  }

  const { data: existing } = await supabaseAdmin
    .from('games')
    .select('id')
    .eq('organization_id', orgHub.id)
    .eq('location', DEMO_LIVE_LOCATION)
    .maybeSingle()

  let gameId: string
  if (existing?.id) {
    const { error: upErr } = await supabaseAdmin
      .from('games')
      .update({
        ...gamePayload,
      })
      .eq('id', existing.id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    gameId = existing.id
  } else {
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('games')
      .insert(gamePayload)
      .select('id')
      .single()
    if (insErr || !inserted?.id) {
      return NextResponse.json({ error: insErr?.message || 'Insert failed' }, { status: 500 })
    }
    gameId = inserted.id
  }

  await supabaseAdmin.from('player_game_stats').delete().eq('game_id', gameId)

  const { data: homePlayers } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('team_id', home.id)
    .limit(5)
  const { data: awayPlayers } = await supabaseAdmin
    .from('players')
    .select('id')
    .eq('team_id', away.id)
    .limit(5)

  const statRows: Record<string, unknown>[] = []
  let i = 0
  for (const p of homePlayers || []) {
    const pts = 12 - i
    statRows.push({
      game_id: gameId,
      player_id: p.id,
      organization_id: orgHub.id,
      team_id: home.id,
      pts,
      fg2m: Math.floor(pts / 2),
      fg3m: 0,
      ftm: pts % 2,
      reb: 4 + (i % 3),
      ast: 2 + (i % 2),
      stl: i % 2,
      blk: i % 2,
      tov: i % 3,
      pf: 1 + (i % 2),
    })
    i++
  }
  i = 0
  for (const p of awayPlayers || []) {
    const pts = 10 - i
    statRows.push({
      game_id: gameId,
      player_id: p.id,
      organization_id: orgHub.id,
      team_id: away.id,
      pts,
      fg2m: Math.floor(pts / 2),
      fg3m: 0,
      ftm: pts % 2,
      reb: 5 + (i % 2),
      ast: 3,
      stl: 1,
      blk: 0,
      tov: 1,
      pf: 2,
    })
    i++
  }

  if (statRows.length > 0) {
    const { error: stErr } = await supabaseAdmin.from('player_game_stats').insert(statRows)
    if (stErr && !String(stErr.message || '').includes('team_id')) {
      return NextResponse.json({ error: stErr.message }, { status: 500 })
    }
    if (stErr && String(stErr.message || '').includes('team_id')) {
      const fallback = statRows.map((r) => {
        const x = { ...r }
        delete (x as { team_id?: string }).team_id
        return x
      })
      const { error: st2 } = await supabaseAdmin.from('player_game_stats').insert(fallback)
      if (st2) return NextResponse.json({ error: st2.message }, { status: 500 })
    }
  }

  const homeStarters = [null, null, null, null, null].map((_, idx) => homePlayers?.[idx]?.id ?? null)
  const awayStarters = [null, null, null, null, null].map((_, idx) => awayPlayers?.[idx]?.id ?? null)
  await supabaseAdmin
    .from('games')
    .update({
      home_starter_slot_ids: homeStarters,
      away_starter_slot_ids: awayStarters,
    })
    .eq('id', gameId)

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return NextResponse.json({
    ok: true,
    message:
      'Demo game is LIVE with Q3 4:52 and sample scores. Re-run this endpoint anytime to refresh. Game stays live until you change status in Dashboard.',
    gameId,
    homeTeam: home.name,
    awayTeam: away.name,
    urls: {
      leagueStreamTab: `${origin}/league/${slug}?tab=stream`,
      homeTeamStreamTab: `${origin}/league/${slug}/teams/${home.id}?tab=stream`,
      overlayOnly: `${origin}/games/${gameId}/overlay`,
      publicScoreboard: `${origin}/games/${gameId}/scoreboard`,
      streamPreview: `${origin}/games/${gameId}/stream-preview`,
      dashboardScoring: `${origin}/dashboard/games/${gameId}/scoring`,
    },
  })
}
