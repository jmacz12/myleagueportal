'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'

interface Session {
  id: string
  name: string
  scheduled_at: string
  ends_at: string | null
  location: string | null
  max_players: number
  max_waitlist?: number
  fee_amount: number
  status: string
  allow_signups: boolean
  is_recurring: boolean
  recurring_frequency: string | null
  signup_opens: string
  payment_method?: string | null
  etransfer_info?: string | null
  signup_opens_days_before?: number | null
  signup_opens_at?: string | null
  _count?: number
}

interface Props {
  onSelectSession: (id: string, tab?: 'checkin' | 'payments' | 'teams') => void
}

interface DropinFormState {
  name: string
  date: string
  start_time: string
  end_time: string
  location: string
  max_players: string
  max_waitlist: string
  fee_amount: string
  payment_method: string
  etransfer_info: string
  signup_opens: string
  signup_opens_days_before: string
  signup_opens_at: string
  is_recurring: boolean
  recurring_frequency: string
  recurring_until: string
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function sessionToEditValues(session: Session): { form: DropinFormState; signupOption: string } {
  const scheduled = new Date(session.scheduled_at)
  const dateStr = `${scheduled.getFullYear()}-${pad2(scheduled.getMonth() + 1)}-${pad2(scheduled.getDate())}`
  const startTime = `${pad2(scheduled.getHours())}:${pad2(scheduled.getMinutes())}`
  let endTime = ''
  if (session.ends_at) {
    const end = new Date(session.ends_at)
    endTime = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`
  }
  const rawMode = session.signup_opens || 'open_now'
  let signupOption = 'open_now'
  if (rawMode === 'closed') signupOption = 'closed'
  else if (rawMode === 'scheduled' || rawMode === 'days_before') signupOption = 'scheduled'
  else if (rawMode === 'custom' || rawMode === 'specific') signupOption = 'custom'

  let signup_opens_at = ''
  if (session.signup_opens_at) {
    const o = new Date(session.signup_opens_at)
    signup_opens_at = `${o.getFullYear()}-${pad2(o.getMonth() + 1)}-${pad2(o.getDate())}T${pad2(o.getHours())}:${pad2(o.getMinutes())}`
  }

  return {
    signupOption,
    form: {
      name: session.name,
      date: dateStr,
      start_time: startTime,
      end_time: endTime,
      location: session.location || '',
      max_players: String(session.max_players ?? 16),
      max_waitlist: String(session.max_waitlist ?? 5),
      fee_amount: String(session.fee_amount ?? 0),
      payment_method: session.payment_method || 'cash_or_etransfer',
      etransfer_info: session.etransfer_info || '',
      signup_opens: signupOption,
      signup_opens_days_before: String(session.signup_opens_days_before ?? 3),
      signup_opens_at,
      is_recurring: false,
      recurring_frequency: 'weekly',
      recurring_until: '',
    },
  }
}

function DropinSessionFormFields({
  form,
  setForm,
  signupOption,
  setSignupOption,
  showRecurring,
}: {
  form: DropinFormState
  setForm: React.Dispatch<React.SetStateAction<DropinFormState>>
  signupOption: string
  setSignupOption: (v: string) => void
  showRecurring: boolean
}) {
  const signupOptions = [
    { value: 'open_now', title: 'Open now', sub: 'Sign-up on right away' },
    { value: 'closed', title: 'Keep closed', sub: 'You open sign-up when ready' },
    { value: 'scheduled', title: 'Schedule opening', sub: 'Opens days before the session' },
    { value: 'custom', title: 'Custom date & time', sub: 'Opens at a time you pick' },
  ]

  return (
    <>
      <div>
        <label className="label">Session Name *</label>
        <input type="text" required placeholder="e.g. Friday Night Drop-in"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div>
          <label className="label">Location</label>
          <input type="text" placeholder="e.g. Main Gym"
            value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="input" />
        </div>
        <div>
          <label className="label">Max players</label>
          <input type="number" min="2" max="100" value={form.max_players}
            onChange={(e) => setForm({ ...form, max_players: e.target.value })} className="input" />
        </div>
        <div>
          <label className="label">Waitlist cap</label>
          <input type="number" min="0" max="100" value={form.max_waitlist}
            onChange={(e) => setForm({ ...form, max_waitlist: e.target.value })} className="input" />
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>0 = no waitlist</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
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

      <div>
        <label className="label" style={{ marginBottom: '8px' }}>When do signups open?</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px' }}>
          {signupOptions.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setSignupOption(opt.value)}
              style={{
                padding: '10px 8px', borderRadius: '8px',
                border: signupOption === opt.value ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                background: signupOption === opt.value ? 'var(--accent-muted)' : 'var(--bg-surface)',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
              }}>
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
          <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '10px 12px', marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
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

      {showRecurring && (
        <>
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
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-text)' }}>Recurring schedule</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
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
                Each day ends at midnight. Up to 52 future dates at a time.
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

function emptyDropinForm(): DropinFormState {
  return {
    name: '', date: '', start_time: '', end_time: '',
    location: '', max_players: '16', max_waitlist: '5', fee_amount: '10',
    payment_method: 'cash_or_etransfer', etransfer_info: '',
    signup_opens: 'open_now',
    signup_opens_days_before: '3',
    signup_opens_at: '',
    is_recurring: false,
    recurring_frequency: 'weekly',
    recurring_until: '',
  }
}

export default function DropinList({ onSelectSession }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [signupOption, setSignupOption] = useState('open_now')
  const [upcomingExpanded, setUpcomingExpanded] = useState(false)
  const [expandedUpcomingGroups, setExpandedUpcomingGroups] = useState<Record<string, boolean>>({})
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [selectedToDelete, setSelectedToDelete] = useState<string[]>([])
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<DropinFormState>(() => emptyDropinForm())
  const [editSignupOption, setEditSignupOption] = useState('open_now')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')
  const [form, setForm] = useState<DropinFormState>(() => emptyDropinForm())

  useEffect(() => { fetchSessions() }, [])

  async function fetchSessions() {
    const res = await fetch('/api/dropin')
    const data = await res.json()
    setSessions((data.sessions || []).filter((s: Session) => s.status === 'upcoming'))
    setLoading(false)
  }

  function resetForm() {
    setForm(emptyDropinForm())
    setSignupOption('open_now')
  }

  function beginEditSession(session: Session) {
    const { form: ef, signupOption: so } = sessionToEditValues(session)
    setEditForm(ef)
    setEditSignupOption(so)
    setEditingSessionId(session.id)
    setEditError('')
    setShowForm(false)
    setUpcomingExpanded(true)
  }

  function cancelEditSession() {
    setEditingSessionId(null)
    setEditForm(emptyDropinForm())
    setEditSignupOption('open_now')
    setEditError('')
    setEditSubmitting(false)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingSessionId) return
    setEditSubmitting(true)
    setEditError('')
    const res = await fetch(`/api/dropin/${editingSessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, signup_opens: editSignupOption }),
    })
    const data = await res.json()
    if (!res.ok) {
      setEditError(data.error || 'Something went wrong')
      setEditSubmitting(false)
      return
    }
    cancelEditSession()
    fetchSessions()
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
    const res = await fetch('/api/dropin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: id }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(typeof body.error === 'string' ? body.error : 'Failed to delete session')
      return
    }
    fetchSessions()
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selectedToDelete.length} selected sessions?`)) return
    const responses = await Promise.all(selectedToDelete.map(id =>
      fetch('/api/dropin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id }),
      })
    ))
    const failed = responses.filter((r) => !r.ok).length
    if (failed > 0) {
      alert(`${failed} session${failed > 1 ? 's' : ''} could not be deleted. Please try again.`)
    }
    setSelectedToDelete([])
    setEditingGroup(null)
    fetchSessions()
  }

  function toggleSelect(id: string) {
    setSelectedToDelete(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

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

  const groupedRemaining = remainingSessions.reduce((acc, s) => {
    const key = s.is_recurring ? `series:${s.name.split(' —')[0].trim()}` : `single:${s.id}`
    const label = s.is_recurring ? s.name.split(' —')[0].trim() : s.name
    if (!acc[key]) acc[key] = { label, sessions: [], isRecurring: s.is_recurring }
    acc[key].sessions.push(s)
    return acc
  }, {} as Record<string, { label: string; sessions: Session[]; isRecurring: boolean }>)

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
        <button
          type="button"
          onClick={() => {
            if (!showForm) cancelEditSession()
            setShowForm(!showForm)
          }}
          className="btn-primary"
        >
          + New Session
        </button>
      </div>

      {/* New Session Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>New Drop-in Session</div>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }}
              className="modal-close" aria-label="Close form">×</button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <DropinSessionFormFields
              form={form}
              setForm={setForm}
              signupOption={signupOption}
              setSignupOption={setSignupOption}
              showRecurring
            />

            {error && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626' }}>{error}</div>
            )}

            <div className="dropin-form-actions">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Creating...' : 'Create Session'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {editingSessionId && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>Edit drop-in session</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '520px', lineHeight: 1.45 }}>
                Changes apply to this session only. People already signed up keep their spots.
              </div>
            </div>
            <button type="button" onClick={cancelEditSession}
              className="modal-close" aria-label="Close editor">×</button>
          </div>

          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <DropinSessionFormFields
              form={editForm}
              setForm={setEditForm}
              signupOption={editSignupOption}
              setSignupOption={setEditSignupOption}
              showRecurring={false}
            />
            {editError && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626' }}>{editError}</div>
            )}
            <div className="dropin-form-actions">
              <button type="submit" disabled={editSubmitting} className="btn-primary">
                {editSubmitting ? 'Saving...' : 'Save changes'}
              </button>
              <button type="button" onClick={cancelEditSession} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CalendarDays size={32} strokeWidth={1.5} /></div>
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
                  <div
                    key={session.id}
                    className="card"
                    style={{
                      border: '1.5px solid var(--accent)',
                      background: 'var(--accent-muted)',
                      padding: '16px',
                      transition: 'filter 0.15s',
                    }}
                  >
                    <div className="dropin-list-next-inner">
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`Open session: ${session.name.split(' —')[0]}`}
                        onClick={() => onSelectSession(session.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onSelectSession(session.id)
                          }
                        }}
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          outline: 'none',
                          margin: '-4px',
                          padding: '4px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.filter = 'brightness(0.97)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            {session.name.split(' —')[0]}
                          </span>
                          {session.is_recurring && (
                            <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', borderRadius: '99px', fontSize: '10px', fontWeight: '600', padding: '2px 8px' }}>
                              Recurring
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
                      <div className="dropin-list-next-actions">
                        <button type="button" onClick={() => beginEditSession(session)} className="dropin-action-btn">
                          Edit details
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectSession(session.id, 'teams')}
                          className="dropin-action-btn dropin-action-btn-primary"
                        >
                          Build Teams
                        </button>
                        <button type="button" onClick={() => deleteSession(session.id)} className="dropin-action-btn dropin-action-btn-danger">
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
                type="button"
                onClick={() => setUpcomingExpanded(!upcomingExpanded)}
                className="dropin-upcoming-toggle"
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
                <ChevronDown size={16} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.15s', transform: upcomingExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} aria-hidden />
              </button>

              {upcomingExpanded && (
                <div style={{ border: '0.5px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                  {Object.entries(groupedRemaining).map(([groupKey, group], gIdx, arr) => {
                    const isOpen = !!expandedUpcomingGroups[groupKey]
                    const firstSession = group.sessions[0]
                    const baseName = group.isRecurring ? firstSession.name.split(' —')[0].trim() : firstSession.name
                    const sortedGroup = [...group.sessions].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                    const preview = isOpen ? sortedGroup : sortedGroup.slice(0, 1)
                    const isLastGroup = gIdx === arr.length - 1
                    return (
                      <div key={groupKey} style={{ background: 'var(--bg-surface)', borderBottom: isLastGroup ? 'none' : '0.5px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '12px 16px', background: 'var(--bg-elevated)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {group.label}
                            </span>
                            {group.isRecurring ? (
                              <span style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', borderRadius: '99px', fontSize: '9px', fontWeight: '700', padding: '1px 7px', flexShrink: 0 }}>
                                Recurring · {group.sessions.length}
                              </span>
                            ) : null}
                          </div>
                          {group.sessions.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedUpcomingGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                              className="dropin-action-btn"
                              style={{ padding: '5px 10px' }}
                            >
                              {isOpen ? 'Hide' : `Show ${group.sessions.length}`}
                            </button>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {preview.map((session, idx) => {
                            const isLast = idx === preview.length - 1
                            const groupExists = session.is_recurring && recurringGroups[baseName]
                            return (
                              <div
                                key={session.id}
                                className="dropin-list-upcoming-row"
                                style={{
                                  padding: '12px 16px',
                                  borderBottom: isLast ? 'none' : '0.5px solid var(--border-light)',
                                  background: 'var(--bg-surface)',
                                }}
                              >
                                <div
                                  role="button"
                                  tabIndex={0}
                                  aria-label={`Open session: ${session.name.split(' —')[0]}`}
                                  onClick={() => onSelectSession(session.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      onSelectSession(session.id)
                                    }
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    flex: 1,
                                    minWidth: 0,
                                    cursor: 'pointer',
                                    borderRadius: '8px',
                                    outline: 'none',
                                    margin: '-6px',
                                    padding: '6px',
                                    transition: 'background 0.12s',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--bg-elevated)'
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent'
                                  }}
                                >
                                  <div style={{ flexShrink: 0, width: '44px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>
                                      {new Date(session.scheduled_at).getDate()}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                      {new Date(session.scheduled_at).toLocaleDateString('en-CA', { month: 'short' })}
                                    </div>
                                  </div>
                                  <div style={{ width: '0.5px', height: '36px', background: 'var(--border)', flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {session.name.split(' —')[0]}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      {formatDate(session.scheduled_at)} · {formatTime(session.scheduled_at)}
                                      {session.location && ` · ${session.location}`}
                                      {session.fee_amount > 0 && ` · $${session.fee_amount}`}
                                    </div>
                                  </div>
                                </div>

                                <div className="dropin-list-upcoming-actions">
                                  <button type="button" onClick={() => beginEditSession(session)} className="dropin-action-btn">
                                    Edit
                                  </button>
                                  {groupExists ? (
                                    <button
                                      type="button"
                                      onClick={() => { setEditingGroup(baseName); setSelectedToDelete([]) }}
                                      className="dropin-action-btn"
                                    >
                                      Schedule
                                    </button>
                                  ) : null}
                                  <button type="button" onClick={() => deleteSession(session.id)}
                                    className="dropin-action-btn dropin-action-btn-danger">
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )
                          })}
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
                Schedule — {editingGroup}
              </div>
              <button type="button" onClick={() => { setEditingGroup(null); setSelectedToDelete([]) }}
                className="modal-close" aria-label="Close dialog">×</button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Check sessions to cancel — e.g. when the gym is unavailable
            </div>

            {/* Select all + delete selected */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '8px', marginBottom: '10px' }}>
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
                <button onClick={deleteSelected} className="dropin-action-btn dropin-action-btn-danger">
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