'use client'

import { useState, useEffect } from 'react'
import DropinDetail from './DropinDetail'

interface DropinSession {
  id: string
  name: string
  scheduled_at: string
  ends_at: string | null
  location: string | null
  max_players: number
  fee_amount: number
  status: string
  allow_signups: boolean
  _count?: number
}

export default function DropinTab() {
  const [sessions, setSessions] = useState<DropinSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', date: '', start_time: '', end_time: '',
    location: '', max_players: '16', fee_amount: '10',
    payment_method: 'cash_or_etransfer', etransfer_info: '',
    allow_signups: true,
    signup_opens: 'immediately',
    signup_opens_days_before: '3',
    signup_opens_at: '',
    is_recurring: false,
    recurring_frequency: 'weekly',
    recurring_until: '',
  })

  useEffect(() => { fetchSessions() }, [])

  async function fetchSessions() {
    const res = await fetch('/api/dropin')
    const data = await res.json()
    setSessions(data.sessions || [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/dropin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong'); setSubmitting(false); return }
    setShowForm(false)
    setForm({
      name: '', date: '', start_time: '', end_time: '',
      location: '', max_players: '16', fee_amount: '10',
      payment_method: 'cash_or_etransfer', etransfer_info: '',
      allow_signups: true,
      signup_opens: 'immediately',
      signup_opens_days_before: '3',
      signup_opens_at: '',
      is_recurring: false,
      recurring_frequency: 'weekly',
      recurring_until: '',
    })
    fetchSessions()
    setSubmitting(false)
  }

  async function deleteSession(id: string) {
    if (!confirm('Delete this drop-in session?')) return
    await fetch('/api/dropin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: id }),
    })
    fetchSessions()
  }

  if (selectedSession) {
    return (
      <DropinDetail
        sessionId={selectedSession}
        onBack={() => { setSelectedSession(null); fetchSessions() }}
      />
    )
  }

  return (
    <div>
      <div className="page-header">
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + New Session
        </button>
      </div>

      {/* New Session Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            New Drop-in Session
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div>
              <label className="label">Session Name *</label>
              <input type="text" required placeholder="e.g. Friday Night Drop-in"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label">Date *</label>
                <input type="date" required value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="input" />
              </div>
              <div>
                <label className="label">Start Time *</label>
                <input type="time" required value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="input" />
              </div>
              <div>
                <label className="label">End Time</label>
                <input type="time" value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="input" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label">Location</label>
                <input type="text" placeholder="e.g. Main Gym"
                  value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="input" />
              </div>
              <div>
                <label className="label">Max Players</label>
                <input type="number" min="2" max="100"
                  value={form.max_players} onChange={(e) => setForm({ ...form, max_players: e.target.value })}
                  className="input" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label">Drop-in Fee ($)</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '0.5px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{ background: 'var(--bg-elevated)', padding: '9px 12px', fontSize: '13px', color: 'var(--text-muted)', borderRight: '0.5px solid var(--border)', flexShrink: 0 }}>$</span>
                  <input type="number" min="0" step="0.50"
                    value={form.fee_amount} onChange={(e) => setForm({ ...form, fee_amount: e.target.value })}
                    style={{ flex: 1, padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
                </div>
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                  className="input">
                  <option value="cash_or_etransfer">Cash or E-transfer</option>
                  <option value="cash">Cash only</option>
                  <option value="etransfer">E-transfer only</option>
                </select>
              </div>
            </div>

            {(form.payment_method === 'etransfer' || form.payment_method === 'cash_or_etransfer') && (
              <div>
                <label className="label">E-transfer Info (shown to players)</label>
                <input type="text" placeholder="e.g. Send to john@gmail.com — ref your name"
                  value={form.etransfer_info} onChange={(e) => setForm({ ...form, etransfer_info: e.target.value })}
                  className="input" />
              </div>
            )}

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px 14px',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Allow player sign-ups
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Players can register via your portal link
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, allow_signups: !form.allow_signups })}
                style={{
                  width: '40px', height: '22px',
                  background: form.allow_signups ? 'var(--accent)' : 'var(--border)',
                  borderRadius: '99px', border: 'none', cursor: 'pointer',
                  position: 'relative', transition: 'background 0.15s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: '16px', height: '16px', background: 'white',
                  borderRadius: '50%', position: 'absolute',
                  top: '3px',
                  left: form.allow_signups ? '21px' : '3px',
                  transition: 'left 0.15s',
                }} />
              </button>
            </div>

            {/* Signup opens */}
            {form.allow_signups && (
              <div style={{
                background: 'var(--bg-elevated)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  When do signups open?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { value: 'immediately', label: 'Immediately after creating' },
                    { value: 'days_before', label: 'X days before session' },
                    { value: 'specific', label: 'Specific date & time' },
                    { value: 'manual', label: 'Manually (I\'ll open it myself)' },
                  ].map((opt) => (
                    <label key={opt.value} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)',
                    }}>
                      <input
                        type="radio"
                        name="signup_opens"
                        value={opt.value}
                        checked={form.signup_opens === opt.value}
                        onChange={(e) => setForm({ ...form, signup_opens: e.target.value })}
                        style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>

                {form.signup_opens === 'days_before' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={form.signup_opens_days_before}
                      onChange={(e) => setForm({ ...form, signup_opens_days_before: e.target.value })}
                      className="input"
                      style={{ width: '80px', padding: '7px 10px' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      days before the session starts
                    </span>
                  </div>
                )}

                {form.signup_opens === 'specific' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label className="label">Date</label>
                      <input
                        type="date"
                        value={form.signup_opens_at.split('T')[0] || ''}
                        onChange={(e) => setForm({ ...form, signup_opens_at: e.target.value + 'T' + (form.signup_opens_at.split('T')[1] || '09:00') })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Time</label>
                      <input
                        type="time"
                        value={form.signup_opens_at.split('T')[1] || '09:00'}
                        onChange={(e) => setForm({ ...form, signup_opens_at: (form.signup_opens_at.split('T')[0] || form.date) + 'T' + e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>
                )}

                {form.signup_opens === 'manual' && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '6px', padding: '8px 10px' }}>
                    Signups will be closed until you manually open them from the session management page.
                  </div>
                )}
              </div>
            )}

            {/* Recurring toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px 14px',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Recurring session
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Auto-create this session on a schedule
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_recurring: !form.is_recurring })}
                style={{
                  width: '40px', height: '22px',
                  background: form.is_recurring ? 'var(--accent)' : 'var(--border)',
                  borderRadius: '99px', border: 'none', cursor: 'pointer',
                  position: 'relative', transition: 'background 0.15s', flexShrink: 0,
                }}
              >
                <div style={{
                  width: '16px', height: '16px', background: 'white',
                  borderRadius: '50%', position: 'absolute', top: '3px',
                  left: form.is_recurring ? '21px' : '3px',
                  transition: 'left 0.15s',
                }} />
              </button>
            </div>

            {/* Recurring options */}
            {form.is_recurring && (
              <div style={{
                background: 'var(--bg-surface)',
                border: '0.5px solid var(--accent)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-text)' }}>
                  ⚡ Recurring Schedule
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="label">Repeat every</label>
                    <select
                      value={form.recurring_frequency}
                      onChange={(e) => setForm({ ...form, recurring_frequency: e.target.value })}
                      className="input"
                    >
                      <option value="weekly">Every week</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Every month</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Repeat until</label>
                    <input
                      type="date"
                      value={form.recurring_until}
                      onChange={(e) => setForm({ ...form, recurring_until: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Sessions auto-close at midnight and move to history. Each session is independent — you can edit or cancel any one.
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Creating...' : 'Create Session'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎲</div>
          <div className="empty-state-title">No drop-in sessions yet</div>
          <div className="empty-state-desc">Create your first drop-in session to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sessions.map((session) => {
            const date = new Date(session.scheduled_at)
            const spotsText = session._count !== undefined
              ? `${session._count}/${session.max_players} spots`
              : `0/${session.max_players} spots`
            const pct = session._count ? (session._count / session.max_players) * 100 : 0

            return (
              <div key={session.id} className="card-sm">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {session.name}
                      </span>
                      <span style={{
                        background: session.status === 'upcoming' ? '#e8f0d0' : '#f1f5f9',
                        color: session.status === 'upcoming' ? '#3a5a10' : '#64748b',
                        border: `0.5px solid ${session.status === 'upcoming' ? '#8aaa4a' : '#cbd5e1'}`,
                        borderRadius: '99px', fontSize: '10px', fontWeight: '700', padding: '2px 8px',
                      }}>
                        {session.status === 'upcoming' ? '● Open' : session.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {date.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
                      {session.location && ` · ${session.location}`}
                      {session.fee_amount > 0 && ` · $${session.fee_amount}`}
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginBottom: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{spotsText} filled</span>
                      </div>
                      <div style={{ background: 'var(--bg-elevated)', borderRadius: '99px', height: '5px' }}>
                        <div style={{ background: 'var(--accent)', borderRadius: '99px', height: '5px', width: `${Math.min(pct, 100)}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => setSelectedSession(session.id)}
                      className="btn-primary"
                      style={{ fontSize: '11px', padding: '6px 12px' }}
                    >
                      Manage
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}