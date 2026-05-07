'use client'

import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'

interface Team {
  id: string
  name: string
  color: string | null
  season_id: string
  player_count?: number
}

interface Season {
  id: string
  name: string
  type: string
}

interface JerseyPollSummary {
  id: string
  team_id: string
  status: string
  responses: {
    id: string
    preferred_number: number
    conflict?: boolean
    player: { full_name: string; email: string | null }
  }[]
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [orgSlug, setOrgSlug] = useState('')
  const [jerseyPolls, setJerseyPolls] = useState<JerseyPollSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [form, setForm] = useState({ name: '', color: '#5a7a2a', season_id: '' })
  const [jerseyModalTeamId, setJerseyModalTeamId] = useState<string | null>(null)
  const [jerseyBusy, setJerseyBusy] = useState(false)
  const [jerseyModalError, setJerseyModalError] = useState('')
  const [copiedPollHint, setCopiedPollHint] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [teamsRes, seasonsRes, pollsRes] = await Promise.all([
      fetch('/api/teams'),
      fetch('/api/seasons'),
      fetch('/api/jersey-polls'),
    ])
    const teamsData = await teamsRes.json()
    const seasonsData = await seasonsRes.json()
    const pollsData = pollsRes.ok ? await pollsRes.json() : { polls: [] }
    setTeams(teamsData.teams || [])
    setOrgSlug(typeof teamsData.org_slug === 'string' ? teamsData.org_slug : '')
    setSeasons(seasonsData.seasons || [])
    setJerseyPolls(pollsData.polls || [])
    if (seasonsData.seasons?.length > 0) {
      setForm(f => ({ ...f, season_id: seasonsData.seasons[0].id }))
    }
    setLoading(false)
  }

  async function openJerseyPoll(teamId: string) {
    setJerseyBusy(true)
    setJerseyModalError('')
    const res = await fetch('/api/jersey-polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId }),
    })
    const data = await res.json().catch(() => ({}))
    setJerseyBusy(false)
    if (!res.ok) {
      setJerseyModalError(typeof data.error === 'string' ? data.error : 'Could not open poll.')
      return
    }
    await fetchData()
  }

  async function closeJerseyPoll(pollId: string) {
    if (!confirm('Close this poll? Players can no longer submit or change preferences.')) return
    setJerseyBusy(true)
    setJerseyModalError('')
    const res = await fetch(`/api/jersey-polls/${pollId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close' }),
    })
    const data = await res.json().catch(() => ({}))
    setJerseyBusy(false)
    if (!res.ok) {
      setJerseyModalError(typeof data.error === 'string' ? data.error : 'Could not close poll.')
      return
    }
    await fetchData()
  }

  async function copyPollUrl(pollId: string) {
    if (!orgSlug || typeof window === 'undefined') return
    const url = `${window.location.origin}/join/${orgSlug}/jersey-poll/${pollId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedPollHint(true)
      window.setTimeout(() => setCopiedPollHint(false), 2000)
    } catch {
      setJerseyModalError('Could not copy — copy the link manually from the address bar after opening the poll.')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong'); setSubmitting(false); return }
    setForm({ name: '', color: '#5a7a2a', season_id: form.season_id })
    setShowForm(false)
    fetchData()
    setSubmitting(false)
  }

  async function deleteTeam(teamId: string) {
    if (!confirm('Delete this team? Players will be unassigned.')) return
    setDeletingId(teamId)
    await fetch('/api/teams', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId }),
    })
    setDeletingId(null)
    fetchData()
  }

  const filteredTeams = selectedSeason === 'all'
    ? teams
    : teams.filter(t => t.season_id === selectedSeason)

  const jerseyModalTeam = jerseyModalTeamId ? teams.find((t) => t.id === jerseyModalTeamId) : undefined
  const jerseyModalOpenPoll = jerseyModalTeamId
    ? jerseyPolls.find((p) => p.team_id === jerseyModalTeamId && p.status === 'open')
    : undefined

  return (
    <div style={{ maxWidth: '760px' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-subtitle">
            {teams.length} team{teams.length !== 1 ? 's' : ''} across {seasons.length} season{seasons.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={seasons.length === 0}
          className="btn-primary"
          style={{ opacity: seasons.length === 0 ? 0.5 : 1 }}
        >
          + New Team
        </button>
      </div>

      {/* No seasons warning */}
      {seasons.length === 0 && !loading && (
        <div style={{
          background: '#fffbeb',
          border: '0.5px solid #fde68a',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '16px',
        }}>
          <p style={{ fontWeight: '700', color: '#92400e', fontSize: '13px', marginBottom: '4px' }}>
            No seasons yet
          </p>
          <a href="/dashboard/seasons" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600' }}>
            Create a season first →
          </a>
        </div>
      )}

      {/* Season Filter Pills */}
      {seasons.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[{ id: 'all', name: 'All Seasons' }, ...seasons].map((s) => {
            const active = selectedSeason === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSeason(s.id)}
                style={{
                  padding: '5px 14px',
                  borderRadius: '99px',
                  fontSize: '12px',
                  fontWeight: '600',
                  border: `1.5px solid ${active ? 'var(--btn-primary-bg)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  background: active ? 'var(--btn-primary-bg)' : 'transparent',
                  color: active ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              >
                {s.name}
              </button>
            )
          })}
        </div>
      )}

      {/* New Team Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Create New Team
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="label">Team Name *</label>
              <input type="text" required placeholder="e.g. Red Dragons"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input" />
            </div>
            <div>
              <label className="label">Season *</label>
              <select value={form.season_id}
                onChange={(e) => setForm({ ...form, season_id: e.target.value })}
                className="input">
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Team Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="color" value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  style={{ width: '44px', height: '36px', borderRadius: '6px', border: '0.5px solid var(--border)', cursor: 'pointer', padding: '2px' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Click to pick a team color</span>
              </div>
            </div>
            {error && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#dc2626' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Creating...' : 'Create Team'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Teams Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading teams...
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users size={32} strokeWidth={1.5} /></div>
          <div className="empty-state-title">No teams yet</div>
          <div className="empty-state-desc">
            {selectedSeason === 'all' ? 'Create your first team to get started.' : 'No teams in this season yet.'}
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(120px, 2fr) minmax(100px, 2fr) 56px minmax(168px, 2fr) 72px',
            gap: '8px',
            padding: '10px 20px',
            background: 'var(--bg-elevated)',
            borderBottom: '0.5px solid var(--border)',
            alignItems: 'center',
          }}>
            {['Team', 'Season', '# plyrs', 'Public / poll', ''].map((h, i) => (
              <span key={i} style={{
                fontSize: '10px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'var(--text-muted)',
              }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {filteredTeams.map((team) => {
            const nPlayers = team.player_count ?? 0
            return (
              <div key={team.id}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px, 2fr) minmax(100px, 2fr) 56px minmax(168px, 2fr) 72px',
                    gap: '8px',
                    padding: '12px 20px',
                    borderBottom: '0.5px solid var(--border-light)',
                    alignItems: 'center',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div style={{
                      width: '4px',
                      height: '36px',
                      borderRadius: '2px',
                      background: team.color || 'var(--accent)',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {team.name}
                    </span>
                  </div>

                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {seasons.find(s => s.id === team.season_id)?.name || '—'}
                  </span>

                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', textAlign: 'center' }}>
                    {nPlayers}
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                    {orgSlug ? (
                      <a
                        href={`/league/${orgSlug}/teams/${team.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
                      >
                        Public team page ↗
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setJerseyModalError('')
                        setJerseyModalTeamId(team.id)
                      }}
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px', fontWeight: 600 }}
                    >
                      Jersey numbers…
                    </button>
                  </div>

                  <button
                    onClick={() => deleteTeam(team.id)}
                    disabled={deletingId === team.id}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#dc2626',
                      fontWeight: '600',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      opacity: deletingId === team.id ? 0.5 : 1,
                      padding: '0',
                      textAlign: 'right',
                    }}
                  >
                    {deletingId === team.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {jerseyModalTeamId && jerseyModalTeam ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="jersey-modal-title"
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
          onClick={() => {
            if (!jerseyBusy) setJerseyModalTeamId(null)
          }}
        >
          <div
            className="card"
            style={{ maxWidth: '460px', width: '100%', maxHeight: '88vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="jersey-modal-title" style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              Jersey number requests
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{jerseyModalTeam.name}</strong>
              {' — '}Players use your public poll link to choose a preferred number. Final numbers are still assigned on{' '}
              <a href="/dashboard/players" style={{ color: 'var(--accent)', fontWeight: 600 }}>Players</a>.
            </p>

            {jerseyModalError ? (
              <div style={{
                background: '#fef2f2',
                border: '0.5px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '13px',
                color: '#b91c1c',
                marginBottom: '12px',
              }}>
                {jerseyModalError}
              </div>
            ) : null}

            {jerseyModalOpenPoll ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#15803d',
                    background: '#dcfce7',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}>
                    Poll open
                  </span>
                  {copiedPollHint ? (
                    <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>Link copied</span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={jerseyBusy || !orgSlug}
                    style={{ fontSize: '13px' }}
                    onClick={() => void copyPollUrl(jerseyModalOpenPoll.id)}
                  >
                    Copy poll link
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={jerseyBusy}
                    style={{ fontSize: '13px' }}
                    onClick={() => void closeJerseyPoll(jerseyModalOpenPoll.id)}
                  >
                    Close poll
                  </button>
                </div>

                <div style={{
                  border: '0.5px solid var(--border)',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '12px',
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 72px 72px',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                  }}>
                    <span>Player</span>
                    <span style={{ textAlign: 'center' }}>#</span>
                    <span style={{ textAlign: 'center' }}>Note</span>
                  </div>
                  {jerseyModalOpenPoll.responses.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No responses yet. Copy the poll link and share it with your team.
                    </div>
                  ) : (
                    jerseyModalOpenPoll.responses.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 72px 72px',
                          gap: '8px',
                          padding: '10px 12px',
                          borderTop: '0.5px solid var(--border-light)',
                          alignItems: 'center',
                          fontSize: '13px',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.player.full_name}
                          </div>
                          {r.player.email ? (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.player.email}
                            </div>
                          ) : null}
                        </div>
                        <span style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>
                          {r.preferred_number}
                        </span>
                        <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: r.conflict ? '#b45309' : 'var(--text-muted)' }}>
                          {r.conflict ? 'Conflict' : '—'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div style={{ marginBottom: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.45 }}>
                  Open a poll to collect preferred jersey numbers. Only one open poll per team at a time.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={jerseyBusy}
                  onClick={() => void openJerseyPoll(jerseyModalTeam.id)}
                >
                  {jerseyBusy ? '…' : 'Request jersey numbers'}
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn-secondary"
              disabled={jerseyBusy}
              style={{ width: '100%' }}
              onClick={() => setJerseyModalTeamId(null)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}