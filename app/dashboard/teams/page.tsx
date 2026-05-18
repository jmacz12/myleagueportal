'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Shirt, Users } from 'lucide-react'
import { JerseyPollResponsesTable } from '@/components/jersey-poll-responses-table'
import { JERSEY_POLL_PRO_REQUIRED_MESSAGE } from '@/lib/jersey-poll-tier'
import {
  requestCloseJerseyPoll,
  requestOpenJerseyPoll,
} from '@/lib/jersey-poll-dashboard-client'
import { DashboardHelpLauncher } from '@/components/dashboard/DashboardHelpLauncher'

interface Team {
  id: string
  name: string
  color: string | null
  season_id: string
  logo_url?: string | null
  player_count?: number
}

interface JerseyPollRow {
  id: string
  team_id: string
  status: string
  submissions?: Array<{ player_id: string; full_name: string; preferred_number: number | null }>
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
  const [orgPlan, setOrgPlan] = useState<'basic' | 'pro' | 'enterprise'>('basic')
  const [jerseyPolls, setJerseyPolls] = useState<JerseyPollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selectedSeason, setSelectedSeason] = useState<string>('all')
  const [form, setForm] = useState({ name: '', color: '#5a7a2a', season_id: '' })
  const [openingJerseyTeamId, setOpeningJerseyTeamId] = useState<string | null>(null)
  const [jerseyActionError, setJerseyActionError] = useState('')
  const [jerseySectionTab, setJerseySectionTab] = useState<'responses' | 'start'>('responses')
  const [teamsMainTab, setTeamsMainTab] = useState<'overview' | 'jersey'>('overview')
  const [autoTeamCount, setAutoTeamCount] = useState(4)
  const [autoCreating, setAutoCreating] = useState(false)

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
    const pr = String(teamsData.org_plan || 'basic').toLowerCase()
    const planNorm = pr === 'enterprise' ? 'enterprise' : pr === 'pro' ? 'pro' : 'basic'
    setOrgPlan(planNorm)

    if (planNorm === 'pro' || planNorm === 'enterprise') {
      const pollsRes = await fetch('/api/jersey-polls')
      const pollsJson = await pollsRes.json().catch(() => ({}))
      setJerseyPolls(pollsRes.ok && Array.isArray(pollsJson.polls) ? pollsJson.polls : [])
    } else {
      setJerseyPolls([])
    }

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

  const openJerseyPolls = jerseyPolls.filter((p) => p.status === 'open')
  const teamIdsInSeasonView = new Set(filteredTeams.map((t) => t.id))
  const openJerseyPollsInView = openJerseyPolls.filter((p) => teamIdsInSeasonView.has(p.team_id))
  const teamsWithoutOpenJerseyPoll = filteredTeams.filter(
    (t) => !openJerseyPolls.some((p) => p.team_id === t.id && p.status === 'open')
  )

  const standingsRows = [...filteredTeams].sort(
    (a, b) => (b.player_count ?? 0) - (a.player_count ?? 0)
  )

  const seasonFilterPills =
    seasons.length > 0 ? (
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[{ id: 'all', name: 'All Seasons' }, ...seasons].map((s) => {
          const active = selectedSeason === s.id
          return (
            <button
              key={s.id}
              type="button"
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
    ) : null

  async function openJerseyPollForTeam(teamId: string) {
    setJerseyActionError('')
    setOpeningJerseyTeamId(teamId)
    try {
      const { ok, json } = await requestOpenJerseyPoll(teamId)
      if (!ok) {
        setJerseyActionError(typeof json.error === 'string' ? json.error : 'Could not open poll.')
        return
      }
      await fetchData()
      setJerseySectionTab('responses')
    } finally {
      setOpeningJerseyTeamId(null)
    }
  }

  async function closeJerseyPollFromDashboard(pollId: string) {
    if (!confirm('Close this jersey poll? Players will not be able to submit new picks.')) return
    const { ok, json } = await requestCloseJerseyPoll(pollId)
    if (!ok) {
      alert(typeof json.error === 'string' ? json.error : 'Could not close poll.')
      return
    }
    void fetchData()
  }

  async function handleAutoCreateTeams() {
    if (!canManageTeams) return
    if (selectedSeason === 'all') {
      setError('Pick a specific season from the pills below (not “All seasons”).')
      return
    }
    const seasonMeta = seasons.find((s) => s.id === selectedSeason)
    if (!seasonMeta || seasonMeta.type !== 'season') {
      setError('Choose a competitive season from the pills.')
      return
    }
    const n = Math.min(12, Math.max(2, Math.round(autoTeamCount)))
    if (!window.confirm(`Create Team 1…${n} for “${seasonMeta.name}” and split unassigned players across them? Only works if this season has no teams yet.`)) return
    setAutoCreating(true)
    setError('')
    try {
      const res = await fetch('/api/teams/auto-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: selectedSeason, team_count: n }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; teams_created?: number; players_assigned?: number }
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not auto-create teams.')
        return
      }
      await fetchData()
    } finally {
      setAutoCreating(false)
    }
  }

  return (
    <div style={{ maxWidth: '760px' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-subtitle">
            {teams.length} team{teams.length !== 1 ? 's' : ''} across {seasons.length} season{seasons.length !== 1 ? 's' : ''}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.45, maxWidth: '520px' }}>
            Public team pages use the same tabs fans see (Overview through Stats). Open a team&apos;s public page, then{' '}
            <strong>Manage team</strong>, for stream, news, schedule, logo, and jersey polls.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexShrink: 0 }}>
          <DashboardHelpLauncher topic="teams" />
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={seasons.length === 0 || !canManageTeams}
            className="btn-primary"
            style={{ opacity: seasons.length === 0 || !canManageTeams ? 0.5 : 1 }}
          >
            + New Team
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Team list and jersey polls"
        style={{
          display: 'flex',
          gap: '0',
          marginBottom: '12px',
          borderBottom: '0.5px solid var(--border)',
        }}
      >
        {(
          [
            { id: 'overview' as const, label: 'Overview' },
            { id: 'jersey' as const, label: 'Jersey polls' },
          ] as const
        ).map((tab) => {
          const selected = teamsMainTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`teams-main-tab-${tab.id}`}
              aria-controls={`teams-main-panel-${tab.id}`}
              onClick={() => setTeamsMainTab(tab.id)}
              style={{
                position: 'relative',
                padding: '12px 16px 14px',
                marginBottom: '-0.5px',
                fontSize: '14px',
                fontWeight: selected ? 800 : 600,
                fontFamily: 'inherit',
                border: 'none',
                background: 'transparent',
                color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                borderBottom: selected ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.12s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {teamsMainTab === 'overview' ? (
        <div id="teams-main-panel-overview" role="tabpanel" aria-labelledby="teams-main-tab-overview">
          {!canManageTeams ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Editors: use each team&apos;s <strong>Manage team</strong> on the public page for logo, polls, news, and schedule. Only the owner can add or delete teams here.
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

      {seasonFilterPills}

      {error ? (
        <div
          style={{
            marginBottom: '12px',
            padding: '12px 14px',
            borderRadius: '8px',
            background: '#fef2f2',
            border: '0.5px solid #fecaca',
            fontSize: '13px',
            color: '#dc2626',
          }}
        >
          {error}
        </div>
      ) : null}

          {(orgPlan === 'pro' || orgPlan === 'enterprise') && canManageTeams && seasons.length > 0 ? (
            <div
              className="card-sm"
              style={{
                marginBottom: '16px',
                padding: '14px 16px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '12px',
                border: '0.5px solid var(--border)',
                borderRadius: '10px',
                background: 'var(--bg-elevated)',
              }}
            >
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Auto-create teams
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                  For the season selected in the pills above: creates <strong>Team 1…N</strong> (only if that season has{' '}
                  <strong>zero</strong> teams), then assigns <strong>unassigned</strong> season players round-robin. You can rename
                  teams and tweak assignments anytime.
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Teams
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={autoTeamCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10)
                    setAutoTeamCount(Number.isFinite(v) ? v : 2)
                  }}
                  className="input"
                  style={{ width: '64px', padding: '6px 8px' }}
                  disabled={autoCreating}
                />
              </label>
              <button
                type="button"
                className="btn-secondary"
                disabled={autoCreating || selectedSeason === 'all'}
                onClick={() => void handleAutoCreateTeams()}
                style={{ fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }}
              >
                {autoCreating ? 'Working…' : 'Run auto-create'}
              </button>
            </div>
          ) : null}

          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
              Team standings
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Sorted by how many players are on each roster (same order as the list below). Wins and losses for fans live on your public league page under <strong>Standings</strong>.
            </p>
            {standingsRows.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No teams in this view yet.</p>
            ) : (
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {standingsRows.map((team, idx) => (
                  <li
                    key={team.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 0',
                      borderTop: idx === 0 ? 'none' : '0.5px solid var(--border-light)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        width: '28px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div
                      style={{
                        width: '4px',
                        height: '28px',
                        borderRadius: '2px',
                        background: team.color || 'var(--accent)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {team.name}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {team.player_count ?? 0} players
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

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
      ) : (
        <div id="teams-main-panel-jersey" role="tabpanel" aria-labelledby="teams-main-tab-jersey">
          {orgPlan !== 'pro' && orgPlan !== 'enterprise' ? (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <Shirt size={20} strokeWidth={2} aria-hidden style={{ color: 'var(--accent)' }} />
                <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>Jersey polls</div>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>{JERSEY_POLL_PRO_REQUIRED_MESSAGE}</p>
              <Link href="/dashboard/settings" className="btn-primary" style={{ fontSize: '13px', padding: '10px 16px', textDecoration: 'none', display: 'inline-block', width: 'fit-content' }}>
                View plans in Settings
              </Link>
            </div>
          ) : (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Shirt size={20} strokeWidth={2} aria-hidden style={{ color: 'var(--accent)' }} />
                <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>Jersey polls</div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Who picked a number and who has not. Start here with <strong>Start a poll</strong>, or on the public team page use <strong>Manage team</strong> → <strong>Logo &amp; poll</strong>. First pick on a number wins.
              </p>
              {seasonFilterPills ? (
                <div style={{ marginBottom: '4px' }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '10px',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      marginBottom: '6px',
                    }}
                  >
                    Season filter
                  </span>
                  {seasonFilterPills}
                </div>
              ) : null}
              {jerseyActionError ? (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: '0.5px solid #fecaca',
                    fontSize: '12px',
                    color: '#b91c1c',
                  }}
                >
                  {jerseyActionError}
                </div>
              ) : null}

              <div
                role="tablist"
                aria-label="Jersey polls"
                style={{
                  display: 'flex',
                  gap: '0',
                  marginBottom: '14px',
                  borderBottom: '0.5px solid var(--border)',
                }}
              >
                {(
                  [
                    { id: 'responses' as const, label: 'Responses', count: openJerseyPollsInView.length },
                    { id: 'start' as const, label: 'Start a poll', count: teamsWithoutOpenJerseyPoll.length },
                  ] as const
                ).map((tab) => {
                  const selected = jerseySectionTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      id={`jersey-tab-${tab.id}`}
                      aria-controls={`jersey-panel-${tab.id}`}
                      onClick={() => setJerseySectionTab(tab.id)}
                      style={{
                        position: 'relative',
                        padding: '10px 14px 12px',
                        marginBottom: '-0.5px',
                        fontSize: '13px',
                        fontWeight: selected ? 800 : 600,
                        fontFamily: 'inherit',
                        border: 'none',
                        background: 'transparent',
                        color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        borderBottom: selected ? '2px solid var(--accent)' : '2px solid transparent',
                        transition: 'color 0.12s',
                      }}
                    >
                      {tab.label}
                      <span
                        style={{
                          marginLeft: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: selected ? 'var(--accent)' : 'var(--text-muted)',
                          opacity: 0.9,
                        }}
                      >
                        ({tab.count})
                      </span>
                    </button>
                  )
                })}
              </div>

              {jerseySectionTab === 'start' ? (
                <div id="jersey-panel-start" role="tabpanel" aria-labelledby="jersey-tab-start">
                  {teamsWithoutOpenJerseyPoll.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                      {filteredTeams.length === 0
                        ? 'No teams in this season filter. Change the season on this page or create a team.'
                        : 'Every team in this view already has an open jersey poll.'}
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                        Teams in the current season filter (same as the season pills on the Overview tab) without an open poll.
                      </p>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {teamsWithoutOpenJerseyPoll.map((team) => (
                          <li
                            key={team.id}
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              border: '0.5px dashed var(--border)',
                              background: 'var(--bg-surface)',
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', flex: '1 1 140px' }}>{team.name}</span>
                            <button
                              type="button"
                              disabled={openingJerseyTeamId === team.id}
                              className="btn-primary"
                              style={{ fontSize: '11px', padding: '6px 12px', opacity: openingJerseyTeamId === team.id ? 0.7 : 1 }}
                              onClick={() => void openJerseyPollForTeam(team.id)}
                            >
                              {openingJerseyTeamId === team.id ? 'Opening…' : 'Open jersey poll'}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ) : (
                <div id="jersey-panel-responses" role="tabpanel" aria-labelledby="jersey-tab-responses">
                  {openJerseyPollsInView.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                      {openJerseyPolls.length > 0 && selectedSeason !== 'all'
                        ? 'No open polls in this season. Switch to “All Seasons” on Overview or use Start a poll for teams here.'
                        : 'No open jersey polls. Open one from the Start a poll tab or Manage team → Logo & poll.'}
                    </p>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {openJerseyPollsInView.map((poll) => {
                        const t = teams.find((x) => x.id === poll.team_id)
                        const rows = poll.submissions || []
                        const picked = rows.filter((r) => r.preferred_number != null).length
                        return (
                          <li key={poll.id} style={{ listStyle: 'none' }}>
                            <details
                              style={{
                                borderRadius: '10px',
                                border: '0.5px solid var(--border)',
                                background: 'var(--bg-elevated)',
                                overflow: 'hidden',
                              }}
                            >
                              <summary
                                style={{
                                  cursor: 'pointer',
                                  padding: '12px 14px',
                                  fontWeight: 800,
                                  fontSize: '14px',
                                  color: 'var(--text-primary)',
                                  listStyle: 'none',
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '10px',
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }} aria-hidden>
                                    ▶
                                  </span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t?.name || 'Team'}</span>
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
                                  {rows.length === 0 ? 'No players on roster' : `${picked}/${rows.length} picked`}
                                </span>
                              </summary>
                              <div style={{ padding: '0 14px 14px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                  {orgSlug ? (
                                    <Link
                                      href={`/league/${orgSlug}/teams/${poll.team_id}?manage=1&panel=jersey`}
                                      style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}
                                    >
                                      Open team tools
                                    </Link>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => void closeJerseyPollFromDashboard(poll.id)}
                                    className="btn-secondary"
                                    style={{ fontSize: '11px', padding: '6px 10px' }}
                                  >
                                    Close poll
                                  </button>
                                </div>
                                <JerseyPollResponsesTable variant="dashboard" rows={rows} />
                              </div>
                            </details>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  )
}