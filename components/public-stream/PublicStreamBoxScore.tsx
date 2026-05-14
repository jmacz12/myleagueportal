'use client'

/**
 * Full public box score for a single game. Data is read from `player_game_stats` — the same rows
 * the organizer updates from **Dashboard → Games → scoring** (PATCH `/api/games/[gameId]/stats`).
 * Supabase Realtime + short polling while the game is live keep the Stream tab aligned with the scorer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { formatSecondsAsMinSec } from '@/lib/game-lineup-minutes'
import {
  PRIMARY_STAT_LABELS,
  PUBLIC_PRIMARY_STAT_ORDER,
  normalizePublicPrimaryStatKeys,
  orderedFanStatColumns,
  type PublicPrimaryStatKey,
} from '@/lib/public-primary-stats'
import type { LeagueWatchLeaguePreset } from '@/components/public-stream/LeagueWatchScoreStrip'

function normalizePublicBoxScoreTier(raw: unknown): 'basic' | 'pro' | 'enterprise' {
  const t = String(raw ?? '').toLowerCase()
  if (t === 'enterprise') return 'enterprise'
  if (t === 'basic') return 'basic'
  if (t === 'pro') return 'pro'
  if (t === 'basic_or_pro') return 'pro'
  return 'pro'
}

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
  seconds_played?: number | null
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
  /** `basic` = roster only on public stream; `pro` = five picks (left) + locked rest; `enterprise` = full grid. */
  publicBoxScoreTier?: 'basic' | 'pro' | 'enterprise'
  /** Five stat keys for Pro/Enterprise fan surfaces (from `organizations.public_stream_primary_stat_keys`). */
  publicStreamPrimaryStatKeys?: PublicPrimaryStatKey[]
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
  const [lockedSheet, setLockedSheet] = useState<{ label: string } | null>(null)

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
    const normalized: BoxScorePayload = {
      ...json,
      publicBoxScoreTier: normalizePublicBoxScoreTier(
        (json as { publicBoxScoreTier?: unknown }).publicBoxScoreTier
      ),
      publicStreamPrimaryStatKeys: normalizePublicPrimaryStatKeys(
        (json as { publicStreamPrimaryStatKeys?: unknown }).publicStreamPrimaryStatKeys
      ),
    }
    setPayload(normalized)
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

  const leadersStrip = useMemo(() => {
    const fmt = (s: GameStatRow) => {
      const p = s.players
      const j = p?.jersey_number != null ? `#${p.jersey_number} ` : ''
      const n = (p?.full_name || '—').trim()
      return `${j}${n}`.trim()
    }

    const ptsLeaders = (teamStats: GameStatRow[]) => {
      if (!teamStats.length) return null
      const max = Math.max(0, ...teamStats.map((r) => r.pts ?? 0))
      if (max <= 0) return null
      const rows = teamStats.filter((r) => (r.pts ?? 0) === max)
      return { names: rows.map(fmt).join(' · '), pts: max }
    }

    const gameWide = (key: 'reb' | 'ast') => {
      const all = [...homeStats, ...awayStats]
      if (!all.length) return null
      const max = Math.max(0, ...all.map((r) => (r[key] ?? 0) as number))
      if (max <= 0) return null
      const rows = all.filter((r) => (r[key] ?? 0) === max)
      const label = key === 'reb' ? 'REB' : 'AST'
      const text = rows.map((r) => `${fmt(r)} (${max})`).join(' · ')
      return { label, text }
    }

    const homePts = ptsLeaders(homeStats)
    const awayPts = ptsLeaders(awayStats)
    const reb = gameWide('reb')
    const ast = gameWide('ast')

    if (!homePts && !awayPts && !reb && !ast) return null

    return { homePts, awayPts, reb, ast }
  }, [homeStats, awayStats])

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
  const tier = normalizePublicBoxScoreTier(payload.publicBoxScoreTier)
  const showFullPublicBoxScoreStats = tier === 'enterprise'
  const primaryUnlock = new Set(
    normalizePublicPrimaryStatKeys(payload.publicStreamPrimaryStatKeys)
  )
  const orderedColumns: PublicPrimaryStatKey[] =
    tier === 'basic'
      ? []
      : tier === 'enterprise'
        ? [...PUBLIC_PRIMARY_STAT_ORDER]
        : orderedFanStatColumns(payload.publicStreamPrimaryStatKeys ?? [])

  const statColCount = orderedColumns.length
  const statGridTemplateColumns =
    statColCount > 0
      ? `32px minmax(100px, 1fr) repeat(${statColCount}, minmax(38px, 46px))`
      : `32px minmax(100px, 1fr)`
  const statTableMinWidthPx = statColCount > 0 ? 280 + statColCount * 44 : 260

  function statValue(s: GameStatRow, key: PublicPrimaryStatKey): string {
    if (key === 'min') return formatSecondsAsMinSec(Number(s.seconds_played ?? 0))
    const v = s[key as keyof GameStatRow]
    return String(Number(v ?? 0))
  }

  function isStatUnlocked(key: PublicPrimaryStatKey): boolean {
    return showFullPublicBoxScoreStats || primaryUnlock.has(key)
  }

  function openLockedSheet(statKey: PublicPrimaryStatKey) {
    setLockedSheet({ label: PRIMARY_STAT_LABELS[statKey] })
  }

  function StatTable({ teamStats, teamName, teamColor }: { teamStats: GameStatRow[]; teamName: string; teamColor: string | null }) {
    const headerBg = P.accentSoftBg
    const rowBorder = P.surfaceBorder

    if (tier === 'basic') {
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
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '32px minmax(100px, 1fr)',
                gap: '4px',
                padding: '8px 14px',
                background: headerBg,
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: P.muted,
                  textAlign: 'center',
                }}
              >
                #
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: P.muted,
                  textAlign: 'left',
                }}
              >
                Player
              </span>
            </div>
            {teamStats.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: P.muted }}>No players yet</div>
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
                        gridTemplateColumns: '32px minmax(100px, 1fr)',
                        gap: '4px',
                        padding: '10px 14px',
                        borderTop: idx > 0 ? `0.5px solid ${rowBorder}` : 'none',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '11px', color: P.muted, textAlign: 'center' }}>
                        {player?.jersey_number != null ? `#${player.jersey_number}` : '—'}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: P.heading }}>{player?.full_name || '—'}</span>
                    </div>
                  )
                })
            )}
            <div
              style={{
                padding: '12px 14px',
                borderTop: `0.5px solid ${rowBorder}`,
                fontSize: '12px',
                lineHeight: 1.45,
                color: P.muted,
                background: P.accentSoftBg,
              }}
            >
              Per-player stats on the public stream are a <strong style={{ color: P.heading }}>Pro</strong> feature (
              <strong style={{ color: P.heading }}>Enterprise</strong> shows the full box score). The scoreboard above
              still updates live.
            </div>
          </div>
        </div>
      )
    }

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
              gridTemplateColumns: statGridTemplateColumns,
              gap: '4px',
              padding: '8px 14px',
              background: headerBg,
              minWidth: `${statTableMinWidthPx}px`,
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: P.muted,
                textAlign: 'center',
              }}
            >
              #
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: P.muted,
                textAlign: 'left',
              }}
            >
              Player
            </span>
            {orderedColumns.map((k) => {
              const open = !isStatUnlocked(k)
              if (!open) {
                return (
                  <span
                    key={k}
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: P.muted,
                      textAlign: 'center',
                      lineHeight: 1.15,
                    }}
                  >
                    {PRIMARY_STAT_LABELS[k]}
                  </span>
                )
              }
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => openLockedSheet(k)}
                  title="Tap for Enterprise — full public stat grid"
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: P.muted,
                    textAlign: 'center',
                    opacity: 0.75,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1px',
                    lineHeight: 1.15,
                    background: 'transparent',
                    border: 'none',
                    padding: '2px 0',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span aria-hidden style={{ fontSize: '9px' }}>
                    🔒
                  </span>
                  <span>{PRIMARY_STAT_LABELS[k]}</span>
                </button>
              )
            })}
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
                      gridTemplateColumns: statGridTemplateColumns,
                      gap: '4px',
                      padding: '10px 14px',
                      borderTop: idx > 0 ? `0.5px solid ${rowBorder}` : 'none',
                      alignItems: 'center',
                      minWidth: `${statTableMinWidthPx}px`,
                    }}
                  >
                    <span style={{ fontSize: '11px', color: P.muted, textAlign: 'center' }}>
                      {player?.jersey_number != null ? `#${player.jersey_number}` : '—'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: P.heading }}>{player?.full_name || '—'}</span>
                    {orderedColumns.map((stat) => {
                      const open = !isStatUnlocked(stat)
                      const val = statValue(s, stat)
                      return (
                        <span key={stat} style={{ textAlign: 'center', minHeight: '22px' }}>
                          {open ? (
                            <button
                              type="button"
                              onClick={() => openLockedSheet(stat)}
                              aria-label={`${PRIMARY_STAT_LABELS[stat]}: Enterprise only. Tap for details.`}
                              style={{
                                fontSize: '12px',
                                fontWeight: 500,
                                color: P.muted,
                                opacity: 0.65,
                                fontVariantNumeric: 'tabular-nums',
                                background: 'transparent',
                                border: 'none',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                width: '100%',
                              }}
                            >
                              —
                            </button>
                          ) : (
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: stat === 'pts' ? 800 : 400,
                                color: stat === 'pts' ? P.heading : P.body,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {val}
                            </span>
                          )}
                        </span>
                      )
                    })}
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

      {leadersStrip ? (
        <div
          style={{
            padding: '12px 16px',
            background: P.accentSoftBg,
            borderBottom: `1px solid ${P.surfaceBorder}`,
          }}
        >
          <p
            style={{
              margin: '0 0 8px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: P.muted,
            }}
          >
            Leaders
          </p>
          {leadersStrip.homePts || leadersStrip.awayPts ? (
            <div
              style={{
                fontSize: '13px',
                color: P.body,
                lineHeight: 1.5,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px 16px',
                marginBottom: leadersStrip.reb || leadersStrip.ast ? '8px' : 0,
              }}
            >
              {leadersStrip.homePts ? (
                <span>
                  <strong style={{ color: P.heading }}>{homeTeam?.name || 'Home'}</strong> — {leadersStrip.homePts.names} ·{' '}
                  <strong style={{ color: P.heading }}>{leadersStrip.homePts.pts} PTS</strong>
                </span>
              ) : null}
              {leadersStrip.awayPts ? (
                <span>
                  <strong style={{ color: P.heading }}>{awayTeam?.name || 'Away'}</strong> — {leadersStrip.awayPts.names} ·{' '}
                  <strong style={{ color: P.heading }}>{leadersStrip.awayPts.pts} PTS</strong>
                </span>
              ) : null}
            </div>
          ) : null}
          {leadersStrip.reb || leadersStrip.ast ? (
            <div
              style={{
                fontSize: '12px',
                color: P.muted,
                lineHeight: 1.45,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px 12px',
              }}
            >
              {leadersStrip.reb ? (
                <span>
                  <strong style={{ color: P.heading }}>{leadersStrip.reb.label}</strong> {leadersStrip.reb.text}
                </span>
              ) : null}
              {leadersStrip.ast ? (
                <span>
                  <strong style={{ color: P.heading }}>{leadersStrip.ast.label}</strong> {leadersStrip.ast.text}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ padding: hideLiveGameHeader ? '14px 14px 20px' : '18px 14px 20px' }}>
        {tier === 'basic' ? (
          <div
            style={{
              marginBottom: '14px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1px solid ${P.surfaceBorder}`,
              background: P.surfaceBg,
              fontSize: '12px',
              lineHeight: 1.45,
              color: P.body,
            }}
          >
            <strong style={{ color: P.heading }}>Basic:</strong> visitors see <strong>roster only</strong> here (no per-player stat columns on the public stream).{' '}
            <strong>Pro</strong> and <strong>Enterprise</strong> add public stat columns; full grid is <strong>Enterprise</strong>.
          </div>
        ) : null}
        {tier === 'pro' ? (
          <div
            style={{
              marginBottom: '14px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1px dashed ${P.surfaceBorder}`,
              background: P.accentSoftBg,
              fontSize: '12px',
              lineHeight: 1.45,
              color: P.body,
            }}
          >
            <strong style={{ color: P.heading }}>Pro:</strong> visitors see your <strong>five</strong> chosen stats first, then
            locked columns. Tap <strong>🔒</strong> or <strong>—</strong> for details. <strong>Enterprise</strong> unlocks
            every column. Your scorer still records everything.
          </div>
        ) : null}
        <StatTable teamStats={homeStats} teamName={homeTeam?.name || 'Home'} teamColor={homeTeam?.color ?? null} />
        <StatTable teamStats={awayStats} teamName={awayTeam?.name || 'Away'} teamColor={awayTeam?.color ?? null} />
      </div>

      {lockedSheet ? (
        <div
          role="presentation"
          onClick={() => setLockedSheet(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '12px',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="locked-stat-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              background: P.surfaceBg,
              color: P.body,
              borderRadius: '16px 16px 0 0',
              padding: '20px 18px 22px',
              border: `1px solid ${P.surfaceBorder}`,
              boxShadow: '0 -8px 30px rgba(0,0,0,0.2)',
            }}
          >
            <h2
              id="locked-stat-title"
              style={{ margin: '0 0 10px', fontSize: '17px', fontWeight: 800, color: P.heading }}
            >
              Enterprise only — {lockedSheet.label}
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '14px', lineHeight: 1.5 }}>
              On <strong>Pro</strong>, visitors see your <strong>five</strong> chosen stat columns first (under <strong>Dashboard → Games</strong>), then locked columns.{' '}
              Everything else still records on your score sheet. <strong>Upgrade to Enterprise</strong> to unlock the full stat row on the public Stream (and on public team pages).
            </p>
            <button
              type="button"
              onClick={() => setLockedSheet(null)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '14px',
                border: `1px solid ${P.surfaceBorder}`,
                background: P.accentSoftBg,
                color: P.heading,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
