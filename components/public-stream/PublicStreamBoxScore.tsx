'use client'

/**
 * Full public box score for a single game. Data is read from `player_game_stats` — the same rows
 * the organizer updates from **Dashboard → Games → scoring** (PATCH `/api/games/[gameId]/stats`).
 * Supabase Realtime + short polling while the game is live keep the Stream tab aligned with the scorer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { LeagueWatchLeaguePreset } from '@/components/public-stream/LeagueWatchScoreStrip'

const statKeys = ['pts', 'fg2m', 'fg3m', 'ftm', 'ast', 'reb', 'stl', 'blk', 'tov', 'pf'] as const
type StatKey = (typeof statKeys)[number]

const statHeaders = ['#', 'Player', 'PTS', '2PM', '3PM', 'FTM', 'AST', 'REB', 'STL', 'BLK', 'TOV', 'PF'] as const

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type PlayerJoin = {
  full_name?: string | null
  jersey_number?: number | null
}

type GameStatRow = {
  id: string
  team_id: string | null
  player_id: string | null
  pts: number | null
  ast: number | null
  reb: number | null
  stl: number | null
  blk: number | null
  tov: number | null
  pf: number | null
  fg2m?: number | null
  fg3m?: number | null
  ftm?: number | null
  players: PlayerJoin | null
}

type TeamLite = { id: string; name: string | null; color: string | null }

type BoxScorePayload = {
  game: {
    id: string
    home_team_id: string | null
    away_team_id: string | null
    home_score: number | null
    away_score: number | null
    status: string
    period: number | null
    game_clock: string | null
    location?: string | null
  }
  homeTeam: TeamLite | null
  awayTeam: TeamLite | null
  stats: GameStatRow[]
}

export type PublicStreamBoxScoreProps = {
  gameId: string
  leaguePreset: LeagueWatchLeaguePreset
  /**
   * When true, omit the big score / Q / clock header (use when the stream embed already shows `/games/.../overlay`).
   * Team player tables still show team names in each section.
   */
  hideLiveGameHeader?: boolean
  /** Space above this block when it sits below the stream player (default 0). */
  marginTopPx?: number
}

