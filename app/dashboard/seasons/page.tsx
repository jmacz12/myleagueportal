'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'

interface Season {
  id: string
  name: string
  is_active: boolean
  start_date: string | null
  end_date: string | null
  /** Competitive seasons only: controls public /join season signup */
  allow_online_registration?: boolean
  online_registration_opens_at?: string | null
  online_registration_closes_at?: string | null
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface OrgInfo {
  plan: string
  seasonLimit: number
}

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    allow_online_registration: false,
    online_registration_opens_at: '',
    online_registration_closes_at: '',
  })
  const [windowEditId, setWindowEditId] = useState<string | null>(null)
  const [windowDraft, setWindowDraft] = useState({ opens: '', closes: '' })
  const [windowSaving, setWindowSaving] = useState(false)

  useEffect(() => { fetchSeasons() }, [])

  async function fetchSeasons() {
    const res = await fetch('/api/seasons')
    const data = await res.json()
    setSeasons(data.seasons || [])
    setOrgInfo(data.orgInfo || null)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        allow_online_registration: form.allow_online_registration,
        online_registration_opens_at:
          form.allow_online_registration && form.online_registration_opens_at
            ? new Date(form.online_registration_opens_at).toISOString()
            : null,
        online_registration_closes_at:
          form.allow_online_registration && form.online_registration_closes_at
            ? new Date(form.online_registration_closes_at).toISOString()
            : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong'); setSubmitting(false); return }
    setForm({
      name: '',
      start_date: '',
      end_date: '',
      allow_online_registration: false,
      online_registration_opens_at: '',
      online_registration_closes_at: '',
    })
    setShowForm(false)
    fetchSeasons()
    setSubmitting(false)
  }

  async function toggleActive(seasonId: string, currentStatus: boolean) {
    await fetch('/api/seasons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_id: seasonId, is_active: !currentStatus }),
    })
    fetchSeasons()
  }

  async function toggleOnlineSignup(seasonId: string, current: boolean) {
    await fetch('/api/seasons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_id: seasonId, allow_online_registration: !current }),
    })
    fetchSeasons()
  }

  async function saveSignupWindow(seasonId: string) {
    setWindowSaving(true)
    await fetch('/api/seasons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season_id: seasonId,
        online_registration_opens_at: windowDraft.opens ? new Date(windowDraft.opens).toISOString() : null,
        online_registration_closes_at: windowDraft.closes ? new Date(windowDraft.closes).toISOString() : null,
      }),
    })
    setWindowSaving(false)
    setWindowEditId(null)
    fetchSeasons()
  }

  async function deleteSeason(seasonId: string) {
    if (!confirm('Delete this season? This will also delete all players and stats in this season.')) return
    setDeletingId(seasonId)
    await fetch('/api/seasons', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_id: seasonId }),
    })
    setDeletingId(null)
    fetchSeasons()
  }

  const atLimit = orgInfo && seasons.length >= orgInfo.seasonLimit

  return (
    <div style={{ maxWidth: '760px' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Seasons</h1>
          <p className="page-subtitle">
            Competitive league seasons. For pickup or between-season play, use{' '}
            <Link href="/dashboard/dropin" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Drop-ins
            </Link>
            .
          </p>
        </div>
        <button
          onClick={() => !atLimit && setShowForm(!showForm)}
          className="btn-primary"
          style={{ opacity: atLimit ? 0.5 : 1, cursor: atLimit ? 'not-allowed' : 'pointer' }}
        >
          + New Season
        </button>
      </div>

      {/* Upgrade Banner */}
      {atLimit && (
        <div className="upgrade-banner" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: '700', color: 'var(--accent-text)', marginBottom: '2px', fontSize: '14px' }}>
                Season limit reached
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Your <strong>{orgInfo?.plan}</strong> plan allows {orgInfo?.seasonLimit} season{orgInfo?.seasonLimit === 1 ? '' : 's'}.
                {orgInfo?.plan === 'basic' ? ' Upgrade to Pro for up to 3 seasons.' : ' Upgrade to Enterprise for unlimited.'}
              </p>
            </div>
            <Link href="/dashboard/settings" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}>
                Upgrade plan
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* New Season Form */}
      {showForm && !atLimit && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Create New Season
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div>
              <label className="label">Season Name *</label>
              <input type="text" required placeholder="e.g. Summer 2025" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label">Start Date</label>
                <input type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="input" />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="input" />
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
              }}
            >
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.allow_online_registration}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      allow_online_registration: e.target.checked,
                      ...(e.target.checked
                        ? {}
                        : { online_registration_opens_at: '', online_registration_closes_at: '' }),
                    })
                  }
                  style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--accent)', flexShrink: 0 }}
                />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Public season signup
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '3px' }}>
                    Show “Join the season” on your join link while this season is active.
                  </span>
                </span>
              </label>

              {form.allow_online_registration && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                    When can people sign up?
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45, margin: '0 0 10px' }}>
                    Optional. Leave opens blank to allow signup as soon as this season is active. Leave closes blank for no deadline.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                    <div>
                      <label className="label" style={{ fontSize: '11px' }}>Opens</label>
                      <input
                        type="datetime-local"
                        className="input"
                        value={form.online_registration_opens_at}
                        onChange={(e) => setForm({ ...form, online_registration_opens_at: e.target.value })}
                        style={{ marginTop: '4px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontSize: '11px' }}>Closes</label>
                      <input
                        type="datetime-local"
                        className="input"
                        value={form.online_registration_closes_at}
                        onChange={(e) => setForm({ ...form, online_registration_closes_at: e.target.value })}
                        style={{ marginTop: '4px', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Creating...' : 'Create Season'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Seasons List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading seasons...</div>
      ) : seasons.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CalendarDays size={32} strokeWidth={1.5} /></div>
          <div className="empty-state-title">No seasons yet</div>
          <div className="empty-state-desc">
            Create your first league season. For pickup sessions, open{' '}
            <Link href="/dashboard/dropin" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Drop-ins
            </Link>
            .
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {seasons.map((season) => (
            <div key={season.id} className="card-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{season.name}</span>
                  {season.is_active && <span className="badge badge-active">Active</span>}
                </div>
                {(season.start_date || season.end_date) && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {season.start_date && new Date(season.start_date).toLocaleDateString()}
                    {season.start_date && season.end_date && ' → '}
                    {season.end_date && new Date(season.end_date).toLocaleDateString()}
                  </p>
                )}
                {season.allow_online_registration && windowEditId !== season.id && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.45 }}>
                    Signup:{' '}
                    {season.online_registration_opens_at
                      ? new Date(season.online_registration_opens_at).toLocaleString()
                      : 'Anytime (when active)'}
                    {' → '}
                    {season.online_registration_closes_at
                      ? new Date(season.online_registration_closes_at).toLocaleString()
                      : 'No close date'}
                    <button
                      type="button"
                      onClick={() => {
                        setWindowEditId(season.id)
                        setWindowDraft({
                          opens: isoToDatetimeLocal(season.online_registration_opens_at),
                          closes: isoToDatetimeLocal(season.online_registration_closes_at),
                        })
                      }}
                      style={{
                        marginLeft: '8px',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--accent)',
                        fontWeight: 700,
                        fontSize: '11px',
                        fontFamily: 'inherit',
                      }}
                    >
                      Edit
                    </button>
                  </p>
                )}
                {season.allow_online_registration && windowEditId === season.id && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Signup schedule</div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      <input
                        type="datetime-local"
                        className="input"
                        value={windowDraft.opens}
                        onChange={(e) => setWindowDraft((d) => ({ ...d, opens: e.target.value }))}
                        style={{ fontSize: '12px' }}
                      />
                      <input
                        type="datetime-local"
                        className="input"
                        value={windowDraft.closes}
                        onChange={(e) => setWindowDraft((d) => ({ ...d, closes: e.target.value }))}
                        style={{ fontSize: '12px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={windowSaving}
                          style={{ fontSize: '11px', padding: '6px 12px' }}
                          onClick={() => void saveSignupWindow(season.id)}
                        >
                          {windowSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11px', padding: '6px 12px' }}
                          onClick={() => setWindowEditId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flexShrink: 0, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  title="Toggle public signup on your join link"
                  onClick={() => toggleOnlineSignup(season.id, !!season.allow_online_registration)}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '6px 10px', fontWeight: 700 }}
                >
                  {season.allow_online_registration ? 'Online: on' : 'Online: off'}
                </button>
                <button
                  onClick={() => toggleActive(season.id, season.is_active)}
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  {season.is_active ? 'Set Inactive' : 'Set Active'}
                </button>
                <button
                  onClick={() => deleteSeason(season.id)}
                  disabled={deletingId === season.id}
                  className="btn-danger"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  {deletingId === season.id ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}