import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PUBLIC_PRIMARY_STAT_ORDER,
  type PublicPrimaryStatKey,
  normalizePublicPrimaryStatKeys,
} from '@/lib/public-primary-stats'
import {
  aggregatePlayerStats,
  computeStandingsMap,
  computeTeamRecord,
  emptyPlayerTotals,
  rankTeamInSeason,
  type PlayerStatTotals,
  type PublicTeamPlanTier,
  type SeasonGameRow,
  type TeamPageStatKey,
} from '@/lib/public-team-season-view'

export interface PublicTeamLastGameView {
  scheduled_at: string | null
  opponent_name: string
  team_points: number
  opp_points: number
  won: boolean
  location: string | null
}

export interface PublicTeamNextGameView {
  scheduled_at: string | null
  opponent_name: string
  location: string | null
}

export async function buildPublicTeamSeasonExtras(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    teamId: string
    seasonId: string
    rosterPlayerIds: string[]
    tier: PublicTeamPlanTier
    /** From `organizations.public_stream_primary_stat_keys` — five visible stats on Pro. */
    publicPrimaryStatKeys?: unknown
  }
): Promise<{
  season_record: { wins: number; losses: number }
  league_rank: number | null
  league_team_count: number
  player_totals: Record<string, PlayerStatTotals> | null
  last_game: PublicTeamLastGameView | null
  recent_games: PublicTeamLastGameView[] | null
  next_game: PublicTeamNextGameView | null
  leader_badges: Record<string, Partial<Record<TeamPageStatKey, true>>> | null
}> {
  const empty = {
    season_record: { wins: 0, losses: 0 },
    league_rank: null as number | null,
    league_team_count: 0,
    player_totals: null as Record<string, PlayerStatTotals> | null,
    last_game: null as PublicTeamLastGameView | null,
    recent_games: null as PublicTeamLastGameView[] | null,
    next_game: null as PublicTeamNextGameView | null,
    leader_badges: null as Record<string, Partial<Record<TeamPageStatKey, true>>> | null,
  }

  if (params.tier === 'basic') {
    return empty
  }

  const primaryStatKeys = normalizePublicPrimaryStatKeys(params.publicPrimaryStatKeys)

  const [{ data: teamsInSeason }, { data: seasonGames }] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name')
      .eq('season_id', params.seasonId)
      .eq('organization_id', params.organizationId),
    supabase
      .from('games')
      .select('id, home_team_id, away_team_id, home_score, away_score, status, scheduled_at, location')
      .eq('season_id', params.seasonId)
      .eq('organization_id', params.organizationId),
  ])

  const teamRows = teamsInSeason || []
  const teamIds = teamRows.map((t) => t.id)
  const nameById = new Map(teamRows.map((t) => [t.id, t.name || 'Team']))
  empty.league_team_count = teamIds.length

  const games = (seasonGames || []) as SeasonGameRow[]
  const record = computeTeamRecord(params.teamId, games)
  empty.season_record = record

  const standings = computeStandingsMap(teamIds, games)
  empty.league_rank = rankTeamInSeason(params.teamId, teamIds, standings)

  const rosterSet = new Set(params.rosterPlayerIds)
  const teamFinalGames = games.filter(
    (g) =>
      g.status === 'final' &&
      (g.home_team_id === params.teamId || g.away_team_id === params.teamId)
  )
  const teamSeasonFinalIds = new Set(teamFinalGames.map((g) => g.id))

  const sortedTeamGames = [...teamFinalGames].sort((a, b) => {
    const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
    const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
    return tb - ta
  })

  function viewForGame(g: SeasonGameRow): PublicTeamLastGameView | null {
    const hs = g.home_score
    const ascr = g.away_score
    if (hs === null || hs === undefined || ascr === null || ascr === undefined) return null
    const isHome = g.home_team_id === params.teamId
    const oppId = isHome ? g.away_team_id : g.home_team_id
    const teamPts = isHome ? hs : ascr
    const oppPts = isHome ? ascr : hs
    const won = teamPts > oppPts
    const lost = teamPts < oppPts
    if (!won && !lost) return null
    return {
      scheduled_at: g.scheduled_at,
      opponent_name: oppId ? nameById.get(oppId) || 'Opponent' : 'Opponent',
      team_points: teamPts,
      opp_points: oppPts,
      won,
      location: g.location ?? null,
    }
  }

  const views = sortedTeamGames.map(viewForGame).filter((v): v is PublicTeamLastGameView => v !== null)
  empty.last_game = views[0] ?? null
  empty.recent_games = params.tier === 'enterprise' ? views.slice(0, 5) : null

  const now = Date.now()
  const upcoming = games
    .filter((g) => {
      if (g.home_team_id !== params.teamId && g.away_team_id !== params.teamId) return false
      if (!g.scheduled_at) return false
      if (g.status === 'final') return false
      const ts = new Date(g.scheduled_at).getTime()
      return Number.isFinite(ts) && ts >= now
    })
    .sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime())
  if (upcoming.length > 0) {
    const g = upcoming[0]
    const isHome = g.home_team_id === params.teamId
    const oppId = isHome ? g.away_team_id : g.home_team_id
    empty.next_game = {
      scheduled_at: g.scheduled_at,
      opponent_name: oppId ? nameById.get(oppId) || 'Opponent' : 'Opponent',
      location: g.location ?? null,
    }
  }

  if (teamSeasonFinalIds.size === 0 || rosterSet.size === 0) {
    const totalsEmpty: Record<string, PlayerStatTotals> = {}
    for (const id of params.rosterPlayerIds) totalsEmpty[id] = emptyPlayerTotals()
    empty.player_totals = totalsEmpty
    return empty
  }

  const gameIdList = [...teamSeasonFinalIds]
  const { data: statRows } = await supabase
    .from('player_game_stats')
    .select(
      'player_id, pts, fg2m, fg3m, ftm, ast, reb, stl, blk, tov, pf, seconds_played, game_id'
    )
    .in('game_id', gameIdList)

  const filtered = (statRows || []).filter(
    (r) =>
      r.player_id &&
      rosterSet.has(r.player_id) &&
      r.game_id &&
      teamSeasonFinalIds.has(String(r.game_id))
  )

  empty.player_totals = aggregatePlayerStats(
    filtered.map((r) => ({
      player_id: String(r.player_id),
      pts: r.pts ?? null,
      fg2m: (r as { fg2m?: number | null }).fg2m ?? null,
      fg3m: (r as { fg3m?: number | null }).fg3m ?? null,
      ftm: (r as { ftm?: number | null }).ftm ?? null,
      ast: r.ast ?? null,
      reb: r.reb ?? null,
      stl: r.stl ?? null,
      blk: r.blk ?? null,
      tov: r.tov ?? null,
      pf: r.pf ?? null,
      seconds_played: (r as { seconds_played?: number | null }).seconds_played ?? null,
    })),
    rosterSet
  )

  // League-wide leader badges (top 5) for visible stat columns.
  const seasonFinalGameIds = games.filter((g) => g.status === 'final').map((g) => g.id)
  if (seasonFinalGameIds.length > 0) {
    const { data: allSeasonStatRows } = await supabase
      .from('player_game_stats')
      .select(
        'player_id, pts, fg2m, fg3m, ftm, ast, reb, stl, blk, tov, pf, seconds_played, game_id'
      )
      .in('game_id', seasonFinalGameIds)

    const seasonRows = allSeasonStatRows || []
    const allAgg = aggregatePlayerStats(
      seasonRows
        .filter((r) => r.player_id)
        .map((r) => ({
          player_id: String(r.player_id),
          pts: r.pts ?? null,
          fg2m: (r as { fg2m?: number | null }).fg2m ?? null,
          fg3m: (r as { fg3m?: number | null }).fg3m ?? null,
          ftm: (r as { ftm?: number | null }).ftm ?? null,
          ast: r.ast ?? null,
          reb: r.reb ?? null,
          stl: r.stl ?? null,
          blk: r.blk ?? null,
          tov: r.tov ?? null,
          pf: r.pf ?? null,
          seconds_played: (r as { seconds_played?: number | null }).seconds_played ?? null,
        })),
      new Set(seasonRows.map((r) => String(r.player_id)))
    )
    const visibleKeys: TeamPageStatKey[] =
      params.tier === 'enterprise'
        ? ([...PUBLIC_PRIMARY_STAT_ORDER] as PublicPrimaryStatKey[])
        : (primaryStatKeys as TeamPageStatKey[])

    const badges: Record<string, Partial<Record<TeamPageStatKey, true>>> = {}
    for (const key of visibleKeys) {
      const ranked = Object.entries(allAgg)
        .map(([playerId, totals]) => ({
          playerId,
          value: Number(totals[key as keyof PlayerStatTotals] ?? 0),
        }))
        .filter((r) => Number.isFinite(r.value) && r.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
      for (const r of ranked) {
        if (!rosterSet.has(r.playerId)) continue
        badges[r.playerId] ||= {}
        badges[r.playerId][key] = true
      }
    }
    empty.leader_badges = Object.keys(badges).length > 0 ? badges : null
  }

  return empty
}
