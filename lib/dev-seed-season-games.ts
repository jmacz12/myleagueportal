import type { SupabaseClient } from '@supabase/supabase-js'

function splitPoints(total: number, playerIds: string[]): { id: string; pts: number }[] {
  const n = playerIds.length
  if (n === 0) return []
  if (total <= 0) return playerIds.map((id) => ({ id, pts: 0 }))
  const weights = playerIds.map(() => 0.15 + Math.random())
  const wsum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map((w) => Math.floor((w / wsum) * total))
  const used = raw.reduce((a, b) => a + b, 0)
  let rem = total - used
  const out = playerIds.map((id, i) => ({ id, pts: raw[i] }))
  for (let k = 0; rem > 0; k++, rem--) {
    out[k % n].pts += 1
  }
  return out
}

function rnd(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/**
 * Dev-only: round-robin final games + player_game_stats so public team pages show record / stats.
 */
export async function seedSeasonGamesWithStats(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    seasonId: string
    teams: { id: string }[]
    /** Cap completed games (full round-robin is heavy for 10+ teams). */
    maxFinalGames?: number
  }
): Promise<{ ok: true; games_created: number; stats_rows: number } | { ok: false; error: string }> {
  const { organizationId, seasonId, teams, maxFinalGames } = params
  if (teams.length < 2) {
    return { ok: false, error: 'Need at least two teams to seed games.' }
  }

  const teamIds = teams.map((t) => t.id)
  const { data: players, error: plErr } = await supabase
    .from('players')
    .select('id, team_id')
    .in('team_id', teamIds)

  if (plErr) return { ok: false, error: plErr.message }

  const byTeam = new Map<string, string[]>()
  for (const tid of teamIds) byTeam.set(tid, [])
  for (const p of players || []) {
    if (p.team_id && byTeam.has(p.team_id)) {
      byTeam.get(p.team_id)!.push(p.id)
    }
  }

  const statRows: Record<string, unknown>[] = []
  let gamesCreated = 0
  let gameIndex = 0

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      if (maxFinalGames !== undefined && gamesCreated >= maxFinalGames) break
      const swap = (i + j + gameIndex) % 2 === 0
      const homeId = swap ? teams[i].id : teams[j].id
      const awayId = swap ? teams[j].id : teams[i].id
      const homePlayers = byTeam.get(homeId) || []
      const awayPlayers = byTeam.get(awayId) || []
      if (homePlayers.length === 0 || awayPlayers.length === 0) continue

      let homeScore = rnd(48, 92)
      let awayScore = rnd(48, 92)
      if (homeScore === awayScore) awayScore += 3
      if (Math.abs(homeScore - awayScore) < 4) {
        if (homeScore > awayScore) awayScore = homeScore - 6
        else homeScore = awayScore - 6
      }

      const sched = new Date()
      sched.setDate(sched.getDate() - (70 - gameIndex * 2))
      sched.setHours(19, 0, 0, 0)

      const { data: gameRow, error: gErr } = await supabase
        .from('games')
        .insert({
          organization_id: organizationId,
          season_id: seasonId,
          home_team_id: homeId,
          away_team_id: awayId,
          scheduled_at: sched.toISOString(),
          status: 'final',
          home_score: homeScore,
          away_score: awayScore,
        })
        .select('id')
        .single()

      if (gErr || !gameRow) {
        return { ok: false, error: gErr?.message || 'Failed to insert game' }
      }
      gamesCreated++
      gameIndex++

      const homePts = splitPoints(homeScore, homePlayers)
      const awayPts = splitPoints(awayScore, awayPlayers)
      for (const { id: player_id, pts } of homePts) {
        const p = Math.max(0, pts)
        statRows.push({
          game_id: gameRow.id,
          player_id,
          organization_id: organizationId,
          pts: p,
          fg2m: Math.floor(p / 2),
          fg3m: 0,
          ftm: p % 2,
          ast: pts <= 0 ? rnd(0, 2) : rnd(0, Math.min(8, 2 + Math.floor(pts / 2))),
          reb: rnd(0, Math.min(12, Math.max(2, pts + 3))),
          stl: rnd(0, 4),
          blk: rnd(0, 3),
          tov: rnd(0, 5),
          pf: rnd(0, 5),
        })
      }
      for (const { id: player_id, pts } of awayPts) {
        const p = Math.max(0, pts)
        statRows.push({
          game_id: gameRow.id,
          player_id,
          organization_id: organizationId,
          pts: p,
          fg2m: Math.floor(p / 2),
          fg3m: 0,
          ftm: p % 2,
          ast: pts <= 0 ? rnd(0, 2) : rnd(0, Math.min(8, 2 + Math.floor(pts / 2))),
          reb: rnd(0, Math.min(12, Math.max(2, pts + 3))),
          stl: rnd(0, 4),
          blk: rnd(0, 3),
          tov: rnd(0, 5),
          pf: rnd(0, 5),
        })
      }
    }
    if (maxFinalGames !== undefined && gamesCreated >= maxFinalGames) break
  }

  if (statRows.length > 0) {
    const chunk = 80
    for (let c = 0; c < statRows.length; c += chunk) {
      const batch = statRows.slice(c, c + chunk)
      const { error: sErr } = await supabase.from('player_game_stats').insert(batch)
      if (sErr) return { ok: false, error: sErr.message }
    }
  }

  return { ok: true, games_created: gamesCreated, stats_rows: statRows.length }
}
