'use client'

import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Link2, Trophy } from 'lucide-react'
import GameHighlights from '../../GameHighlights'
import { contrastTextOnColor } from '@/lib/contrast-text-on-color'
import { publicFanSiteOrigin } from '@/lib/public-site-origin'
import { parseStarterSlotArray } from '@/lib/starter-slot-array'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function jerseySort(a: Player, b: Player) {
  const na = parseInt(String(a.jersey_number || '999'), 10)
  const nb = parseInt(String(b.jersey_number || '999'), 10)
  if (na !== nb) return na - nb
  return a.full_name.localeCompare(b.full_name)
}

function jerseyLabel(p: Player | undefined) {
  if (!p) return '—'
  if (p.jersey_number && String(p.jersey_number).trim() !== '') return String(p.jersey_number)
  return '?'
}

interface Game {
  id: string
  home_team_id: string | null
  away_team_id: string | null
  home_score: number
  away_score: number
  status: string
  period: number
  game_clock: string
  location: string | null
  scheduled_at: string | null
  home_starter_slot_ids?: (string | null)[] | null
  away_starter_slot_ids?: (string | null)[] | null
}

interface Team {
  id: string
  name: string
  color: string | null
}

interface Player {
  id: string
  full_name: string
  jersey_number: string | null
  team_id: string | null
}

interface PlayerStat {
  player_id: string
  pts: number
  fg2m: number
  fg3m: number
  ftm: number
  ast: number
  reb: number
  stl: number
  blk: number
  tov: number
  pf: number
  seconds_played: number
}

function rowFromApi(s: Record<string, unknown>): PlayerStat {
  return {
    player_id: String(s.player_id),
    pts: Number(s.pts) || 0,
    fg2m: Number(s.fg2m) || 0,
    fg3m: Number(s.fg3m) || 0,
    ftm: Number(s.ftm) || 0,
    ast: Number(s.ast) || 0,
    reb: Number(s.reb) || 0,
    stl: Number(s.stl) || 0,
    blk: Number(s.blk) || 0,
    tov: Number(s.tov) || 0,
    pf: Number(s.pf) || 0,
    seconds_played: Math.max(0, Math.floor(Number(s.seconds_played) || 0)),
  }
}

type ActionKey = 'fg3m' | 'fg2m' | 'ftm' | 'ast' | 'reb' | 'stl' | 'blk' | 'tov' | 'pf'
type UndoEntry = {
  playerId: string
  increment: Record<string, number>
  label: string
}

const STAT_ACTIONS: { key: ActionKey; label: string; buttonStyle?: CSSProperties }[] = [
  { key: 'fg3m', label: '3PT', buttonStyle: { background: '#15803d', color: 'white' } },
  { key: 'fg2m', label: '2PT', buttonStyle: { background: '#166534', color: 'white' } },
  { key: 'ftm', label: 'FT', buttonStyle: { background: '#14532d', color: 'white' } },
  { key: 'ast', label: 'AST' },
  { key: 'reb', label: 'REB' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'tov', label: 'TO' },
  { key: 'pf', label: 'PF' },
]

