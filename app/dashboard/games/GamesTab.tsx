'use client'

import { useState, useEffect } from 'react'
import { BarChart3, CalendarDays, Trophy } from 'lucide-react'
import AddGamesForm from './AddGamesForm'

interface Game {
  id: string
  home_team_id: string | null
  away_team_id: string | null
  scheduled_at: string | null
  location: string | null
  home_score: number
  away_score: number
  status: string
  stream_url: string | null
  season_id: string
}

interface Team { id: string; name: string; color: string | null }
interface Season { id: string; name: string }

export default function GamesTab() {
  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'live' | 'final'>('all')
  const [selectedSeason, setSelectedSeason] = useState('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [gamesRes, teamsRes, seasonsRes] = await Promise.all([
      fetch('/api/games'),
      fetch('/api/teams'),
      fetch('/api/seasons'),
    ])
    const [gd, td, sd] = await Promise.all([
      gamesRes.json(), teamsRes.json(), seasonsRes.json()
    ])
    setGames(gd.games || [])
    setTeams(td.teams || [])
    setSeasons(sd.seasons || [])
    setLoading(false)
  }

  async function deleteGame(gameId: string) {
    if (!confirm('Delete this game?')) return
    setDeletingId(gameId)
    await fetch('/api/games', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId }),
    })
    setDeletingId(null)
    fetchData()
  }

  async function updateStatus(gameId: string, status: string) {
    await fetch('/api/games', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, status }),
    })
    fetchData()
  }

  function goToScoring(gameId: string) {
    window.location.href = '/dashboard/games/' + gameId + '/scoring'
  }

  const getTeam = (id: string | null) => teams.find(t => t.id === id)

  const filtered = games.filter(g => {
    const statusMatch = filter === 'all' || g.status === filter
    const seasonMatch = selectedSeason === 'all' || g.season_id === selectedSeason
    return statusMatch && seasonMatch
  })

  const grouped = filtered.reduce((acc, game) => {
    const date = game.scheduled_at
      ? new Date(game.scheduled_at).toLocaleDateString('en-CA', {
          weekday: 'long', month: 'long', day: 'numeric'
        })
      : 'No Date Set'
    if (!acc[date]) acc[date] = []
    acc[date].push(game)
    return acc
  }, {} as Record<string, Game[]>)

  const statusStyle = (status: string) => {
    if (status === 'live') return { background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca' }
    if (status === 'final') return { background: '#f0fdf4', color: '#16a34a', border: '0.5px solid #bbf7d0' }
    return { background: '#fffbeb', color: '#92400e', border: '0.5px solid #fde68a' }
  }

  const statusLabel = (status: string) => {
    if (status === 'live') return 'Live'
    if (status === 'final') return 'Final'
    return 'Scheduled'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {games.length} game{games.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            + Add Games
          </button>
        </div>
      </div>

      {showForm && (
        <AddGamesForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchData() }}
        />
      )}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {(['all', 'scheduled', 'live', 'final'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 14px',
              borderRadius: '99px',
              fontSize: '12px',
              fontWeight: '600',
              border: filter === f ? '1.5px solid var(--btn-primary-bg)' : '1.5px solid var(--border)',
              cursor: 'pointer',
              background: filter === f ? 'var(--btn-primary-bg)' : 'transparent',
              color: filter === f ? 'var(--btn-primary-text)' : 'var(--text-primary)',
              fontFamily: 'inherit',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
        <select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          className="input"
          style={{ width: 'auto', padding: '5px 12px', fontSize: '12px', marginLeft: '8px' }}
        >
          <option value="all">All Seasons</option>
          {seasons.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading games...
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CalendarDays size={32} strokeWidth={1.5} /></div>
          <div className="empty-state-title">No games yet</div>
          <div className="empty-state-desc">Click "+ Add Games" to schedule your first game.</div>
        </div>
      ) : (
        Object.entries(grouped).map(([date, dateGames]) => (
          <div key={date} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {date}
              </span>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dateGames.map((game) => {
                const homeTeam = getTeam(game.home_team_id)
                const awayTeam = getTeam(game.away_team_id)
                const time = game.scheduled_at
                  ? new Date(game.scheduled_at).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })
                  : ''

                return (
                  <div
                    key={game.id}
                    className="card-sm"
                    style={{
                      borderColor: game.status === 'live' ? '#fecaca' : game.status === 'final' ? '#bbf7d0' : 'var(--border)',
                      background: game.status === 'live' ? '#fff9f9' : 'var(--bg-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                        <span style={{
                          ...statusStyle(game.status),
                          borderRadius: '99px', fontSize: '10px', fontWeight: '700',
                          padding: '2px 8px', display: 'inline-block', textAlign: 'center',
                        }}>
                          {statusLabel(game.status)}
                        </span>
                        {time && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            {time}
                          </span>
                        )}
                        {game.location && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                            {game.location}
                          </span>
                        )}
                      </div>

                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', minWidth: '200px' }}>
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {homeTeam?.color && (
                              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: homeTeam.color, flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {homeTeam?.name || 'TBD'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          {game.status !== 'scheduled' ? (
                            <>
                              <div style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', borderRadius: '6px', padding: '4px 10px', fontSize: '16px', fontWeight: '800', fontFamily: 'monospace', minWidth: '36px', textAlign: 'center' }}>
                                {game.home_score}
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>—</span>
                              <div style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', borderRadius: '6px', padding: '4px 10px', fontSize: '16px', fontWeight: '800', fontFamily: 'monospace', minWidth: '36px', textAlign: 'center' }}>
                                {game.away_score}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderRadius: '6px', padding: '4px 10px', fontSize: '14px', fontWeight: '800', minWidth: '36px', textAlign: 'center' }}>—</div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>vs</span>
                              <div style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderRadius: '6px', padding: '4px 10px', fontSize: '14px', fontWeight: '800', minWidth: '36px', textAlign: 'center' }}>—</div>
                            </>
                          )}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {awayTeam?.color && (
                              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: awayTeam.color, flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {awayTeam?.name || 'TBD'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>

                        {game.status === 'scheduled' && (
                          <button
                            onClick={() => updateStatus(game.id, 'live')}
                            style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Start Live
                          </button>
                        )}

                        {game.status === 'live' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => goToScoring(game.id)}
                              style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <BarChart3 size={14} strokeWidth={2} aria-hidden />
                              Score
                            </button>
                            <button
                              onClick={() => updateStatus(game.id, 'final')}
                              style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              End Game
                            </button>
                          </div>
                        )}

                        {game.status === 'final' && (
                          <button
                            onClick={() => goToScoring(game.id)}
                            style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Trophy size={14} strokeWidth={2} aria-hidden />
                            Highlights
                          </button>
                        )}

                        <button
                          onClick={() => deleteGame(game.id)}
                          disabled={deletingId === game.id}
                          style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', opacity: deletingId === game.id ? 0.5 : 1 }}
                        >
                          {deletingId === game.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}