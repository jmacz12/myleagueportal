'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Archive, ChevronDown, ClipboardList } from 'lucide-react'

interface Session {
  id: string
  name: string
  scheduled_at: string
  location: string | null
  max_players: number
  fee_amount: number
  status: string
  _count?: number
  _paid?: number
}

export default function DropinHistory() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [openMonths, setOpenMonths] = useState<string[]>([])

  useEffect(() => {
    async function fetchHistory() {
      const res = await fetch('/api/dropin?status=closed')
      const data = await res.json()
      const closed = data.sessions || []
      setSessions(closed)
      // Auto-open the most recent month
      if (closed.length > 0) {
        const latest = new Date(closed[0].scheduled_at)
          .toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
        setOpenMonths([latest])
      }
      setLoading(false)
    }
    fetchHistory()
  }, [])

  function toggleMonth(month: string) {
    setOpenMonths(prev =>
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
    )
  }

  // Group by month
  const grouped = sessions.reduce((acc, session) => {
    const month = new Date(session.scheduled_at)
      .toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
    if (!acc[month]) acc[month] = []
    acc[month].push(session)
    return acc
  }, {} as Record<string, Session[]>)

  // Check if any sessions in a month are expiring (within 7 days of 30-day limit)
  function isExpiring(sessions: Session[]) {
    return sessions.some(s => {
      const sessionDate = new Date(s.scheduled_at)
      const deleteDate = new Date(sessionDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      const daysLeft = Math.ceil((deleteDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return daysLeft <= 7 && daysLeft >= 0
    })
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
      Loading history...
    </div>
  )

  if (sessions.length === 0) return (
    <div className="empty-state">
      <div className="empty-state-icon"><ClipboardList size={32} strokeWidth={1.5} /></div>
      <div className="empty-state-title">No session history yet</div>
      <div className="empty-state-desc">
        Sessions auto-archive at midnight and appear here.
      </div>
    </div>
  )

  return (
    <div>
      {/* Retention notice */}
      <div style={{
        background: 'var(--bg-elevated)', border: '0.5px solid var(--border)',
        borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '8px',
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Archive size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} aria-hidden />
          <span>History kept for <strong>30 days</strong> on Basic · <strong>1 year</strong> on Pro · <strong>Forever</strong> on Enterprise</span>
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} archived
        </span>
      </div>

      {/* Accordion by month */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.entries(grouped).map(([month, monthSessions]) => {
          const isOpen = openMonths.includes(month)
          const expiring = isExpiring(monthSessions)

          return (
            <div key={month} style={{
              border: `0.5px solid ${expiring ? '#fde68a' : 'var(--border)'}`,
              borderRadius: '10px', overflow: 'hidden',
            }}>
              {/* Month header — always visible */}
              <button
                onClick={() => toggleMonth(month)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', padding: '12px 16px',
                  background: expiring ? '#fffbeb' : 'var(--bg-elevated)',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {month}
                  </span>
                  <span style={{
                    background: expiring ? '#fef9c3' : 'var(--bg-surface)',
                    border: `0.5px solid ${expiring ? '#fde68a' : 'var(--border)'}`,
                    borderRadius: '99px', fontSize: '10px',
                    color: expiring ? '#92400e' : 'var(--text-muted)',
                    padding: '2px 8px', fontWeight: '600',
                  }}>
                    {monthSessions.length} session{monthSessions.length !== 1 ? 's' : ''}
                    {expiring && ' · expiring soon'}
                  </span>
                </div>
                <span style={{
                  color: 'var(--text-muted)',
                  transition: 'transform 0.15s', display: 'inline-flex',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }} aria-hidden><ChevronDown size={16} strokeWidth={2} /></span>
              </button>

              {/* Session rows — only when expanded */}
              {isOpen && (
                <div style={{ background: 'var(--bg-surface)' }}>
                  {monthSessions.map((session) => {
                    const date = new Date(session.scheduled_at)
                    const collected = (session._paid || 0) * session.fee_amount
                    const deleteDate = new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000)
                    const daysLeft = Math.ceil((deleteDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    const sessionExpiring = daysLeft <= 7 && daysLeft >= 0

                    return (
                      <div key={session.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 16px',
                        borderTop: '0.5px solid var(--border-light)',
                        background: sessionExpiring ? '#fffbeb' : 'transparent',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>
                            {session.name.split(' —')[0]}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {session.location && ` · ${session.location}`}
                            {session._count && ` · ${session._count} attended`}
                            {collected > 0 && ` · $${collected} collected`}
                          </div>
                          {sessionExpiring && (
                            <div style={{ fontSize: '10px', color: '#92400e', fontWeight: '600', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} strokeWidth={2} aria-hidden />
                              Deletes in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — upgrade to Pro to keep
                            </div>
                          )}
                        </div>
                        <span style={{
                          background: sessionExpiring ? '#fef9c3' : '#f0fdf4',
                          color: sessionExpiring ? '#92400e' : '#16a34a',
                          border: `0.5px solid ${sessionExpiring ? '#fde68a' : '#bbf7d0'}`,
                          borderRadius: '4px', fontSize: '10px', fontWeight: '700',
                          padding: '2px 8px', flexShrink: 0,
                        }}>
                          {sessionExpiring ? 'Expiring' : 'Closed'}
                        </span>
                        <button className="btn-s" style={{ fontSize: '10px', padding: '4px 8px', flexShrink: 0 }}>
                          View
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}