export default function ScoringPage() {
  const params = useParams()
  const router = useRouter()
  const gameId = params.gameId as string

  const [game, setGame] = useState<Game | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [stats, setStats] = useState<Record<string, PlayerStat>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [clock, setClock] = useState('10:00')
  const [period, setPeriod] = useState(1)
  const [clockRunning, setClockRunning] = useState(false)
  const clockRef = useRef<NodeJS.Timeout | null>(null)
  const [showHighlights, setShowHighlights] = useState(false)
  const [slotPick, setSlotPick] = useState<{ side: 'home' | 'away'; index: number } | null>(null)
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [pendingSub, setPendingSub] = useState<{ side: 'home' | 'away'; benchId: string } | null>(null)
  /** From `/api/teams` — used for the fan-facing league URL (stream + overlay on site). */
  const [orgSlug, setOrgSlug] = useState<string | null>(null)
  const [verifiedFanHostname, setVerifiedFanHostname] = useState<string | null>(null)
  const skipClockPersistRef = useRef(true)
  const clockLiveRef = useRef(clock)
  const periodLiveRef = useRef(period)

  useEffect(() => {
    clockLiveRef.current = clock
  }, [clock])
  useEffect(() => {
    periodLiveRef.current = period
  }, [period])

  const flushClockToServer = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_clock: clockLiveRef.current,
        period: periodLiveRef.current,
      }),
    })
    if (!res.ok) {
      try {
        const j = (await res.json()) as { error?: string }
        console.error('Clock sync failed:', j?.error || res.status)
      } catch {
        console.error('Clock sync failed:', res.status)
      }
    }
  }, [gameId])

  const fetchData = useCallback(async () => {
    const [gameRes, teamsRes, playersRes, statsRes] = await Promise.all([
      fetch(`/api/games/${gameId}`),
      fetch('/api/teams'),
      fetch('/api/players'),
      fetch(`/api/games/${gameId}/stats`),
    ])

    const [gameData, teamsData, playersData, statsData] = await Promise.all([
      gameRes.json(),
      teamsRes.json(),
      playersRes.json(),
      statsRes.json(),
    ])

    setGame(gameData.game)
    setTeams(teamsData.teams || [])
    setOrgSlug(typeof teamsData.org_slug === 'string' ? teamsData.org_slug : null)
    setVerifiedFanHostname(
      typeof teamsData.verified_fan_hostname === 'string' && teamsData.verified_fan_hostname.trim()
        ? teamsData.verified_fan_hostname.trim().toLowerCase()
        : null
    )
    setPlayers(playersData.players || [])
    skipClockPersistRef.current = true
    setClock(gameData.game?.game_clock || '10:00')
    setPeriod(gameData.game?.period || 1)

    const statsMap: Record<string, PlayerStat> = {}
    for (const s of statsData.stats || []) {
      statsMap[String(s.player_id)] = rowFromApi(s as Record<string, unknown>)
    }
    setStats(statsMap)
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_game_stats', filter: `game_id=eq.${gameId}` },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, fetchData])

  useEffect(() => {
    if (loading || !gameId) return
    if (skipClockPersistRef.current) {
      skipClockPersistRef.current = false
      return
    }
    const t = setTimeout(() => {
      void flushClockToServer()
    }, 900)
    return () => clearTimeout(t)
  }, [clock, period, gameId, loading, flushClockToServer])

  async function applyIncrement(
    playerId: string,
    increment: Record<string, number>,
    options?: { pushUndo?: UndoEntry | null }
  ): Promise<boolean> {
    setSaving(playerId)
    try {
      const res = await fetch(`/api/games/${gameId}/stats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, increment }),
      })
      if (res.ok) {
        if (options?.pushUndo) {
          setUndoStack((prev) => [options.pushUndo!, ...prev].slice(0, 25))
        }
        await fetchData()
        return true
      }
      let msg = 'Could not save stat'
      try {
        const j = (await res.json()) as { error?: string }
        if (j?.error) msg = j.error
      } catch {
        /* ignore */
      }
      window.alert(msg)
      return false
    } finally {
      setSaving(null)
    }
  }

  async function persistStarters(home: (string | null)[], away: (string | null)[]) {
    await fetch(`/api/games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        home_starter_slot_ids: home,
        away_starter_slot_ids: away,
        period,
        game_clock: clock,
      }),
    })
    await fetchData()
  }

  function clockToSeconds(c: string) {
    const [m, s] = c.split(':').map(Number)
    return (m || 0) * 60 + (s || 0)
  }

  function secondsToClock(sec: number) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function startClock() {
    if (clockRunning) {
      if (clockRef.current) clearInterval(clockRef.current)
      clockRef.current = null
      setClockRunning(false)
      requestAnimationFrame(() => void flushClockToServer())
      return
    }
    setClockRunning(true)
    clockRef.current = setInterval(() => {
      setClock((prev) => {
        const secs = clockToSeconds(prev)
        if (secs <= 0) {
          if (clockRef.current) clearInterval(clockRef.current)
          setClockRunning(false)
          return '0:00'
        }
        return secondsToClock(secs - 1)
      })
    }, 1000)
  }

  useEffect(() => {
    return () => {
      if (clockRef.current) clearInterval(clockRef.current)
    }
  }, [])

  async function endGame() {
    if (!confirm('End this game? Scores will be finalized.')) return
    if (clockRef.current) clearInterval(clockRef.current)
    setClockRunning(false)
    await flushClockToServer()
    await fetch('/api/games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_id: gameId,
        status: 'final',
        period,
        game_clock: clock,
      }),
    })
    await fetchData()
    setShowHighlights(true)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
        Loading game...
      </div>
    )
  }

  if (!game) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
        Game not found
      </div>
    )
  }

  const getTeam = (id: string | null) => teams.find((t) => t.id === id)
  const homeTeam = getTeam(game.home_team_id)
  const awayTeam = getTeam(game.away_team_id)

  const homeScoreChip = homeTeam?.color?.trim()
    ? {
        background: homeTeam.color,
        color: contrastTextOnColor(homeTeam.color),
        border: '2px solid rgba(0,0,0,0.14)',
      }
    : { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }
  const awayScoreChip = awayTeam?.color?.trim()
    ? {
        background: awayTeam.color,
        color: contrastTextOnColor(awayTeam.color),
        border: '2px solid rgba(0,0,0,0.14)',
      }
    : { background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }

  const shareOrigin = publicFanSiteOrigin(verifiedFanHostname)
  const publicWatchUrl = orgSlug?.trim()
    ? `${shareOrigin}/league/${encodeURIComponent(orgSlug.trim())}?tab=stream&game=${encodeURIComponent(gameId)}`
    : `${shareOrigin}/games/${encodeURIComponent(gameId)}/scoreboard`

  const homeSlots = parseStarterSlotArray(game.home_starter_slot_ids)
  const awaySlots = parseStarterSlotArray(game.away_starter_slot_ids)

  const homeRoster = players.filter((p) => p.team_id === game.home_team_id).sort(jerseySort)
  const awayRoster = players.filter((p) => p.team_id === game.away_team_id).sort(jerseySort)

  function usedIds(side: 'home' | 'away'): Set<string> {
    const slots = side === 'home' ? homeSlots : awaySlots
    return new Set(slots.filter((x): x is string => !!x))
  }

  async function setSlot(side: 'home' | 'away', index: number, playerId: string | null) {
    const nextHome = [...homeSlots]
    const nextAway = [...awaySlots]
    const target = side === 'home' ? nextHome : nextAway
    target[index] = playerId
    await persistStarters(nextHome, nextAway)
    setSlotPick(null)
  }

  async function fillFirstFive(side: 'home' | 'away') {
    const roster = side === 'home' ? homeRoster : awayRoster
    const next = parseStarterSlotArray(null)
    roster.slice(0, 5).forEach((p, i) => {
      next[i] = p.id
    })
    if (side === 'home') await persistStarters(next, awaySlots)
    else await persistStarters(homeSlots, next)
  }

  const onCourtPlayerIds = [...homeSlots, ...awaySlots].filter((x): x is string => !!x)
  const onCourtPlayers = onCourtPlayerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p)
  const pendingActionDef = pendingAction ? STAT_ACTIONS.find((a) => a.key === pendingAction) : null

  async function recordForPlayer(playerId: string) {
    if (!pendingAction) return
    const selected = players.find((p) => p.id === playerId)
    if (!selected) return
    const entry: UndoEntry = {
      playerId,
      increment: { [pendingAction]: -1 },
      label: `${pendingActionDef?.label || pendingAction} · #${jerseyLabel(selected)}`,
    }
    const ok = await applyIncrement(playerId, { [pendingAction]: 1 }, { pushUndo: entry })
    if (ok) setPendingAction(null)
  }

  async function undoLast(): Promise<boolean> {
    let popped: UndoEntry | undefined
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      popped = prev[0]
      return prev.slice(1)
    })
    if (!popped) return false
    const ok = await applyIncrement(popped.playerId, popped.increment, { pushUndo: null })
    if (!ok) setUndoStack((prev) => [popped!, ...prev])
    return ok
  }

  function LineupColumn({
    side,
    label,
    teamColor,
    slots,
    roster,
  }: {
    side: 'home' | 'away'
    label: string
    teamColor: string | null
    slots: (string | null)[]
    roster: Player[]
  }) {
    const used = usedIds(side)
    const tc = teamColor?.trim() || null
    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {teamColor ? (
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  background: teamColor,
                  flexShrink: 0,
                }}
              />
            ) : null}
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>{label}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Starters · tap # to record</span>
          </div>
          <button
            type="button"
            onClick={() => void fillFirstFive(side)}
            className="btn-s"
            style={{ fontSize: '11px', padding: '6px 10px', fontWeight: 700 }}
          >
            Fill first 5
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: '8px',
          }}
        >
          {slots.map((pid, index) => {
            const p = pid ? players.find((x) => x.id === pid) : undefined
            const active = !!pid && pendingAction !== null
            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (pid) {
                      if (pendingAction) {
                        void recordForPlayer(pid)
                      } else if (pendingSub && pendingSub.side === side) {
                        const benchId = pendingSub.benchId
                        const nextHome = [...homeSlots]
                        const nextAway = [...awaySlots]
                        const target = side === 'home' ? nextHome : nextAway
                        const next = target.map((val, idx) => (idx === index ? benchId : val))
                        if (side === 'home') void persistStarters(next, nextAway)
                        else void persistStarters(nextHome, next)
                        setPendingSub(null)
                      }
                    } else {
                      setSlotPick({ side, index })
                    }
                  }}
                  style={{
                    aspectRatio: '1',
                    maxHeight: '72px',
                    borderRadius: '14px',
                    border: active
                      ? '3px solid var(--accent)'
                      : pid && tc
                        ? '2px solid rgba(0,0,0,0.18)'
                        : '0.5px solid var(--border)',
                    background: pid ? tc || 'var(--btn-primary-bg)' : 'var(--bg-elevated)',
                    color: pid ? (tc ? contrastTextOnColor(tc) : 'var(--btn-primary-text)') : 'var(--text-muted)',
                    fontSize: pid ? '22px' : '20px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {pid ? jerseyLabel(p) : '+'}
                </button>
                {pid ? (
                  <button
                    type="button"
                    onClick={() => void setSlot(side, index, null)}
                    style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: '#dc2626',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      padding: '2px 0',
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
        {roster.length > 0 ? (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>
              BENCH · tap incoming jersey, then on-court number to sub
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {roster
                .filter((p) => !used.has(p.id))
                .map((p) => {
                  const active = pendingAction !== null
                  const isSubSelected = !pendingAction && pendingSub && pendingSub.side === side && pendingSub.benchId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        if (pendingAction) {
                          void recordForPlayer(p.id)
                        } else {
                          setPendingSub((prev) => {
                            if (prev && prev.side === side && prev.benchId === p.id) return null
                            return { side, benchId: p.id }
                          })
                        }
                      }}
                      style={{
                        minWidth: '44px',
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: isSubSelected || active
                          ? '2px solid var(--accent)'
                          : tc
                            ? '2px solid rgba(0,0,0,0.18)'
                            : '0.5px solid var(--border)',
                        background: tc
                          ? tc
                          : isSubSelected || active
                            ? 'var(--accent-muted)'
                            : 'var(--bg-surface)',
                        color: tc ? contrastTextOnColor(tc) : 'var(--text-primary)',
                        fontSize: '15px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {jerseyLabel(p)}
                    </button>
                  )
                })}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '920px' }}>
      <button
        onClick={() => router.push('/dashboard/games')}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: '16px',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        ← Back to Games
      </button>

      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {game.location && `${game.location} · `}
            {game.scheduled_at &&
              new Date(game.scheduled_at).toLocaleDateString('en-CA', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span
              style={{
                background: game.status === 'live' ? '#fef2f2' : '#f0fdf4',
                color: game.status === 'live' ? '#dc2626' : '#16a34a',
                border: `0.5px solid ${game.status === 'live' ? '#fecaca' : '#bbf7d0'}`,
                borderRadius: '99px',
                fontSize: '11px',
                fontWeight: '700',
                padding: '3px 10px',
              }}
            >
              {game.status === 'live' ? 'Live' : 'Final'}
            </span>
            {game.status === 'live' && (
              <button
                onClick={endGame}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                End Game
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            {homeTeam?.color ? (
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  background: homeTeam.color,
                  display: 'inline-block',
                  marginBottom: '4px',
                }}
              />
            ) : null}
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
              {homeTeam?.name || 'Home'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Home</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <div
                style={{
                  borderRadius: '10px',
                  padding: '8px 20px',
                  fontSize: '36px',
                  fontWeight: '800',
                  fontFamily: 'monospace',
                  minWidth: '72px',
                  textAlign: 'center',
                  ...homeScoreChip,
                }}
              >
                {game.home_score}
              </div>
              <span style={{ fontSize: '20px', color: 'var(--text-muted)', fontWeight: '300' }}>—</span>
              <div
                style={{
                  borderRadius: '10px',
                  padding: '8px 20px',
                  fontSize: '36px',
                  fontWeight: '800',
                  fontFamily: 'monospace',
                  minWidth: '72px',
                  textAlign: 'center',
                  ...awayScoreChip,
                }}
              >
                {game.away_score}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
                marginTop: '10px',
                flexWrap: 'wrap',
              }}
            >
              <select
                value={period}
                onChange={(e) => setPeriod(parseInt(e.target.value, 10))}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '0.5px solid var(--border)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {[1, 2, 3, 4].map((p) => (
                  <option key={p} value={p}>
                    Q{p}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={clock}
                onChange={(e) => setClock(e.target.value)}
                placeholder="10:00"
                style={{
                  width: '70px',
                  background: 'var(--bg-elevated)',
                  border: '0.5px solid var(--border)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: clockRunning ? 'var(--accent)' : 'var(--text-primary)',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  transition: 'color 0.15s',
                }}
              />
              <button
                onClick={startClock}
                style={{
                  background: clockRunning ? '#fef2f2' : 'var(--accent-muted)',
                  color: clockRunning ? '#dc2626' : 'var(--accent)',
                  border: `0.5px solid ${clockRunning ? '#fecaca' : 'var(--accent)'}`,
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {clockRunning ? 'Pause' : 'Start'}
              </button>
            </div>
            <div
              style={{
                marginTop: '8px',
                fontSize: '10px',
                color: 'var(--text-muted)',
                lineHeight: 1.35,
                maxWidth: '340px',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              Quarter and clock sync to the server automatically (including while the timer runs). Pause flushes immediately.
            </div>
          </div>

          <div style={{ textAlign: 'left' }}>
            {awayTeam?.color ? (
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  background: awayTeam.color,
                  display: 'inline-block',
                  marginBottom: '4px',
                }}
              />
            ) : null}
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
              {awayTeam?.name || 'Away'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Away</div>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: '16px',
          padding: '18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
        }}
      >
        <LineupColumn
          side="home"
          label={homeTeam?.name || 'Home'}
          teamColor={homeTeam?.color || null}
          slots={homeSlots}
          roster={homeRoster}
        />
        <LineupColumn
          side="away"
          label={awayTeam?.name || 'Away'}
          teamColor={awayTeam?.color || null}
          slots={awaySlots}
          roster={awayRoster}
        />
      </div>

      <div
        className="card"
        style={{
          marginBottom: '16px',
          padding: '12px 16px',
          background: 'var(--bg-elevated)',
          border: '0.5px solid var(--border)',
          borderRadius: '12px',
        }}
      >
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Minutes played</strong> accrue for whoever is in the five starter slots whenever the game clock is moving. They update when you substitute, when the clock syncs, and when you end the game — keep the quarter and clock accurate for best results.
        </p>
      </div>

      {slotPick ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSlotPick(null)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: '16px',
              border: '0.5px solid var(--border)',
              padding: '16px',
              width: '100%',
              maxWidth: '420px',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '12px' }}>
              Slot {slotPick.index + 1} · {slotPick.side === 'home' ? homeTeam?.name : awayTeam?.name}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(slotPick.side === 'home' ? homeRoster : awayRoster).map((p) => {
                const u = usedIds(slotPick.side)
                if (u.has(p.id)) return null
                const stripe =
                  slotPick.side === 'home' ? homeTeam?.color?.trim() || null : awayTeam?.color?.trim() || null
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void setSlot(slotPick.side, slotPick.index, p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '0.5px solid var(--border)',
                      borderLeft: stripe ? `6px solid ${stripe}` : undefined,
                      background: 'var(--bg-elevated)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '18px', fontWeight: '800' }}>{jerseyLabel(p)}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{p.full_name}</span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="btn-s"
              style={{ marginTop: '12px', width: '100%' }}
              onClick={() => setSlotPick(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="card"
        style={{
          marginBottom: '20px',
          padding: '14px',
          border: pendingAction ? '2px solid var(--accent)' : '0.5px solid var(--border)',
          position: 'sticky',
          bottom: '12px',
          zIndex: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Tap a <strong>STAT</strong>, then choose a jersey from players on court.
          </div>
          <button
            type="button"
            onClick={() => void undoLast()}
            disabled={undoStack.length === 0 || saving !== null}
            style={{
              background: undoStack.length > 0 ? '#fef2f2' : 'var(--bg-elevated)',
              color: undoStack.length > 0 ? '#dc2626' : 'var(--text-muted)',
              border: `0.5px solid ${undoStack.length > 0 ? '#fecaca' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: undoStack.length > 0 ? 'pointer' : 'default',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            Undo
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
          {STAT_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => setPendingAction(action.key)}
              disabled={saving !== null}
              style={{
                minHeight: '46px',
                borderRadius: '10px',
                border: pendingAction === action.key ? '2px solid var(--accent)' : '0.5px solid var(--border)',
                background: pendingAction === action.key ? 'var(--accent-muted)' : 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '15px',
                fontWeight: '800',
                cursor: 'pointer',
                fontFamily: 'inherit',
                ...action.buttonStyle,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '8px' }}>
          {undoStack.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Next undos (newest first):</span>
              {undoStack.slice(0, 3).map((e, i) => (
                <span
                  key={`${e.label}-${i}`}
                  style={{
                    fontSize: '10px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-elevated)',
                    border: '0.5px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {e.label}
                </span>
              ))}
              {undoStack.length > 3 ? (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{undoStack.length - 3} more</span>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No actions yet</div>
          )}
        </div>
      </div>

      {pendingAction ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPendingAction(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: '16px',
              border: '0.5px solid var(--border)',
              padding: '16px',
              width: '100%',
              maxWidth: '460px',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '14px', fontWeight: '800', marginBottom: '10px' }}>
              {pendingActionDef?.label || pendingAction} · Who made this stat?
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
              On-court jerseys only
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px' }}>
              {onCourtPlayers.map((p) => {
                const tc = teams.find((t) => t.id === p.team_id)?.color?.trim() || null
                const bg = tc || 'var(--btn-primary-bg)'
                const fg = tc ? contrastTextOnColor(tc) : 'var(--btn-primary-text)'
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void recordForPlayer(p.id)}
                    title={p.team_id === game.home_team_id ? homeTeam?.name : awayTeam?.name}
                    style={{
                      minHeight: '56px',
                      borderRadius: '12px',
                      border: tc ? `2px solid rgba(0,0,0,0.18)` : '0.5px solid var(--border)',
                      background: bg,
                      color: fg,
                      fontSize: '21px',
                      fontWeight: '900',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {jerseyLabel(p)}
                  </button>
                )
              })}
            </div>
            {onCourtPlayers.length === 0 ? (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                No starters selected yet. Set the 5 on each side first.
              </div>
            ) : null}
            <button
              type="button"
              className="btn-s"
              style={{ width: '100%', marginTop: '12px' }}
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {showHighlights && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHighlights(false)
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '0.5px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>Game Summary</div>
              <button type="button" onClick={() => setShowHighlights(false)} className="modal-close" aria-label="Close">
                ×
              </button>
            </div>
            <GameHighlights
              stats={Object.entries(stats).map(([pid, s]) => {
                const player = players.find((p) => p.id === pid)
                const team = teams.find((t) => t.id === player?.team_id)
                const { player_id: _rowPid, fg2m, fg3m, ftm, ...rest } = s
                void _rowPid
                void fg2m
                void fg3m
                void ftm
                return {
                  player_id: pid,
                  full_name: player?.full_name || 'Unknown',
                  jersey_number: player?.jersey_number || null,
                  team_name: team?.name || null,
                  team_color: team?.color || null,
                  ...rest,
                }
              })}
              homeTeamName={homeTeam?.name || 'Home'}
              awayTeamName={awayTeam?.name || 'Away'}
              homeScore={game.home_score}
              awayScore={game.away_score}
              onClose={() => {
                setShowHighlights(false)
                router.push('/dashboard/games')
              }}
            />
          </div>
        </div>
      )}

      {game.status === 'final' && !showHighlights && (
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setShowHighlights(true)}
            className="btn-primary"
            style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Trophy size={16} strokeWidth={2} aria-hidden />
            View game highlights
          </button>
        </div>
      )}

      <div
        style={{
          marginTop: '16px',
          padding: '12px 16px',
          background: 'var(--bg-elevated)',
          border: '0.5px solid var(--border)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Public watch link</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '520px', lineHeight: 1.45, marginBottom: '8px' }}>
            {orgSlug
              ? 'League Stream tab with this game’s full box score (and optional video when a stream URL is set). Fans see dashboard scoring updates here in real time.'
              : 'Legacy link to this game’s box score until your league slug is set (then use the league URL below).'}
          </div>
          <a
            href={publicWatchUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              fontSize: '12px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontWeight: '600',
              color: 'var(--accent)',
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}
          >
            {publicWatchUrl}
          </a>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(publicWatchUrl)
          }}
          className="btn-s"
          style={{ fontSize: '11px', padding: '6px 12px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Link2 size={14} strokeWidth={2} aria-hidden />
          Copy link
        </button>
      </div>
    </div>
  )
}
