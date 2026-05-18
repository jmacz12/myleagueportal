'use client'

import Link from 'next/link'
import { DashboardPlanLockedHint } from '@/components/dashboard/DashboardPlanLockedHint'
import { useState, useEffect } from 'react'
import { DashboardHelpLauncher } from '@/components/dashboard/DashboardHelpLauncher'

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
  game_reminders_opt_out?: boolean
  fan_email_registration_opens_opt_out?: boolean
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
  const [loading, setLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [playerSearch, setPlayerSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [fanAlertsAvailable, setFanAlertsAvailable] = useState(false)
  const [gameEmailRemindersEnabled, setGameEmailRemindersEnabled] = useState(true)
  const [registrationOpensEnabled, setRegistrationOpensEnabled] = useState(true)
  const [reminderToggleId, setReminderToggleId] = useState<string | null>(null)
  const [registrationToggleId, setRegistrationToggleId] = useState<string | null>(null)

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
    setFanAlertsAvailable(pd.fan_alerts_available === true || pd.game_reminders_available === true)
    setGameEmailRemindersEnabled(pd.game_email_reminders_enabled !== false)
    setRegistrationOpensEnabled(pd.fan_email_registration_opens_enabled !== false)
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

  async function updateGameReminders(playerId: string, optOut: boolean) {
    setReminderToggleId(playerId)
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, game_reminders_opt_out: optOut }),
    })
    const data = await res.json()
    setReminderToggleId(null)
    if (!res.ok) {
      alert(data.error || 'Could not update reminder preference.')
      return
    }
    void fetchData()
  }

  async function updateRegistrationOpens(playerId: string, optOut: boolean) {
    setRegistrationToggleId(playerId)
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: playerId,
        fan_email_registration_opens_opt_out: optOut,
      }),
    })
    const data = await res.json()
    setRegistrationToggleId(null)
    if (!res.ok) {
      alert(data.error || 'Could not update registration alert preference.')
      return
    }
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

  return (
    <div style={{ maxWidth: '960px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Players</h1>
          <p className="page-subtitle">
            {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
            {selectedSeason !== 'all' || selectedTeam !== 'all' || q ? ' (filtered)' : ' total'}
            {fanAlertsAvailable ? (
              <>
                {' '}
                · Game reminder emails:{' '}
                {gameEmailRemindersEnabled ? (
                  <span>on for the league</span>
                ) : (
                  <Link href="/dashboard/settings?tab=league" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    off in Settings
                  </Link>
                )}
              </>
            ) : null}
          </p>
        </div>
        <DashboardHelpLauncher topic="players" />
      </div>

      {!fanAlertsAvailable ? (
        <div style={{ marginBottom: '16px' }}>
          <DashboardPlanLockedHint feature="set per-player fan email preferences (game reminders and registration opens)" />
        </div>
      ) : null}

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
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.email}</span>
                        {fanAlertsAvailable && player.game_reminders_opt_out && player.email ? (
                          <span
                            style={{
                              flexShrink: 0,
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#92400e',
                              background: '#fffbeb',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            Reminders off
                          </span>
                        ) : null}
                      </div>
                    )}
                    {player.phone && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{player.phone}</div>}
                    {player.email ? (
                      <div style={{ marginTop: '5px', opacity: fanAlertsAvailable ? 1 : 0.65 }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            cursor:
                              fanAlertsAvailable &&
                              gameEmailRemindersEnabled &&
                              reminderToggleId !== player.id
                                ? 'pointer'
                                : 'not-allowed',
                          }}
                          title={
                            !fanAlertsAvailable
                              ? 'Pro or Enterprise — compare plans under Settings → Plan'
                              : !gameEmailRemindersEnabled
                                ? 'Turn on game reminder emails under Dashboard → Settings → League & appearance'
                                : 'Send automated email ~24 hours before scheduled league games'
                          }
                        >
                          <input
                            type="checkbox"
                            checked={player.game_reminders_opt_out !== true}
                            disabled={
                              !fanAlertsAvailable ||
                              !gameEmailRemindersEnabled ||
                              reminderToggleId === player.id
                            }
                            onChange={(e) => void updateGameReminders(player.id, !e.target.checked)}
                            style={{ margin: 0, accentColor: 'var(--accent)' }}
                          />
                          <span>Game reminder emails</span>
                        </label>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '4px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            cursor:
                              fanAlertsAvailable &&
                              registrationOpensEnabled &&
                              registrationToggleId !== player.id
                                ? 'pointer'
                                : 'not-allowed',
                          }}
                          title={
                            !fanAlertsAvailable
                              ? 'Pro or Enterprise — compare plans under Settings → Plan'
                              : !registrationOpensEnabled
                                ? 'Turn on registration-opens emails under Dashboard → Settings → League & appearance'
                                : 'Email when season online registration opens'
                          }
                        >
                          <input
                            type="checkbox"
                            checked={player.fan_email_registration_opens_opt_out !== true}
                            disabled={
                              !fanAlertsAvailable ||
                              !registrationOpensEnabled ||
                              registrationToggleId === player.id
                            }
                            onChange={(e) => void updateRegistrationOpens(player.id, !e.target.checked)}
                            style={{ margin: 0, accentColor: 'var(--accent)' }}
                          />
                          <span>Registration opens emails</span>
                        </label>
                      </div>
                    ) : null}
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

    </div>
  )
}
