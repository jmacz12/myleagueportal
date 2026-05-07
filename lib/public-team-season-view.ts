/**
 * Season standings + aggregates for the public team page (tier-aware).
 * Pro: five headline stats only in UI (PTS, REB, AST, STL, BLK).
 */

export type PublicTeamPlanTier = 'basic' | 'pro' | 'enterprise'

export function normalizePublicTeamTier(plan: string | null | undefined): PublicTeamPlanTier {
  const p = String(plan || 'basic').toLowerCase()
  if (p === 'enterprise') return 'enterprise'
  if (p === 'pro') return 'pro'
  return 'basic'
}

/** Fixed platform-wide headline set for Pro public team page (roadmap: five stats). */
export const TEAM_PAGE_PRO_HEADLINE_STATS = [
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
] as const

export type TeamPageStatKey =
  | 'pts'
  | 'reb'
  | 'ast'
  | 'stl'
  | 'blk'
  | 'tov'
  | 'pf'

export interface SeasonGameRow {
  id: string
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
  status: string | null
  scheduled_at: string | null
  location?: string | null
}

export function computeTeamRecord(teamId: string, games: SeasonGameRow[]): { wins: number; losses: number } {
  let wins = 0
  let losses = 0
  for (const g of games) {
    if (g.status !== 'final') continue
    const hs = g.home_score
    const ascr = g.away_score
    if (hs === null || hs === undefined || ascr === null || ascr === undefined) continue
    if (g.home_team_id === teamId) {
      if (hs > ascr) wins++
      else if (ascr > hs) losses++
    } else if (g.away_team_id === teamId) {
      if (ascr > hs) wins++
      else if (hs > ascr) losses++
    }
  }
  return { wins, losses }
}

export function computeStandingsMap(teamIds: string[], games: SeasonGameRow[]): Map<string, { wins: number; losses: number }> {
  const m = new Map<string, { wins: number; losses: number }>()
  for (const id of teamIds) {
    m.set(id, { wins: 0, losses: 0 })
  }
  for (const g of games) {
    if (g.status !== 'final') continue
    const hs = g.home_score
    const ascr = g.away_score
    if (
      hs === null ||
      hs === undefined ||
      ascr === null ||
      ascr === undefined ||
      !g.home_team_id ||
      !g.away_team_id
    )
      continue
    if (hs === ascr) continue
    const homeWon = hs > ascr
    const hr = m.get(g.home_team_id)
    const ar = m.get(g.away_team_id)
    if (!hr || !ar) continue
    if (homeWon) {
      hr.wins++
      ar.losses++
    } else {
      ar.wins++
      hr.losses++
    }
  }
  return m
}

/** 1-based rank within season (win pct, then wins). Returns null if team missing from list. */
export function rankTeamInSeason(teamId: string, teamIds: string[], standings: Map<string, { wins: number; losses: number }>): number | null {
  if (!teamIds.includes(teamId)) return null
  const rows = teamIds.map((id) => {
    const r = standings.get(id) || { wins: 0, losses: 0 }
    const played = r.wins + r.losses
    const pct = played === 0 ? -1 : r.wins / played
    return { id, wins: r.wins, losses: r.losses, pct, played }
  })
  rows.sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.id.localeCompare(b.id)
  })
  const idx = rows.findIndex((r) => r.id === teamId)
  return idx >= 0 ? idx + 1 : null
}

export interface PlayerStatTotals {
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
}

export function emptyPlayerTotals(): PlayerStatTotals {
  return { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }
}

export function aggregatePlayerStats(
  rows: Array<{
    player_id: string
    pts?: number | null
    reb?: number | null
    ast?: number | null
    stl?: number | null
    blk?: number | null
    tov?: number | null
    pf?: number | null
  }>,
  rosterIds: Set<string>
): Record<string, PlayerStatTotals> {
  const out: Record<string, PlayerStatTotals> = {}
  for (const id of rosterIds) {
    out[id] = emptyPlayerTotals()
  }
  for (const row of rows) {
    if (!rosterIds.has(row.player_id)) continue
    const t = out[row.player_id]
    if (!t) continue
    t.pts += Number(row.pts ?? 0)
    t.reb += Number(row.reb ?? 0)
    t.ast += Number(row.ast ?? 0)
    t.stl += Number(row.stl ?? 0)
    t.blk += Number(row.blk ?? 0)
    t.tov += Number(row.tov ?? 0)
    t.pf += Number(row.pf ?? 0)
  }
  return out
}
