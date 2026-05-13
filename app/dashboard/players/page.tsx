'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

interface Player {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  jersey_number: number | null
  position?: string | null
  positions?: string[] | null
  status: string
  team_id: string | null
  season_id: string
  registered_at: string
}

interface Team {
  id: string
  name: string
  color: string | null
  season_id: string
}
interface Season {
  id: string
  name: string
}

function positionLabel(p: Player): string | null {
  if (Array.isArray(p.positions) && p.positions.length > 0) {
    return p.positions.filter(Boolean).join(', ')
  }
  if (p.position && String(p.position).trim()) return String(p.position).trim()
  return null
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [orgSlug, setOrgSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [playerSearch, setPlayerSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [pollHelpOpen, setPollHelpOpen] = useState(false)
  const [orgPlan, setOrgPlan] = useState<'basic' | 'pro' | 'enterprise'>('basic')

  useEffect(() => {
    void fetchData()
  }, [])

  async function fetchData() {
    const [playersRes, teamsRes, seasonsRes] = await Promise.all([
      fetch('/api/players'),
      fetch('/api/teams'),
      fetch('/api/seasons'),
    ])
    const [pd, td, sd] = await Promise.all([playersRes.json(), teamsRes.json(), seasonsRes.json()])
    setPlayers(pd.players || [])
    setTeams(td.teams || [])
    setOrgSlug(typeof td.org_slug === 'string' ? td.org_slug : '')
    const pr = String(td.org_plan || 'basic').toLowerCase()
    setOrgPlan(pr === 'enterprise' ? 'enterprise' : pr === 'pro' ? 'pro' : 'basic')
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
    void fetchData()
  }

  async function assignTeam(playerId: string, teamId: string | null) {
    setAssigningId(playerId)
    await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, team_id: teamId }),
    })
    setAssigningId(null)
    void fetchData()
  }

  async function updateJersey(playerId: string, current: number | null, el: HTMLInputElement) {
    const raw = el.value
    const n = raw === '' ? null : parseInt(raw, 10)
    if (n !== null && (Number.isNaN(n) || n < 0 || n > 99)) {
      alert('Jersey number must be between 0 and 99.')
      el.value = current === null ? '' : String(current)
      return
    }
    if ((n === null && current === null) || n === current) return
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, jersey_number: n }),
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Could not update jersey number.')
      el.value = current === null ? '' : String(current)
      return
    }
    void fetchData()
  }

  const q = playerSearch.trim().toLowerCase()
  const filteredPlayers = players.filter((p) => {
    const seasonMatch = selectedSeason === 'all' || p.season_id === selectedSeason
    const teamMatch =
      selectedTeam === 'all' ||
      (selectedTeam === 'unassigned' && !p.team_id) ||
      p.team_id === selectedTeam
    const searchMatch =
      !q ||
      p.full_name.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    return seasonMatch && teamMatch && searchMatch
  })

  const teamsForFilter = selectedSeason === 'all' ? teams : teams.filter((t) => t.season_id === selectedSeason)
  const getSeasonTeams = (seasonId: string) => teams.filter((t) => t.season_id === seasonId)

  const teamsForPollModal =
    selectedSeason === 'all' ? teams : teams.filter((t) => t.season_id === selectedSeason)

  return (
    <div style={{ maxWidth: '960px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Players</h1>
          <p className="page-subtitle">
            {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
            {selectedSeason !== 'all' || selectedTeam !== 'all' || q ? ' (filtered)' : ' total'}
          </p>
        </div>
        <button type="button" className="btn-secondary" style={{ fontSize: '12px', fontWeight: 700 }} onClick={() => setPollHelpOpen(true)}>
          Jersey polls
        </button>
      </div>

      <div className="card-sm" style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 200px' }}>
          <label className="label">Search</label>
          <input
            type="search"
            className="input"
            style={{ marginTop: '4px' }}
            placeholder="Name, email, or phone"
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label className="label">Season</label>
          <select
            value={selectedSeason}
            onChange={(e) => {
              setSelectedSeason(e.target.value)
              setSelectedTeam('all')
            }}
            className="input"
            style={{ marginTop: '4px' }}
          >
            <option value="all">All Seasons</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label className="label">Team</label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="input"
            style={{ marginTop: '4px' }}
          >
            <option value="all">All Teams</option>
            <option value="unassigned">Unassigned</option>
            {teamsForFilter.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading players...</div>
      ) : filteredPlayers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◉</div>
          <div className="empty-state-title">No players found</div>
          <div className="empty-state-desc">
            {players.length === 0
              ? 'Players appear here once they register through your public link.'
              : 'Try adjusting search or filters.'}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <div
            className="table-header"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 2.2fr) minmax(100px, 1.6fr) 56px 72px minmax(120px, 1.8fr) 72px',
              gap: '8px',
            }}
          >
            <span>Player</span>
            <span>Contact</span>
            <span style={{ textAlign: 'center' }} title="Assigned jersey (organizer)">
              #
            </span>
            <span style={{ textAlign: 'center' }}>Pos</span>
            <span>Team</span>
            <span />
          </div>

          <div>
            {filteredPlayers.map((player) => {
              const pos = positionLabel(player)
              return (
                <div
                  key={player.id}
                  className="table-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px, 2.2fr) minmax(100px, 1.6fr) 56px 72px minmax(120px, 1.8fr) 72px',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {player.full_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(player.registered_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ overflow: 'hidden', minWidth: 0 }}>
                    {player.email && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {player.email}
                      </div>
                    )}
                    {player.phone && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{player.phone}</div>}
                    {!player.email && !player.phone && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      title="Jersey # — must be unique per season"
                      aria-label={`Jersey number for ${player.full_name}`}
                      defaultValue={player.jersey_number ?? ''}
                      key={`${player.id}-${player.jersey_number ?? 'x'}`}
                      onBlur={(e) => {
                        void updateJersey(player.id, player.jersey_number, e.currentTarget)
                      }}
                      className="input"
                      style={{
                        width: '52px',
                        textAlign: 'center',
                        fontSize: '12px',
                        padding: '5px 6px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    />
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    {pos ? (
                      <span
                        style={{
                          background: 'var(--accent-muted)',
                          color: 'var(--accent-text)',
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={pos}
                      >
                        {pos}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <select
                      value={player.team_id || ''}
                      onChange={(e) => assignTeam(player.id, e.target.value || null)}
                      disabled={assigningId === player.id}
                      className="input"
                      style={{
                        fontSize: '12px',
                        padding: '5px 10px',
                        width: '100%',
                        maxWidth: '100%',
                        background: !player.team_id ? '#fffbeb' : 'var(--input-bg)',
                        borderColor: !player.team_id ? '#fde68a' : 'var(--border)',
                        color: !player.team_id ? '#92400e' : 'var(--text-primary)',
                      }}
                    >
                      <option value="">Unassigned</option>
                      {getSeasonTeams(player.season_id).map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
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
              )
            })}
          </div>
        </div>
      )}

      {pollHelpOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="poll-help-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setPollHelpOpen(false)}
        >
          <div className="card" style={{ maxWidth: '440px', width: '100%', maxHeight: '88vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 id="poll-help-title" style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              Jersey number polls
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
              <strong>Pro and Enterprise.</strong> Open a poll from <strong>Dashboard → Teams</strong>. Players pick on the public team page while signed in; <strong>first save wins</strong> on each number. You see the full roster with who has not picked yet.
            </p>
            {orgPlan === 'basic' ? (
              <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: '0 0 14px', lineHeight: 1.5, padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)' }}>
                Your league is on <strong>Basic</strong>. Upgrade under{' '}
                <Link href="/dashboard/settings" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                  Dashboard → Settings
                </Link>{' '}
                to use jersey polls.
              </p>
            ) : null}
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Where to open the poll</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.45 }}>
              Open <strong>Dashboard → Teams</strong>, or go to each team&apos;s public page, sign in as owner or staff, and use <strong>Manage team</strong> →{' '}
              <strong>Logo &amp; poll</strong>. Players see an entry on the team page <strong>Overview</strong> tab when a poll is open.
            </p>
            {orgSlug && teamsForPollModal.length > 0 ? (
              <ul style={{ margin: '0 0 16px', paddingLeft: '18px', fontSize: '13px', color: 'var(--text-primary)' }}>
                {teamsForPollModal.map((t) => (
                  <li key={t.id} style={{ marginBottom: '6px' }}>
                    <Link href={`/league/${orgSlug}/teams/${t.id}?manage=1&panel=jersey`} style={{ color: 'var(--accent)', fontWeight: 700 }}>
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Create teams first, then use the links above from each public page.</p>
            )}
            <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={() => setPollHelpOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
