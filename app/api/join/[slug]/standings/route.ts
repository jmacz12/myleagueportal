import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchOrganizationForPublicJoin, normalizeJoinSlugParam } from '@/lib/join-public-org'
import { computeStandingsMap, type SeasonGameRow } from '@/lib/public-team-season-view'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const slug = normalizeJoinSlugParam((await params).slug)
  if (!slug) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  const org = await fetchOrganizationForPublicJoin(supabaseAdmin, slug)
  if (!org?.id) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const seasonIdFilter = req.nextUrl.searchParams.get('season_id')?.trim() || null

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, season_id')
    .eq('organization_id', org.id)

  let teamRows = teams || []
  if (seasonIdFilter) {
    teamRows = teamRows.filter((t) => String(t.season_id || '') === seasonIdFilter)
  }

  const teamIds = teamRows.map((t) => t.id)
  const seasonIds = Array.from(new Set(teamRows.map((t) => t.season_id).filter(Boolean)))
  if (teamIds.length === 0 || seasonIds.length === 0) {
    return NextResponse.json({ standings: [], leaders: [], gameResults: [] })
  }

  const teamNameById = new Map(teamRows.map((t) => [t.id as string, String(t.name || 'Team')]))

  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id, home_team_id, away_team_id, home_score, away_score, status, scheduled_at, season_id')
    .eq('organization_id', org.id)
    .in('season_id', seasonIds)

  let gameRows = (games || []) as (SeasonGameRow & { season_id?: string })[]
  if (seasonIdFilter) {
    gameRows = gameRows.filter((g) => String(g.season_id || '') === seasonIdFilter)
  }

  const standings = computeStandingsMap(teamIds, gameRows as SeasonGameRow[])
  const rows = teamRows.map((t) => {
    const rec = standings.get(t.id) || { wins: 0, losses: 0 }
    const played = rec.wins + rec.losses
    const pct = played > 0 ? rec.wins / played : 0
    return { team_id: t.id, team_name: t.name || 'Team', wins: rec.wins, losses: rec.losses, pct }
  })
  rows.sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.team_name.localeCompare(b.team_name)
  })

  const finalGameIds = gameRows
    .filter((g) => {
      if (g.status !== 'final') return false
      const hs = g.home_score
      const ascr = g.away_score
      return typeof hs === 'number' && typeof ascr === 'number'
    })
    .map((g) => g.id)
  let leaders: Array<{ player_name: string; stat: string; total: number }> = []
  if (finalGameIds.length > 0) {
    const [{ data: stats }, { data: players }] = await Promise.all([
      supabaseAdmin
        .from('player_game_stats')
        .select('player_id, pts, reb, ast, stl, blk')
        .in('game_id', finalGameIds),
      supabaseAdmin.from('players').select('id, full_name').eq('organization_id', org.id),
    ])
    const nameById = new Map((players || []).map((p) => [String(p.id), String(p.full_name || 'Player')]))
    const totals = new Map<string, { pts: number; reb: number; ast: number; stl: number; blk: number }>()
    for (const row of stats || []) {
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
        .map(([pid, t]) => ({ player_name: nameById.get(pid) || 'Player', stat: label, total: t[key] }))
        .sort((a, b) => b.total - a.total)[0]
    const pts = top('pts', 'PTS')
    const reb = top('reb', 'REB')
    const ast = top('ast', 'AST')
    const stl = top('stl', 'STL')
    const blk = top('blk', 'BLK')
    leaders = [pts, reb, ast, stl, blk].filter(
      (v): v is { player_name: string; stat: string; total: number } => !!v && v.total > 0,
    )
  }

  const gameResults = gameRows
    .filter((g) => {
      if (g.status !== 'final' || !g.scheduled_at) return false
      const hs = g.home_score
      const ascr = g.away_score
      return typeof hs === 'number' && typeof ascr === 'number'
    })
    .sort((a, b) => new Date(b.scheduled_at as string).getTime() - new Date(a.scheduled_at as string).getTime())
    .slice(0, 150)
    .map((g) => {
      const hid = typeof g.home_team_id === 'string' ? g.home_team_id : null
      const aid = typeof g.away_team_id === 'string' ? g.away_team_id : null
      return {
        game_id: g.id as string,
        scheduled_at: g.scheduled_at as string,
        home_team_id: hid,
        away_team_id: aid,
        home_team_name: hid ? teamNameById.get(hid) || 'Home' : 'Home',
        away_team_name: aid ? teamNameById.get(aid) || 'Away' : 'Away',
        home_score: typeof g.home_score === 'number' ? g.home_score : null,
        away_score: typeof g.away_score === 'number' ? g.away_score : null,
      }
    })

  return NextResponse.json({ standings: rows, leaders, gameResults })
}

