'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'

interface Team {
  id: string
  name: string
  color: string | null
  season_id: string
  logo_url?: string | null
  player_count?: number
}

interface Season {
  id: string
  name: string
  type: string
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [orgSlug, setOrgSlug] = useState('')
  const [orgRole, setOrgRole] = useState<'owner' | 'editor'>('owner')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [form, setForm] = useState({ name: '', color: '#5a7a2a', season_id: '' })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [teamsRes, seasonsRes] = await Promise.all([
      fetch('/api/teams'),
      fetch('/api/seasons'),
    ])
    const teamsData = await teamsRes.json()
    const seasonsData = await seasonsRes.json()
    setTeams(teamsData.teams || [])
    setOrgSlug(typeof teamsData.org_slug === 'string' ? teamsData.org_slug : '')
    setOrgRole(teamsData.org_role === 'editor' ? 'editor' : 'owner')
    setSeasons(seasonsData.seasons || [])
    if (seasonsData.seasons?.length > 0) {
      setForm(f => ({ ...f, season_id: seasonsData.seasons[0].id }))
    }
    setLoading(false)
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

  const canManageTeams = orgRole === 'owner'

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
          disabled={seasons.length === 0 || !canManageTeams}
          className="btn-primary"
          style={{ opacity: seasons.length === 0 || !canManageTeams ? 0.5 : 1 }}
        >
          + New Team
        </button>
      </div>
      {!canManageTeams ? (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Editor access: open each team’s public page and use <strong>Manage team</strong> (top right) for logo, jersey polls, news, and calendar. Team create/delete stays owner-only.
        </p>
      ) : null}

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
      {showForm && canManageTeams && (
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
            gridTemplateColumns: 'minmax(120px, 2fr) minmax(100px, 2fr) 56px minmax(140px, 2fr) 72px',
            gap: '8px',
            padding: '10px 20px',
            background: 'var(--bg-elevated)',
            borderBottom: '0.5px solid var(--border)',
            alignItems: 'center',
          }}>
            {['Team', 'Season', '# plyrs', 'Public page', ''].map((h, i) => (
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
                    gridTemplateColumns: 'minmax(120px, 2fr) minmax(100px, 2fr) 56px minmax(140px, 2fr) 72px',
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
                      <Link
                        href={`/league/${orgSlug}/teams/${team.id}`}
                        className="btn-primary"
                        style={{ fontSize: '11px', padding: '6px 12px', fontWeight: 700, textDecoration: 'none', width: 'fit-content' }}
                      >
                        Public team page
                      </Link>
                    ) : null}
                  </div>

                  <button
                    onClick={() => deleteTeam(team.id)}
                    disabled={deletingId === team.id || !canManageTeams}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#dc2626',
                      fontWeight: '600',
                      fontSize: '12px',
                      cursor: canManageTeams ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                      opacity: deletingId === team.id || !canManageTeams ? 0.5 : 1,
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

    </div>
  )
}