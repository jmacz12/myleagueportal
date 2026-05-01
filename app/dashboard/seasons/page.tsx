'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Season {
  id: string
  name: string
  type: string
  is_active: boolean
  start_date: string | null
  end_date: string | null
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
  const [form, setForm] = useState({ name: '', type: 'season', start_date: '', end_date: '' })

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
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong'); setSubmitting(false); return }
    setForm({ name: '', type: 'season', start_date: '', end_date: '' })
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
          <p className="page-subtitle">Manage your competitive seasons and drop-in periods</p>
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
                🔒 Season Limit Reached
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Your <strong>{orgInfo?.plan}</strong> plan allows {orgInfo?.seasonLimit} season{orgInfo?.seasonLimit === 1 ? '' : 's'}.
                {orgInfo?.plan === 'basic' ? ' Upgrade to Pro for up to 3 seasons.' : ' Upgrade to Enterprise for unlimited.'}
              </p>
            </div>
            <Link href="/dashboard/settings" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}>
                Upgrade Plan →
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

            <div>
              <label className="label">Season Type *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { id: 'season', label: '🏆 Competitive Season', desc: 'Standings, playoffs, full stats' },
                  { id: 'dropin', label: '🎲 Drop-in / Off Season', desc: 'Casual play, no standings' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm({ ...form, type: opt.id })}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${form.type === opt.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.type === opt.id ? 'var(--accent-muted)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
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
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-title">No seasons yet</div>
          <div className="empty-state-desc">Create your first season or drop-in period to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {seasons.map((season) => (
            <div key={season.id} className="card-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{season.name}</span>
                  <span className={`badge ${season.type === 'dropin' ? 'badge-dropin' : 'badge-season'}`}>
                    {season.type === 'dropin' ? '🎲 Drop-in' : '🏆 Competitive'}
                  </span>
                  {season.is_active && <span className="badge badge-active">● Active</span>}
                </div>
                {(season.start_date || season.end_date) && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {season.start_date && new Date(season.start_date).toLocaleDateString()}
                    {season.start_date && season.end_date && ' → '}
                    {season.end_date && new Date(season.end_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
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