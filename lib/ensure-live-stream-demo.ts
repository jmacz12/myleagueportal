import type { SupabaseClient } from '@supabase/supabase-js'

/** Marks the league “demo live” game so `/api/join/[slug]/stream` prefers it. */
export const DEMO_LIVE_LOCATION = 'MLP_DEMO_LIVE_STREAM'

/** Public YouTube URL that embeds reliably for demos (not a real broadcast). */
export const DEMO_STREAM_WATCH_URL = 'https://www.youtube.com/watch?v=ysz5S6PUM-U'

export type EnsureLiveStreamDemoResult =
  | { ok: true; gameId: string; homeTeam: string; awayTeam: string; created: boolean }
  | { ok: false; error: string }

/**
 * Create or refresh one live game with scores, clock, sample stats, and a team stream URL
 * so the public Stream tab shows embed + box score.
 */
export async function ensureLiveStreamDemoGame(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { homeTeamId?: string; awayTeamId?: string }
): Promise<EnsureLiveStreamDemoResult> {
  let homeId = options?.homeTeamId
  let awayId = options?.awayTeamId

  if (!homeId || !awayId) {
    const { data: teamRows, error: teamsErr } = await supabase
      .from('teams')
      .select('id, name, season_id, stream_url')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true })

    if (teamsErr || !teamRows?.length) {
      return { ok: false, error: teamsErr?.message || 'No teams found for this league' }
    }

    const firstSeason = teamRows[0].season_id
    const sameSeason = teamRows.filter((t) => t.season_id === firstSeason)
    if (sameSeason.length < 2) {
      return { ok: false, error: 'Need at least two teams in the same season' }
    }

    homeId = sameSeason[0].id
    awayId = sameSeason[1].id

    if (!sameSeason[0].stream_url?.trim()) {
      await supabase.from('teams').update({ stream_url: DEMO_STREAM_WATCH_URL }).eq('id', homeId)
    }
  }

  const { data: homeRow } = await supabase.from('teams').select('id, name, season_id, stream_url').eq('id', homeId).single()
  const { data: awayRow } = await supabase.from('teams').select('id, name').eq('id', awayId).single()
  if (!homeRow?.season_id) {
    return { ok: false, error: 'Home team missing season' }
  }

  if (!homeRow.stream_url?.trim()) {
    await supabase.from('teams').update({ stream_url: DEMO_STREAM_WATCH_URL }).eq('id', homeId)
  }

  const orgStreamUpdate = await supabase
    .from('organizations')
    .update({ default_stream_url: DEMO_STREAM_WATCH_URL })
    .eq('id', organizationId)
  if (orgStreamUpdate.error && !String(orgStreamUpdate.error.message || '').includes('default_stream_url')) {
    console.warn('[ensure-live-stream-demo] organizations.default_stream_url:', orgStreamUpdate.error.message)
  }

  const scheduledAt = new Date().toISOString()
  const gamePayload = {
    organization_id: organizationId,
    season_id: homeRow.season_id,
    home_team_id: homeId,
    away_team_id: awayId,
    scheduled_at: scheduledAt,
    location: DEMO_LIVE_LOCATION,
    status: 'live' as const,
    home_score: 54,
    away_score: 51,
    period: 3,
    game_clock: '4:52',
  }

  const { data: existing } = await supabase
    .from('games')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('location', DEMO_LIVE_LOCATION)
    .maybeSingle()

  let gameId: string
  let created = false
  if (existing?.id) {
    const { error: upErr } = await supabase.from('games').update(gamePayload).eq('id', existing.id)
    if (upErr) return { ok: false, error: upErr.message }
    gameId = existing.id
  } else {
    const { data: inserted, error: insErr } = await supabase.from('games').insert(gamePayload).select('id').single()
    if (insErr || !inserted?.id) {
      return { ok: false, error: insErr?.message || 'Insert failed' }
    }
    gameId = inserted.id
    created = true
  }

  await supabase.from('player_game_stats').delete().eq('game_id', gameId)

  const { data: homePlayers } = await supabase.from('players').select('id').eq('team_id', homeId).limit(5)
  const { data: awayPlayers } = await supabase.from('players').select('id').eq('team_id', awayId).limit(5)

  const statRows: Record<string, unknown>[] = []
  let i = 0
  for (const p of homePlayers || []) {
    const pts = 12 - i
    statRows.push({
      game_id: gameId,
      player_id: p.id,
      organization_id: organizationId,
      team_id: homeId,
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
      organization_id: organizationId,
      team_id: awayId,
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
    const { error: stErr } = await supabase.from('player_game_stats').insert(statRows)
    if (stErr && !String(stErr.message || '').includes('team_id')) {
      return { ok: false, error: stErr.message }
    }
    if (stErr && String(stErr.message || '').includes('team_id')) {
      const fallback = statRows.map((r) => {
        const x = { ...r }
        delete (x as { team_id?: string }).team_id
        return x
      })
      const { error: st2 } = await supabase.from('player_game_stats').insert(fallback)
      if (st2) return { ok: false, error: st2.message }
    }
  }

  const homeStarters = [null, null, null, null, null].map((_, idx) => homePlayers?.[idx]?.id ?? null)
  const awayStarters = [null, null, null, null, null].map((_, idx) => awayPlayers?.[idx]?.id ?? null)
  await supabase
    .from('games')
    .update({
      home_starter_slot_ids: homeStarters,
      away_starter_slot_ids: awayStarters,
    })
    .eq('id', gameId)

  return {
    ok: true,
    gameId,
    homeTeam: homeRow?.name ?? 'Home',
    awayTeam: awayRow?.name ?? 'Away',
    created,
  }
}
