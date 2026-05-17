import type { SupabaseClient } from '@supabase/supabase-js'
import type { StatSheetConfirmRow } from '@/lib/game-stats-sheet-csv'

function recomputePts(row: { fg2m: number; fg3m: number; ftm: number }) {
  return row.fg2m * 2 + row.fg3m * 3 + row.ftm
}

export async function applyGameStatsBulkUpsert(
  admin: SupabaseClient,
  gameId: string,
  organizationId: string,
  rows: StatSheetConfirmRow[]
): Promise<{ error?: string }> {
  const { data: game } = await admin
    .from('games')
    .select('home_team_id, away_team_id')
    .eq('id', gameId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!game) return { error: 'Game not found' }

  const playerIds = rows.map((r) => r.player_id)
  const { data: players } = await admin
    .from('players')
    .select('id, team_id')
    .eq('organization_id', organizationId)
    .in('id', playerIds)

  const teamByPlayer = new Map((players || []).map((p) => [p.id as string, p.team_id as string | null]))

  for (const row of rows) {
    const team_id = teamByPlayer.get(row.player_id) ?? null
    const pts = recomputePts(row)
    const upsertRow: Record<string, unknown> = {
      game_id: gameId,
      player_id: row.player_id,
      organization_id: organizationId,
      team_id,
      fg2m: row.fg2m,
      fg3m: row.fg3m,
      ftm: row.ftm,
      pts,
      reb: row.reb,
      ast: row.ast,
      stl: row.stl,
      blk: row.blk,
      tov: row.tov,
      pf: row.pf,
    }

    let err = (
      await admin.from('player_game_stats').upsert(upsertRow, {
        onConflict: 'game_id,player_id',
      })
    ).error

    if (err && String(err.message || '').toLowerCase().includes('team_id')) {
      const { team_id: _t, ...withoutTeam } = upsertRow
      void _t
      err = (
        await admin.from('player_game_stats').upsert(withoutTeam, {
          onConflict: 'game_id,player_id',
        })
      ).error
    }

    if (err) return { error: err.message || 'Failed to save stats' }
  }

  const { data: allStats } = await admin
    .from('player_game_stats')
    .select('pts, team_id, player_id')
    .eq('game_id', gameId)

  if (allStats?.length) {
    const missingPid = [
      ...new Set(
        allStats.filter((s) => !s.team_id && s.player_id).map((s) => s.player_id as string)
      ),
    ]
    let teamByPlayerMap = teamByPlayer
    if (missingPid.length > 0) {
      const { data: plRows } = await admin
        .from('players')
        .select('id, team_id')
        .in('id', missingPid)
      const merged = new Map(teamByPlayer)
      for (const p of plRows || []) {
        merged.set(p.id as string, p.team_id as string | null)
      }
      teamByPlayerMap = merged
    }

    let homeScore = 0
    let awayScore = 0
    for (const s of allStats) {
      const p = Number(s.pts) || 0
      const tid = s.team_id || (s.player_id ? teamByPlayerMap.get(s.player_id) : null)
      if (tid === game.home_team_id) homeScore += p
      else if (tid === game.away_team_id) awayScore += p
    }

    await admin
      .from('games')
      .update({ home_score: homeScore, away_score: awayScore })
      .eq('id', gameId)
  }

  return {}
}
