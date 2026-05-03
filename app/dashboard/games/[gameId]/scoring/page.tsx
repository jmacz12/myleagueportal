'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import GameHighlights from '../../GameHighlights'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
  ast: number
  reb: number
  stl: number
  blk: number
  tov: number
  pf: number
}

const STAT_KEYS = ['pts', 'ast', 'reb', 'stl', 'blk', 'tov', 'pf'] as const
type StatKey = typeof STAT_KEYS[number]

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
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home')
  const [clock, setClock] = useState('10:00')
  const [period, setPeriod] = useState(1)
  const [clockRunning, setClockRunning] = useState(false)
  const clockRef = useRef<NodeJS.Timeout | null>(null)
  const [showHighlights, setShowHighlights] = useState(false)

  const fetchData = useCallback(async () => {
    const [gameRes, teamsRes, playersRes, statsRes] = await Promise.all([
      fetch(`/api/games/${gameId}`),
      fetch('/api/teams'),
      fetch('/api/players'),
      fetch(`/api/games/${gameId}/stats`),
    ])

    const [gameData, teamsData, playersData, statsData] = await Promise.all([
      gameRes.json(), teamsRes.json(), playersRes.json(), statsRes.json()
    ])

    setGame(gameData.game)
    setTeams(teamsData.teams || [])
    setPlayers(playersData.players || [])
    setClock(gameData.game?.game_clock || '10:00')
    setPeriod(gameData.game?.period || 1)

    // Build stats map
    const statsMap: Record<string, PlayerStat> = {}
    for (const s of (statsData.stats || [])) {
      statsMap[s.player_id] = s
    }
    setStats(statsMap)
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    fetchData()

    // Supabase Realtime subscription
    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      }, () => fetchData())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'player_game_stats',
        filter: `game_id=eq.${gameId}`,
      }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [gameId, fetchData])

  async function adjustStat(playerId: string, stat: StatKey, delta: number) {
    const current = stats[playerId] || { player_id: playerId, pts: 0, ast: 0, reb: 0, stl: 0, blk: 0, tov: 0, pf: 0 }
    const newVal = Math.max(0, (current[stat] || 0) + delta)
    const updated = { ...current, [stat]: newVal }

    // Optimistic update
    setStats(prev => ({ ...prev, [playerId]: updated }))

    // Recalculate team scores from PTS
    const player = players.find(p => p.id === playerId)
    if (player && game) {
      const homePlayers = players.filter(p => p.team_id === game.home_team_id)
      const awayPlayers = players.filter(p => p.team_id === game.away_team_id)

      const newStats = { ...stats, [playerId]: updated }
      const homeScore = homePlayers.reduce((sum, p) => sum + (newStats[p.id]?.pts || 0), 0)
      const awayScore = awayPlayers.reduce((sum, p) => sum + (newStats[p.id]?.pts || 0), 0)

      setGame(g => g ? { ...g, home_score: homeScore, away_score: awayScore } : g)
    }

    setSaving(playerId)
    await fetch(`/api/games/${gameId}/stats`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, stat, value: newVal }),
    })
    setSaving(null)
  }

  // Convert mm:ss to seconds
  function clockToSeconds(c: string) {
    const [m, s] = c.split(':').map(Number)
    return (m || 0) * 60 + (s || 0)
  }

  // Convert seconds to mm:ss
  function secondsToClock(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  function startClock() {
    if (clockRunning) {
      // Pause
      if (clockRef.current) clearInterval(clockRef.current)
      setClockRunning(false)
      return
    }
    // Start
    setClockRunning(true)
    clockRef.current = setInterval(() => {
      setClock(prev => {
        const secs = clockToSeconds(prev)
        if (secs <= 0) {
          clearInterval(clockRef.current!)
          setClockRunning(false)
          return '0:00'
        }
        return secondsToClock(secs - 1)
      })
    }, 1000)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (clockRef.current) clearInterval(clockRef.current) }
  }, [])

  async function updateClock() {
    await fetch(`/api/games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_clock: clock, period }),
    })
  }

  async function endGame() {
    if (!confirm('End this game? Scores will be finalized.')) return
    if (clockRef.current) clearInterval(clockRef.current)
    setClockRunning(false)
    await fetch('/api/games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, status: 'final' }),
    })
    await fetchData()
    setShowHighlights(true)
  }

  const getTeam = (id: string | null) => teams.find(t => t.id === id)
  const homeTeam = getTeam(game?.home_team_id || null)
  const awayTeam = getTeam(game?.away_team_id || null)

  const activeTeamId = activeTeam === 'home' ? game?.home_team_id : game?.away_team_id
  const activePlayers = players.filter(p => p.team_id === activeTeamId)

  const statLabels: Record<StatKey, string> = {
    pts: 'PTS', ast: 'AST', reb: 'REB',
    stl: 'STL', blk: 'BLK', tov: 'TOV', pf: 'PF',
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
      Loading game...
    </div>
  )

  if (!game) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
      Game not found
    </div>
  )

  return (
    <div style={{ maxWidth: '860px' }}>

      {/* Back button */}
      <button onClick={() => router.push('/dashboard/games')}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '16px', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' }}>
        ← Back to Games
      </button>

      {/* Scoreboard header */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {game.location && `${game.location} · `}
            {game.scheduled_at && new Date(game.scheduled_at).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{
              background: game.status === 'live' ? '#fef2f2' : '#f0fdf4',
              color: game.status === 'live' ? '#dc2626' : '#16a34a',
              border: `0.5px solid ${game.status === 'live' ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: '99px', fontSize: '11px', fontWeight: '700', padding: '3px 10px',
            }}>
              {game.status === 'live' ? '● LIVE' : '✓ Final'}
            </span>
            {game.status === 'live' && (
              <button onClick={endGame}
                style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                End Game
              </button>
            )}
          </div>
        </div>

        {/* Score display */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
          {/* Home team */}
          <div style={{ textAlign: 'right' }}>
            {homeTeam?.color && (
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: homeTeam.color, display: 'inline-block', marginBottom: '4px' }} />
            )}
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
              {homeTeam?.name || 'Home'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Home</div>
          </div>

          {/* Score */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <div style={{
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                borderRadius: '10px', padding: '8px 20px',
                fontSize: '36px', fontWeight: '800', fontFamily: 'monospace', minWidth: '72px', textAlign: 'center',
              }}>
                {game.home_score}
              </div>
              <span style={{ fontSize: '20px', color: 'var(--text-muted)', fontWeight: '300' }}>—</span>
              <div style={{
                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                borderRadius: '10px', padding: '8px 20px',
                fontSize: '36px', fontWeight: '800', fontFamily: 'monospace', minWidth: '72px', textAlign: 'center',
              }}>
                {game.away_score}
              </div>
            </div>
            {/* Period + clock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
              <select value={period} onChange={(e) => setPeriod(parseInt(e.target.value))}
                style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'inherit', cursor: 'pointer' }}>
                {[1,2,3,4].map(p => <option key={p} value={p}>Q{p}</option>)}
              </select>
              <input type="text" value={clock}
                onChange={(e) => { setClock(e.target.value) }}
                placeholder="10:00"
                style={{ width: '70px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: '14px', fontWeight: '700', color: clockRunning ? 'var(--accent)' : 'var(--text-primary)', fontFamily: 'monospace', textAlign: 'center', transition: 'color 0.15s' }} />
              <button onClick={startClock}
                style={{
                  background: clockRunning ? '#fef2f2' : 'var(--accent-muted)',
                  color: clockRunning ? '#dc2626' : 'var(--accent)',
                  border: `0.5px solid ${clockRunning ? '#fecaca' : 'var(--accent)'}`,
                  borderRadius: '6px', padding: '4px 10px',
                  fontSize: '11px', fontWeight: '700',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {clockRunning ? '⏸ Pause' : '▶ Start'}
              </button>
              <button onClick={updateClock} className="btn-s" style={{ fontSize: '11px', padding: '4px 10px' }}>
                Save
              </button>
            </div>
          </div>

          {/* Away team */}
          <div style={{ textAlign: 'left' }}>
            {awayTeam?.color && (
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: awayTeam.color, display: 'inline-block', marginBottom: '4px' }} />
            )}
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
              {awayTeam?.name || 'Away'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Away</div>
          </div>
        </div>
      </div>

      {/* Team switcher */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '4px', marginBottom: '16px', width: 'fit-content' }}>
        {[
          { id: 'home', label: homeTeam?.name || 'Home', color: homeTeam?.color },
          { id: 'away', label: awayTeam?.name || 'Away', color: awayTeam?.color },
        ].map((team) => (
          <button key={team.id} onClick={() => setActiveTeam(team.id as any)}
            style={{
              padding: '8px 20px', borderRadius: '7px', fontSize: '13px', fontWeight: '600',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: activeTeam === team.id ? 'var(--btn-primary-bg)' : 'transparent',
              color: activeTeam === team.id ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
            }}>
            {team.color && (
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: team.color, flexShrink: 0 }} />
            )}
            {team.label}
          </button>
        ))}
      </div>

      {/* Stat header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr repeat(7, 48px)',
        gap: '4px',
        padding: '6px 14px',
        background: 'var(--bg-elevated)',
        borderRadius: '8px 8px 0 0',
        border: '0.5px solid var(--border)',
        borderBottom: 'none',
      }}>
        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Player</span>
        {STAT_KEYS.map(stat => (
          <span key={stat} style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', textAlign: 'center' }}>
            {statLabels[stat]}
          </span>
        ))}
      </div>

      {/* Player stat rows */}
      <div style={{ border: '0.5px solid var(--border)', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        {activePlayers.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No players on this team yet — assign players in the Players page.
          </div>
        ) : activePlayers.map((player, idx) => {
          const playerStats = stats[player.id] || { pts: 0, ast: 0, reb: 0, stl: 0, blk: 0, tov: 0, pf: 0 }
          const isSaving = saving === player.id

          return (
            <div key={player.id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr repeat(7, 48px)',
              gap: '4px',
              padding: '10px 14px',
              borderTop: idx > 0 ? '0.5px solid var(--border-light)' : 'none',
              background: isSaving ? 'var(--bg-elevated)' : 'var(--bg-surface)',
              alignItems: 'center',
              transition: 'background 0.1s',
            }}>
              {/* Player name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'var(--accent-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: '800', color: 'var(--text-primary)',
                  flexShrink: 0,
                }}>
                  {player.jersey_number ? `#${player.jersey_number}` : player.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {player.full_name}
                </span>
              </div>

              {/* Stats */}
              {STAT_KEYS.map(stat => (
                <div key={stat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <button
                    onClick={() => adjustStat(player.id, stat, 1)}
                    style={{ width: '28px', height: '20px', background: 'var(--accent-muted)', border: '0.5px solid var(--accent)', borderRadius: '4px', fontSize: '12px', fontWeight: '700', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                    +
                  </button>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1', minWidth: '20px', textAlign: 'center' }}>
                    {playerStats[stat] || 0}
                  </span>
                  <button
                    onClick={() => adjustStat(player.id, stat, -1)}
                    style={{ width: '28px', height: '20px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '4px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
                    −
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Post-game highlights modal */}
      {showHighlights && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowHighlights(false) }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '16px',
          }}
        >
          <div style={{
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--border)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '85vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Game Summary
              </div>
              <button onClick={() => setShowHighlights(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '0', fontWeight: '700' }}>×</button>
            </div>
            <GameHighlights
              stats={Object.entries(stats).map(([pid, s]) => {
                const player = players.find(p => p.id === pid)
                const team = teams.find(t => t.id === player?.team_id)
                const { player_id, ...statValues } = s
                return {
                  player_id: pid,
                  full_name: player?.full_name || 'Unknown',
                  jersey_number: player?.jersey_number || null,
                  team_name: team?.name || null,
                  team_color: team?.color || null,
                  ...statValues,
                }
              })}
              homeTeamName={homeTeam?.name || 'Home'}
              awayTeamName={awayTeam?.name || 'Away'}
              homeScore={game.home_score}
              awayScore={game.away_score}
              onClose={() => { setShowHighlights(false); router.push('/dashboard/games') }}
            />
          </div>
        </div>
      )}

      {/* View highlights button for already-final games */}
      {game.status === 'final' && !showHighlights && (
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={() => setShowHighlights(true)}
            className="btn-primary"
            style={{ fontSize: '13px' }}
          >
            🏆 View Game Highlights
          </button>
        </div>
      )}

      {/* Link to public scoreboard */}
      <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Public Scoreboard</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Share this link so fans can watch the score live</div>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/games/${gameId}/scoreboard`) }}
          className="btn-s" style={{ fontSize: '11px', padding: '6px 12px', flexShrink: 0 }}>
          📋 Copy Link
        </button>
      </div>
    </div>
  )
}