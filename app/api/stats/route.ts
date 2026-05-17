import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwnerOrgForDashboard } from '@/lib/org-access'
import { isBasic, normalizeOrgPlan } from '@/lib/org-plan-tier'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireOwnerOrgForDashboard(userId)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const url = new URL(req.url)
  const seasonId = url.searchParams.get('season_id')?.trim() ?? ''
  const teamIdFilter = url.searchParams.get('team_id')?.trim() ?? ''

  const [{ data: seasons }, { data: org }] = await Promise.all([
    supabaseAdmin
      .from('seasons')
      .select('id, name, is_active')
      .eq('organization_id', gate.organizationId)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('organizations').select('plan').eq('id', gate.organizationId).maybeSingle(),
  ])

  const plan = normalizeOrgPlan(org?.plan)
  const locked = isBasic(plan)

  const seasonList = seasons ?? []
  const activeSeason =
    seasonList.find((s) => s.is_active) ?? seasonList[0] ?? null
  const filterSeasonId = seasonId || activeSeason?.id || ''

  if (!filterSeasonId) {
    return NextResponse.json({
      seasons: seasonList,
      season_id: null,
      plan,
      locked,
      teams: [],
      team_id: null,
      leaders: [],
      games: [],
    })
  }

  if (locked) {
    return NextResponse.json({
      seasons: seasonList,
      season_id: filterSeasonId,
      plan,
      locked: true,
      teams: [],
      team_id: null,
      leaders: [],
      games: [],
    })
  }

  const [{ data: teams }, { data: games }] = await Promise.all([
    supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('organization_id', gate.organizationId)
      .eq('season_id', filterSeasonId)
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('games')
      .select(
        'id, home_team_id, away_team_id, scheduled_at, location, home_score, away_score, status'
      )
      .eq('organization_id', gate.organizationId)
      .eq('season_id', filterSeasonId)
      .in('status', ['final', 'live'])
      .order('scheduled_at', { ascending: false }),
  ])

  const teamList = (teams ?? []).map((t) => ({ id: t.id as string, name: String(t.name || 'Team') }))
  const teamNameById = new Map(teamList.map((t) => [t.id, t.name]))

  let gameRows = games ?? []
  if (teamIdFilter) {
    gameRows = gameRows.filter(
      (g) => g.home_team_id === teamIdFilter || g.away_team_id === teamIdFilter
    )
  }

  const gameIds = gameRows.map((g) => g.id as string)

  let statsCountByGame = new Map<string, number>()
  if (gameIds.length > 0) {
    const { data: statRows } = await supabaseAdmin
      .from('player_game_stats')
      .select('game_id, pts')
      .in('game_id', gameIds)
    for (const row of statRows ?? []) {
      const gid = String(row.game_id || '')
      if (!gid) continue
      const pts = Number(row.pts) || 0
      if (pts > 0 || row.pts === 0) {
        statsCountByGame.set(gid, (statsCountByGame.get(gid) ?? 0) + 1)
      }
    }
  }

  const finalGameIds = gameRows.filter((g) => g.status === 'final').map((g) => g.id as string)
  let leaders: Array<{ player_name: string; stat: string; total: number }> = []
  if (finalGameIds.length > 0) {
    const { data: stats } = await supabaseAdmin
      .from('player_game_stats')
      .select('player_id, team_id, pts, reb, ast, stl, blk')
      .in('game_id', finalGameIds)

    const filteredStats =
      teamIdFilter && stats
        ? stats.filter((row) => String(row.team_id || '') === teamIdFilter)
        : stats ?? []

    const playerIds = [...new Set(filteredStats.map((r) => String(r.player_id || '')).filter(Boolean))]
    let nameById = new Map<string, string>()
    if (playerIds.length > 0) {
      const { data: players } = await supabaseAdmin
        .from('players')
        .select('id, full_name')
        .eq('organization_id', gate.organizationId)
        .in('id', playerIds)
      nameById = new Map(
        (players ?? []).map((p) => [String(p.id), String(p.full_name || 'Player')])
      )
    }

    const totals = new Map<string, { pts: number; reb: number; ast: number; stl: number; blk: number }>()
    for (const row of filteredStats) {
      const pid = String(row.player_id || '')
      if (!pid) continue
      const cur = totals.get(pid) || { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 }
      cur.pts += Number(row.pts || 0)
      cur.reb += Number(row.reb || 0)
      cur.ast += Number(row.ast || 0)
      cur.stl += Number(row.stl || 0)
      cur.blk += Number(row.blk || 0)
      totals.set(pid, cur)
    }
    const top = (key: 'pts' | 'reb' | 'ast' | 'stl' | 'blk', label: string) =>
      [...totals.entries()]
        .map(([pid, t]) => ({
          player_name: nameById.get(pid) || 'Player',
          stat: label,
          total: t[key],
        }))
        .sort((a, b) => b.total - a.total)[0]
    const picks = [
      top('pts', 'PTS'),
      top('reb', 'REB'),
      top('ast', 'AST'),
      top('stl', 'STL'),
      top('blk', 'BLK'),
    ]
    leaders = picks.filter((v) => v && v.total > 0) as typeof leaders
  }

  const gamesOut = gameRows.map((g) => {
    const hid = g.home_team_id as string | null
    const aid = g.away_team_id as string | null
    return {
      id: g.id,
      home_team_id: hid,
      away_team_id: aid,
      scheduled_at: g.scheduled_at,
      location: g.location,
      status: g.status,
      home_score: g.home_score,
      away_score: g.away_score,
      home_team_name: hid ? teamNameById.get(hid) ?? 'Home' : 'Home',
      away_team_name: aid ? teamNameById.get(aid) ?? 'Away' : 'Away',
      stats_row_count: statsCountByGame.get(g.id as string) ?? 0,
    }
  })

  return NextResponse.json({
    seasons: seasonList,
    season_id: filterSeasonId,
    plan,
    locked: false,
    teams: teamList,
    team_id: teamIdFilter || null,
    leaders,
    games: gamesOut,
  })
}
