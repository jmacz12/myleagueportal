import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchOrganizationForPublicJoin, normalizeJoinSlugParam } from '@/lib/join-public-org'
import { computeStandingsMap, type SeasonGameRow } from '@/lib/public-team-season-view'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const slug = normalizeJoinSlugParam((await params).slug)
  if (!slug) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  const org = await fetchOrganizationForPublicJoin(supabaseAdmin, slug)
  if (!org?.id) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, season_id')
    .eq('organization_id', org.id)

  const teamRows = teams || []
  const teamIds = teamRows.map((t) => t.id)
  const seasonIds = Array.from(new Set(teamRows.map((t) => t.season_id).filter(Boolean)))
  if (teamIds.length === 0 || seasonIds.length === 0) {
    return NextResponse.json({ standings: [], leaders: [] })
  }

  const { data: games } = await supabaseAdmin
    .from('games')
    .select('id, home_team_id, away_team_id, home_score, away_score, status, scheduled_at')
    .eq('organization_id', org.id)
    .in('season_id', seasonIds)

  const standings = computeStandingsMap(teamIds, (games || []) as SeasonGameRow[])
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

  const finalGameIds = (games || []).filter((g) => g.status === 'final').map((g) => g.id)
  let leaders: Array<{ player_name: string; stat: string; total: number }> = []
  if (finalGameIds.length > 0) {
    const [{ data: stats }, { data: players }] = await Promise.all([
      supabaseAdmin
        .from('player_game_stats')
        .select('player_id, pts, reb, ast')
        .in('game_id', finalGameIds),
      supabaseAdmin.from('players').select('id, full_name').eq('organization_id', org.id),
    ])
    const nameById = new Map((players || []).map((p) => [String(p.id), String(p.full_name || 'Player')]))
    const totals = new Map<string, { pts: number; reb: number; ast: number }>()
    for (const row of stats || []) {
      const pid = String(row.player_id || '')
      if (!pid) continue
      const cur = totals.get(pid) || { pts: 0, reb: 0, ast: 0 }
      cur.pts += Number(row.pts || 0)
      cur.reb += Number(row.reb || 0)
      cur.ast += Number(row.ast || 0)
      totals.set(pid, cur)
    }
    const top = (key: 'pts' | 'reb' | 'ast', label: string) =>
      [...totals.entries()]
        .map(([pid, t]) => ({ player_name: nameById.get(pid) || 'Player', stat: label, total: t[key] }))
        .sort((a, b) => b.total - a.total)[0]
    const pts = top('pts', 'PTS')
    const reb = top('reb', 'REB')
    const ast = top('ast', 'AST')
    leaders = [pts, reb, ast].filter((v): v is { player_name: string; stat: string; total: number } => !!v && v.total > 0)
  }

  return NextResponse.json({ standings: rows, leaders })
}

