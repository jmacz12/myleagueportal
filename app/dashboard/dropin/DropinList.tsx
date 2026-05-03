'use client'

import { useState, useEffect } from 'react'

interface Session {
  id: string
  name: string
  scheduled_at: string
  ends_at: string | null
  location: string | null
  max_players: number
  fee_amount: number
  status: string
  allow_signups: boolean
  is_recurring: boolean
  recurring_frequency: string | null
  signup_opens: string
  _count?: number
}

interface Props {
  onSelectSession: (id: string, tab?: 'checkin' | 'payments' | 'teams') => void
}

export default function DropinList({ onSelectSession }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [signupOption, setSignupOption] = useState('open_now')
  const [upcomingExpanded, setUpcomingExpanded] = useState(false)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [selectedToDelete, setSelectedToDelete] = useState<string[]>([])
  const [form, setForm] = useState({
    name: '', date: '', start_time: '', end_time: '',
    location: '', max_players: '16', fee_amount: '10',
    payment_method: 'cash_or_etransfer', etransfer_info: '',
    signup_opens: 'open_now',
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
    setSessions((data.sessions || []).filter((s: Session) => s.status === 'upcoming'))
    setLoading(false)
  }

  function resetForm() {
    setForm({
      name: '', date: '', start_time: '', end_time: '',
      location: '', max_players: '16', fee_amount: '10',
      payment_method: 'cash_or_etransfer', etransfer_info: '',
      signup_opens: 'open_now',
      signup_opens_days_before: '3',
      signup_opens_at: '',
      is_recurring: false,
      recurring_frequency: 'weekly',
      recurring_until: '',
    })
    setSignupOption('open_now')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/dropin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, signup_opens: signupOption }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong'); setSubmitting(false); return }
    setShowForm(false)
    resetForm()
    fetchSessions()
    setSubmitting(false)
  }

  async function deleteSession(id: string) {
    if (!confirm('Delete this session?')) return
    await fetch('/api/dropin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: id }),
    })
    fetchSessions()
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selectedToDelete.length} selected sessions?`)) return
    await Promise.all(selectedToDelete.map(id =>
      fetch('/api/dropin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id }),
      })
    ))
    setSelectedToDelete([])
    setEditingGroup(null)
    fetchSessions()
  }

  function toggleSelect(id: string) {
    setSelectedToDelete(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const signupOptions = [
    { value: 'open_now', icon: '🟢', title: 'Open now', sub: 'Sign up immediately' },
    { value: 'closed', icon: '🔒', title: 'Keep closed', sub: 'Open manually later' },
    { value: 'scheduled', icon: '⏰', title: 'Schedule opening', sub: 'X days before session' },
    { value: 'custom', icon: '📆', title: 'Custom date & time', sub: 'Pick exact open time' },
  ]

  // Sort all sessions by date
  const sorted = [...sessions].sort((a, b) =>
    new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  )

  const nextSession = sorted[0]
  const nextDate = nextSession
    ? new Date(nextSession.scheduled_at).toDateString()
    : null
  const nextSessions = nextDate
    ? sorted.filter(s => new Date(s.scheduled_at).toDateString() === nextDate)
    : []
  const remainingSessions = sorted.filter(s =>
    new Date(s.scheduled_at).toDateString() !== nextDate
  )

  // Group recurring by base name for edit modal
  const recurringGroups = sessions
    .filter(s => s.is_recurring)
    .reduce((acc, s) => {
      const base = s.name.split(' —')[0].trim()
      if (!acc[base]) acc[base] = []
      acc[base].push(s)
      return acc
    }, {} as Record<string, Session[]>)

  const editGroupSessions = editingGroup
    ? (recurringGroups[editingGroup] || []).sort((a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      )
    : []

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('en-CA', {
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div>
      <div className="page-header">
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + New Session
        </button>
      </div>

      {/* New Session Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>New Drop-in Session</div>
            <button onClick={() => { setShowForm(false); resetForm() }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '0' }}>×</button>
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
                  onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Start Time *</label>
                <input type="time" required value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">End Time</label>
                <input type="time" value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="input" />
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
                <input type="number" min="2" max="100" value={form.max_players}
                  onChange={(e) => setForm({ ...form, max_players: e.target.value })} className="input" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label">Drop-in Fee ($)</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '0.5px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <span style={{ background: 'var(--bg-elevated)', padding: '9px 12px', fontSize: '13px', color: 'var(--text-muted)', borderRight: '0.5px solid var(--border)', flexShrink: 0 }}>$</span>
                  <input type="number" min="0" step="0.50" value={form.fee_amount}
                    onChange={(e) => setForm({ ...form, fee_amount: e.target.value })}
                    style={{ flex: 1, padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
                </div>
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="input">
                  <option value="cash_or_etransfer">Cash or E-transfer</option>
                  <option value="cash">Cash only</option>
                  <option value="etransfer">E-transfer only</option>
                </select>
              </div>
            </div>

            {(form.payment_method === 'etransfer' || form.payment_method === 'cash_or_etransfer') && (
              <div>
                <label className="label">E-transfer Info</label>
                <input type="text" placeholder="e.g. Send to john@gmail.com — ref your name"
                  value={form.etransfer_info} onChange={(e) => setForm({ ...form, etransfer_info: e.target.value })}
                  className="input" />
              </div>
            )}

            {/* Signup timing */}
            <div>
              <label className="label" style={{ marginBottom: '8px' }}>When do signups open?</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {signupOptions.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setSignupOption(opt.value)}
                    style={{
                      padding: '10px 8px', borderRadius: '8px',
                      border: signupOption === opt.value ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                      background: signupOption === opt.value ? 'var(--accent-muted)' : 'var(--bg-surface)',
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
                    }}>
                    <div style={{ fontSize: '14px', marginBottom: '3px' }}>{opt.icon}</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>{opt.title}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
              {signupOption === 'scheduled' && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 12px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" value={form.signup_opens_days_before} min="1" max="14"
                    onChange={(e) => setForm({ ...form, signup_opens_days_before: e.target.value })}
                    style={{ width: '60px', background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'center', fontFamily: 'inherit' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>days before the session starts</span>
                </div>
              )}
              {signupOption === 'custom' && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 12px', marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label className="label">Open date</label>
                    <input type="date" className="input" style={{ fontSize: '11px', padding: '5px 8px' }}
                      value={form.signup_opens_at.split('T')[0] || ''}
                      onChange={(e) => setForm({ ...form, signup_opens_at: e.target.value + 'T' + (form.signup_opens_at.split('T')[1] || '09:00') })} />
                  </div>
                  <div>
                    <label className="label">Open time</label>
                    <input type="time" className="input" style={{ fontSize: '11px', padding: '5px 8px' }}
                      value={form.signup_opens_at.split('T')[1] || '09:00'}
                      onChange={(e) => setForm({ ...form, signup_opens_at: (form.signup_opens_at.split('T')[0] || form.date) + 'T' + e.target.value })} />
                  </div>
                </div>
              )}
              {signupOption === 'closed' && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 12px', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Signups stay closed until you open them manually.
                </div>
              )}
            </div>

            {/* Recurring */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px 14px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Recurring session</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auto-create on a schedule</div>
              </div>
              <button type="button" onClick={() => setForm({ ...form, is_recurring: !form.is_recurring })}
                style={{ width: '40px', height: '22px', background: form.is_recurring ? 'var(--accent)' : 'var(--border)', borderRadius: '99px', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
                <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: form.is_recurring ? '21px' : '3px', transition: 'left 0.15s' }} />
              </button>
            </div>

            {form.is_recurring && (
              <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--accent)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-text)' }}>⚡ Recurring Schedule</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="label">Repeat every</label>
                    <select value={form.recurring_frequency}
                      onChange={(e) => setForm({ ...form, recurring_frequency: e.target.value })} className="input">
                      <option value="weekly">Every week</option>
                      <option value="biweekly">Every 2 weeks</option>
                      <option value="monthly">Every month</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Repeat until</label>
                    <input type="date" value={form.recurring_until}
                      onChange={(e) => setForm({ ...form, recurring_until: e.target.value })} className="input" />
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Sessions auto-close at midnight. Max 52 sessions created at once.
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626' }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Creating...' : 'Create Session'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎲</div>
          <div className="empty-state-title">No active sessions</div>
          <div className="empty-state-desc">Create your first drop-in session to get started.</div>
        </div>
      ) : (
        <div>
          {/* NEXT SESSIONS — all sessions on nearest date */}
          {nextSessions.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                {nextSessions.length > 1
                  ? `Next Sessions — ${new Date(nextSessions[0].scheduled_at).toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' })}`
                  : 'Next Session'
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {nextSessions.map((session) => (
                  <div key={session.id} className="card" style={{
                    border: '1.5px solid var(--accent)',
                    background: 'var(--accent-muted)',
                    padding: '16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            {session.name.split(' —')[0]}
                          </span>
                          {session.is_recurring && (
                            <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', borderRadius: '99px', fontSize: '10px', fontWeight: '600', padding: '2px 8px' }}>
                              🔄 Recurring
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                          {formatTime(session.scheduled_at)}
                          {session.location && ` · ${session.location}`}
                          {session.fee_amount > 0 && ` · $${session.fee_amount}/person`}
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {session._count || 0} / {session.max_players} spots filled
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)' }}>
                              {session.max_players - (session._count || 0)} left
                            </span>
                          </div>
                          <div style={{ background: 'var(--bg-elevated)', borderRadius: '99px', height: '6px' }}>
                            <div style={{
                              background: 'var(--accent)', borderRadius: '99px', height: '6px',
                              width: `${Math.min(((session._count || 0) / session.max_players) * 100, 100)}%`,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => onSelectSession(session.id)} className="btn-primary" style={{ fontSize: '12px' }}>
                          Manage →
                        </button>
                        <button
                          onClick={() => onSelectSession(session.id, 'teams')}
                          style={{
                            fontSize: '11px', padding: '5px 10px',
                            background: 'transparent',
                            border: '1px solid var(--accent)',
                            borderRadius: '6px',
                            color: 'var(--accent)',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          ⚡ Build Teams
                        </button>
                        <button onClick={() => deleteSession(session.id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            color: '#dc2626',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            padding: '5px 10px',
                          }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UPCOMING — collapsible dropdown */}
          {remainingSessions.length > 0 && (
            <div>
              <button
                onClick={() => setUpcomingExpanded(!upcomingExpanded)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', padding: '12px 16px',
                  background: 'var(--bg-elevated)', border: '0.5px solid var(--border)',
                  borderRadius: upcomingExpanded ? '10px 10px 0 0' : '10px',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'border-radius 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    All Upcoming Sessions
                  </span>
                  <span style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '99px', fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', padding: '1px 8px' }}>
                    {remainingSessions.length}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', transition: 'transform 0.15s', display: 'inline-block', transform: upcomingExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </button>

              {upcomingExpanded && (
                <div style={{ border: '0.5px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                  {remainingSessions.map((session, idx) => {
                    const isLast = idx === remainingSessions.length - 1
                    const baseName = session.name.split(' —')[0].trim()
                    const isRecurring = session.is_recurring
                    const groupExists = isRecurring && recurringGroups[baseName]

                    return (
                      <div
                        key={session.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 16px',
                          borderBottom: isLast ? 'none' : '0.5px solid var(--border-light)',
                          background: 'var(--bg-surface)',
                        }}
                      >
                        {/* Date block */}
                        <div style={{ flexShrink: 0, width: '44px', textAlign: 'center' }}>
                          <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>
                            {new Date(session.scheduled_at).getDate()}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                            {new Date(session.scheduled_at).toLocaleDateString('en-CA', { month: 'short' })}
                          </div>
                        </div>

                        {/* Divider */}
                        <div style={{ width: '0.5px', height: '36px', background: 'var(--border)', flexShrink: 0 }} />

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {session.name.split(' —')[0]}
                            </span>
                            {isRecurring && (
                              <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', borderRadius: '99px', fontSize: '9px', fontWeight: '600', padding: '1px 6px', flexShrink: 0 }}>
                                🔄 Recurring
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {formatTime(session.scheduled_at)}
                            {session.location && ` · ${session.location}`}
                            {session.fee_amount > 0 && ` · $${session.fee_amount}`}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          {groupExists && (
                            <button
                              onClick={() => { setEditingGroup(baseName); setSelectedToDelete([]) }}
                              className="btn-s"
                              style={{ fontSize: '10px', padding: '4px 8px' }}
                            >
                              Edit
                            </button>
                          )}
                          <button onClick={() => onSelectSession(session.id)} className="btn-s" style={{ fontSize: '10px', padding: '4px 8px' }}>
                            Manage
                          </button>
                          <button onClick={() => deleteSession(session.id)}
                            style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Recurring Modal */}
      {editingGroup && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setEditingGroup(null); setSelectedToDelete([]) } }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}
        >
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '20px', maxWidth: '420px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Edit — {editingGroup}
              </div>
              <button onClick={() => { setEditingGroup(null); setSelectedToDelete([]) }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer', padding: '0', fontWeight: '700' }}>×</button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Check sessions to cancel — e.g. when the gym is unavailable
            </div>

            {/* Select all + delete selected */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: '6px', marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={selectedToDelete.length === editGroupSessions.length}
                  onChange={(e) => setSelectedToDelete(e.target.checked ? editGroupSessions.map(s => s.id) : [])}
                  style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
                />
                Select all
              </label>
              {selectedToDelete.length > 0 && (
                <button onClick={deleteSelected}
                  style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Delete {selectedToDelete.length} selected
                </button>
              )}
            </div>

            {/* Session list */}
            <div style={{ overflowY: 'auto', flex: 1, border: '0.5px solid var(--border)', borderRadius: '8px' }}>
              {editGroupSessions.map((s, idx) => {
                const isNext = idx === 0
                const isSelected = selectedToDelete.includes(s.id)
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px',
                    borderBottom: idx < editGroupSessions.length - 1 ? '0.5px solid var(--border-light)' : 'none',
                    background: isSelected ? '#fff8f8' : 'transparent',
                  }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(s.id)}
                      style={{ accentColor: '#dc2626', width: '14px', height: '14px', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: isSelected ? '#dc2626' : 'var(--text-primary)', textDecoration: isSelected ? 'line-through' : 'none' }}>
                        {formatDate(s.scheduled_at)} · {formatTime(s.scheduled_at)}
                      </div>
                      {isNext && !isSelected && (
                        <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: '600', marginTop: '1px' }}>
                          Next session · {s._count || 0} signed up
                        </div>
                      )}
                    </div>
                    {isNext && (
                      <span style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '0.5px solid var(--accent)', borderRadius: '4px', fontSize: '9px', fontWeight: '700', padding: '2px 6px', flexShrink: 0 }}>
                        Next
                      </span>
                    )}
                    {isSelected && (
                      <span style={{ background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca', borderRadius: '4px', fontSize: '9px', fontWeight: '700', padding: '2px 6px', flexShrink: 0 }}>
                        Cancelled
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button
                onClick={() => { setEditingGroup(null); setSelectedToDelete([]) }}
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center', padding: '9px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}