export function PublicStreamBoxScore({
  gameId,
  leaguePreset,
  hideLiveGameHeader = false,
  marginTopPx = 0,
}: PublicStreamBoxScoreProps) {
  const P = leaguePreset
  const [payload, setPayload] = useState<BoxScorePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/games/${encodeURIComponent(gameId)}/box-score`, {
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => null)) as BoxScorePayload & { error?: string }
    if (!res.ok || !json?.game?.id) {
      setError(typeof json?.error === 'string' ? json.error : 'Could not load box score')
      setLoading(false)
      return
    }
    setPayload(json as BoxScorePayload)
    setError('')
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    if (!gameId) return
    void load()
    const channel = supabase
      .channel(`public-box-score-${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => void load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_game_stats', filter: `game_id=eq.${gameId}` },
        () => void load()
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [gameId, load])

  useEffect(() => {
    if (!gameId || !payload?.game) return
    if (payload.game.status !== 'live') return
    const id = window.setInterval(() => void load(), 1000)
    return () => window.clearInterval(id)
  }, [gameId, payload?.game, load])

  const { homeStats, awayStats } = useMemo(() => {
    if (!payload?.game) return { homeStats: [] as GameStatRow[], awayStats: [] as GameStatRow[] }
    const homeId = payload.homeTeam?.id
    const awayId = payload.awayTeam?.id
    const rows = payload.stats || []
    const homeStats = rows.filter((s) => {
      const player = s.players
      return !!player && !!homeId && s.team_id === homeId
    })
    const awayStats = rows.filter((s) => {
      const player = s.players
      return !!player && !!awayId && s.team_id === awayId
    })
    return { homeStats, awayStats }
  }, [payload])

  const headerBand = P.pageBg

  if (loading) {
    return (
      <div
        style={{
          marginTop: marginTopPx ? `${marginTopPx}px` : undefined,
          padding: '22px 18px',
          borderRadius: '14px',
          background: P.surfaceBg,
          border: `1px solid ${P.surfaceBorder}`,
          color: P.muted,
          fontSize: '14px',
        }}
      >
        Loading box score…
      </div>
    )
  }
  if (error || !payload) {
    return (
      <div
        style={{
          marginTop: marginTopPx ? `${marginTopPx}px` : undefined,
          padding: '22px 18px',
          borderRadius: '14px',
          background: P.surfaceBg,
          border: `1px solid ${P.surfaceBorder}`,
          color: P.body,
          fontSize: '14px',
        }}
      >
        {error || 'Box score unavailable.'}
      </div>
    )
  }

  const { game, homeTeam, awayTeam } = payload

  function StatTable({ teamStats, teamName, teamColor }: { teamStats: GameStatRow[]; teamName: string; teamColor: string | null }) {
    const headerBg = P.accentSoftBg
    const rowBorder = P.surfaceBorder
    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          {teamColor ? (
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: teamColor, flexShrink: 0 }} />
          ) : null}
          <div style={{ fontSize: '14px', fontWeight: 800, color: P.heading }}>{teamName}</div>
        </div>
        <div
          style={{
            background: P.surfaceBg,
            borderRadius: '10px',
            overflow: 'hidden',
            border: `1px solid ${P.surfaceBorder}`,
            overflowX: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '32px minmax(100px, 1fr) repeat(10, minmax(36px, 40px))',
              gap: '4px',
              padding: '8px 14px',
              background: headerBg,
              minWidth: '520px',
            }}
          >
            {statHeaders.map((h) => (
              <span
                key={h}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: P.muted,
                  textAlign: h !== 'Player' ? 'center' : 'left',
                }}
              >
                {h}
              </span>
            ))}
          </div>
          {teamStats.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: P.muted }}>No stats yet</div>
          ) : (
            teamStats
              .slice()
              .sort((a, b) => (b.pts || 0) - (a.pts || 0))
              .map((s, idx) => {
                const player = s.players
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px minmax(100px, 1fr) repeat(10, minmax(36px, 40px))',
                      gap: '4px',
                      padding: '10px 14px',
                      borderTop: idx > 0 ? `0.5px solid ${rowBorder}` : 'none',
                      alignItems: 'center',
                      minWidth: '520px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: P.muted, textAlign: 'center' }}>
                      {player?.jersey_number != null ? `#${player.jersey_number}` : '—'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: P.heading }}>{player?.full_name || '—'}</span>
                    {statKeys.map((stat) => (
                      <span
                        key={stat}
                        style={{
                          fontSize: '13px',
                          fontWeight: stat === 'pts' ? 800 : 400,
                          color: stat === 'pts' ? P.heading : P.body,
                          textAlign: 'center',
                        }}
                      >
                        {Number(s[stat as StatKey] ?? 0)}
                      </span>
                    ))}
                  </div>
                )
              })
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        marginTop: marginTopPx ? `${marginTopPx}px` : undefined,
        borderRadius: '14px',
        overflow: 'hidden',
        border: `1px solid ${P.surfaceBorder}`,
        background: P.surfaceBg,
        boxShadow: '0 8px 24px -18px rgba(0,0,0,0.12)',
      }}
    >
      {!hideLiveGameHeader ? (
        <div style={{ padding: '14px 16px 12px', background: headerBand, borderBottom: `1px solid ${P.surfaceBorder}` }}>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: P.muted,
            }}
          >
            Box score
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right', minWidth: 0 }}>
              {homeTeam?.color ? (
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    background: homeTeam.color,
                    display: 'inline-block',
                    marginBottom: '4px',
                  }}
                />
              ) : null}
              <div style={{ fontSize: '16px', fontWeight: 800, color: P.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {homeTeam?.name || 'Home'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <div
                  style={{
                    background: P.accentSoftBg,
                    color: P.heading,
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: 'clamp(22px, 5vw, 34px)',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: '56px',
                    textAlign: 'center',
                    border: `1px solid ${P.surfaceBorder}`,
                  }}
                >
                  {game.home_score ?? 0}
                </div>
                <span style={{ color: P.muted, fontSize: '18px', fontWeight: 800 }}>—</span>
                <div
                  style={{
                    background: P.accentSoftBg,
                    color: P.heading,
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: 'clamp(22px, 5vw, 34px)',
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: '56px',
                    textAlign: 'center',
                    border: `1px solid ${P.surfaceBorder}`,
                  }}
                >
                  {game.away_score ?? 0}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
                {game.status === 'live' ? (
                  <span
                    style={{
                      background: '#dc2626',
                      color: '#fff',
                      borderRadius: '999px',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                    }}
                  >
                    Live
                  </span>
                ) : null}
                <span style={{ color: P.muted, fontSize: '12px', fontWeight: 600 }}>
                  Q{game.period ?? 1} · {game.game_clock || '—'}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              {awayTeam?.color ? (
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    background: awayTeam.color,
                    display: 'inline-block',
                    marginBottom: '4px',
                  }}
                />
              ) : null}
              <div style={{ fontSize: '16px', fontWeight: 800, color: P.heading, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {awayTeam?.name || 'Away'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 16px 0', borderBottom: `1px solid ${P.surfaceBorder}` }}>
          <p
            style={{
              margin: 0,
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: P.muted,
            }}
          >
            Player stats
          </p>
        </div>
      )}

      <div style={{ padding: hideLiveGameHeader ? '14px 14px 20px' : '18px 14px 20px' }}>
        <StatTable teamStats={homeStats} teamName={homeTeam?.name || 'Home'} teamColor={homeTeam?.color ?? null} />
        <StatTable teamStats={awayStats} teamName={awayTeam?.name || 'Away'} teamColor={awayTeam?.color ?? null} />
      </div>
    </div>
  )
}
