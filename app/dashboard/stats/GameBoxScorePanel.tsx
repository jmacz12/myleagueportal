'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { formatSecondsAsMinSec } from '@/lib/game-lineup-minutes'

type PlayerJoin = {
  full_name?: string | null
  jersey_number?: number | null
}

type StatRow = {
  id: string
  team_id: string | null
  player_id: string | null
  pts: number | null
  fg2m?: number | null
  fg3m?: number | null
  ftm?: number | null
  ast: number | null
  reb: number | null
  stl: number | null
  blk: number | null
  tov: number | null
  pf: number | null
  seconds_played?: number | null
  players: PlayerJoin | null
}

type TeamLite = { id: string; name: string | null; color: string | null }

type Payload = {
  game: {
    id: string
    status: string
    home_score: number | null
    away_score: number | null
    period: number | null
    game_clock: string | null
  }
  homeTeam: TeamLite | null
  awayTeam: TeamLite | null
  stats: StatRow[]
}

const COLS = ['MIN', 'PTS', '2PM', '3PM', 'FTM', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PF'] as const

interface Props {
  gameId: string
  gameLabel: string
  isLive: boolean
  onClose: () => void
}

function sortRows(rows: StatRow[]) {
  return [...rows].sort((a, b) => {
    const ja = Number(a.players?.jersey_number) || 999
    const jb = Number(b.players?.jersey_number) || 999
    if (ja !== jb) return ja - jb
    return String(a.players?.full_name || '').localeCompare(String(b.players?.full_name || ''))
  })
}

function TeamTable({ name, rows }: { name: string; rows: StatRow[] }) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 16px' }}>
        {name} — no player stats yet.
      </p>
    )
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <div
        style={{
          fontWeight: 700,
          fontSize: '13px',
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}
      >
        {name}
      </div>
      <div
        style={{
          overflow: 'auto',
          border: '0.5px solid var(--border)',
          borderRadius: '8px',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
              <th style={{ padding: '8px', textAlign: 'left' }}>Player</th>
              {COLS.map((c) => (
                <th key={c} style={{ padding: '8px', textAlign: 'right' }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortRows(rows).map((r) => (
              <tr key={r.id} style={{ borderTop: '0.5px solid var(--border-light)' }}>
                <td style={{ padding: '8px' }}>{r.players?.jersey_number ?? '—'}</td>
                <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                  {r.players?.full_name || 'Player'}
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  {r.seconds_played != null ? formatSecondsAsMinSec(r.seconds_played) : '—'}
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{r.pts ?? 0}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{r.fg2m ?? 0}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{r.fg3m ?? 0}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{r.ftm ?? 0}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{r.reb ?? 0}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{r.ast ?? 0}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{r.stl ?? 0}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{r.blk ?? 0}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{r.tov ?? 0}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{r.pf ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function GameBoxScorePanel({ gameId, gameLabel, isLive, onClose }: Props) {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/games/${encodeURIComponent(gameId)}/box-score`, {
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => null)) as Payload & { error?: string }
    if (!res.ok || !json?.game?.id) {
      setError(typeof json?.error === 'string' ? json.error : 'Could not load box score')
      setLoading(false)
      return
    }
    setPayload(json)
    setError('')
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    if (!isLive) return
    const id = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(id)
  }, [isLive, load])

  const { homeRows, awayRows } = useMemo(() => {
    if (!payload) return { homeRows: [] as StatRow[], awayRows: [] as StatRow[] }
    const hid = payload.homeTeam?.id
    const aid = payload.awayTeam?.id
    const homeRows = payload.stats.filter((s) => s.team_id === hid)
    const awayRows = payload.stats.filter((s) => s.team_id === aid)
    return { homeRows, awayRows }
  }, [payload])

  const scoreLine =
    payload &&
    `${payload.awayTeam?.name ?? 'Away'} ${payload.game.away_score ?? 0} – ${payload.game.home_score ?? 0} ${payload.homeTeam?.name ?? 'Home'}`

  return (
    <div
      className="card"
      style={{ marginTop: '12px', padding: '16px', border: '0.5px solid var(--border)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
            Box score
            {isLive ? (
              <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: '8px', fontSize: '12px' }}>
                LIVE
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{gameLabel}</div>
          {scoreLine ? (
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>
              {scoreLine}
            </div>
          ) : null}
        </div>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading box score…</p>
      ) : error ? (
        <p style={{ fontSize: '13px', color: '#dc2626' }}>{error}</p>
      ) : payload ? (
        <>
          {homeRows.length === 0 && awayRows.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              No stats recorded for this game yet.
            </p>
          ) : (
            <>
              <TeamTable name={payload.awayTeam?.name ?? 'Away'} rows={awayRows} />
              <TeamTable name={payload.homeTeam?.name ?? 'Home'} rows={homeRows} />
            </>
          )}
          <Link
            href={`/dashboard/games/${gameId}/scoring`}
            className="btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px', textDecoration: 'none', display: 'inline-block' }}
          >
            {isLive ? 'Open live scorer' : 'Edit stats'}
          </Link>
        </>
      ) : null}
    </div>
  )
}
