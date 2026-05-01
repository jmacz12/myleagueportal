'use client'

import { useState, useEffect } from 'react'

interface Player {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  jersey_number: number | null
  position: string | null
  status: string
  team_id: string | null
  season_id: string
  registered_at: string
}

interface Team { id: string; name: string; color: string | null; season_id: string }
interface Season { id: string; name: string }

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [playersRes, teamsRes, seasonsRes] = await Promise.all([
      fetch('/api/players'), fetch('/api/teams'), fetch('/api/seasons')
    ])
    const [pd, td, sd] = await Promise.all([playersRes.json(), teamsRes.json(), seasonsRes.json()])
    setPlayers(pd.players || [])
    setTeams(td.teams || [])
    setSeasons(sd.seasons || [])
    setLoading(false)
  }

  async function deletePlayer(playerId: string) {
    if (!confirm('Remove this player from the roster?')) return
    setDeletingId(playerId)
    await fetch('/api/players', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }),
    })
    setDeletingId(null)
    fetchData()
  }

  async function assignTeam(playerId: string, teamId: string | null) {
    setAssigningId(playerId)
    await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, team_id: teamId }),
    })
    setAssigningId(null)
    fetchData()
  }

  const filteredPlayers = players.filter(p => {
    const seasonMatch = selectedSeason === 'all' || p.season_id === selectedSeason
    const teamMatch = selectedTeam === 'all'
      || (selectedTeam === 'unassigned' && !p.team_id)
      || p.team_id === selectedTeam
    return seasonMatch && teamMatch
  })

  const teamsForFilter = selectedSeason === 'all' ? teams : teams.filter(t => t.season_id === selectedSeason)
  const getSeasonTeams = (seasonId: string) => teams.filter(t => t.season_id === seasonId)

  return (
    <div style={{ maxWidth: '960px' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Players</h1>
          <p className="page-subtitle">
            {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
            {selectedSeason !== 'all' || selectedTeam !== 'all' ? ' (filtered)' : ' total'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card-sm" style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label className="label">Season</label>
          <select
            value={selectedSeason}
            onChange={(e) => { setSelectedSeason(e.target.value); setSelectedTeam('all') }}
            className="input" style={{ marginTop: '4px' }}
          >
            <option value="all">All Seasons</option>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label className="label">Team</label>
          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}
            className="input" style={{ marginTop: '4px' }}>
            <option value="all">All Teams</option>
            <option value="unassigned">⚠️ Unassigned</option>
            {teamsForFilter.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Players Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading players...</div>
      ) : filteredPlayers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◉</div>
          <div className="empty-state-title">No players found</div>
          <div className="empty-state-desc">Players appear here once they register through your public link.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>

          {/* Table Header */}
          <div className="table-header" style={{
            display: 'grid',
            gridTemplateColumns: '3fr 2fr 1fr 1fr 3fr 1fr',
            gap: '8px',
          }}>
            <span>Player</span>
            <span>Contact</span>
            <span style={{ textAlign: 'center' }}>#</span>
            <span style={{ textAlign: 'center' }}>Pos</span>
            <span>Team</span>
            <span></span>
          </div>

          {/* Rows */}
          <div>
            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                className="table-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '3fr 2fr 1fr 1fr 3fr 1fr',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {player.full_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(player.registered_at).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ overflow: 'hidden' }}>
                  {player.email && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {player.email}
                    </div>
                  )}
                  {player.phone && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{player.phone}</div>
                  )}
                  {!player.email && !player.phone && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>
                  )}
                </div>

                <div style={{ textAlign: 'center' }}>
                  {player.jersey_number !== null ? (
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px' }}>
                      #{player.jersey_number}
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>

                <div style={{ textAlign: 'center' }}>
                  {player.position ? (
                    <span style={{
                      background: 'var(--accent-muted)',
                      color: 'var(--accent-text)',
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}>
                      {player.position}
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>

                <div>
                  <select
                    value={player.team_id || ''}
                    onChange={(e) => assignTeam(player.id, e.target.value || null)}
                    disabled={assigningId === player.id}
                    className="input"
                    style={{
                      fontSize: '12px',
                      padding: '5px 10px',
                      background: !player.team_id ? '#fffbeb' : 'var(--input-bg)',
                      borderColor: !player.team_id ? '#fde68a' : 'var(--border)',
                      color: !player.team_id ? '#92400e' : 'var(--text-primary)',
                    }}
                  >
                    <option value="">⚠️ Unassigned</option>
                    {getSeasonTeams(player.season_id).map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => deletePlayer(player.id)}
                    disabled={deletingId === player.id}
                    className="btn-danger"
                    style={{ fontSize: '11px', padding: '5px 10px' }}
                  >
                    {deletingId === player.id ? '...' : 'Remove'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}