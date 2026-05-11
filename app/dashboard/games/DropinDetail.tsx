'use client'

import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Lock, Users } from 'lucide-react'

interface Registration {
  id: string
  full_name: string
  email: string | null
  checked_in: boolean
  payment_status: string
  amount_paid: number
}

interface Session {
  id: string
  name: string
  scheduled_at: string
  location: string | null
  max_players: number
  fee_amount: number
  payment_method: string
  etransfer_info: string | null
  status: string
}

interface Props {
  sessionId: string
  onBack: () => void
}

export default function DropinDetail({ sessionId, onBack }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'checkin' | 'payments' | 'standings'>('checkin')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/dropin/${sessionId}`)
    const data = await res.json()
    setSession(data.session)
    setRegistrations(data.registrations || [])
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  async function toggleCheckin(regId: string, current: boolean) {
    setUpdatingId(regId)
    await fetch(`/api/dropin/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: regId, checked_in: !current }),
    })
    setUpdatingId(null)
    fetchData()
  }

  async function updatePayment(regId: string, status: string) {
    setUpdatingId(regId)
    await fetch(`/api/dropin/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: regId, payment_status: status }),
    })
    setUpdatingId(null)
    fetchData()
  }

  const checkedIn = registrations.filter(r => r.checked_in).length
  const noShows = registrations.filter(r => !r.checked_in).length
  const totalOwed = registrations.length * (session?.fee_amount || 0)
  const totalPaid = registrations.filter(r => r.payment_status === 'paid').length * (session?.fee_amount || 0)
  const outstanding = totalOwed - totalPaid

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
      Loading session...
    </div>
  )

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '16px', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        ← Back to Sessions
      </button>

      {/* Session header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
          {session?.name}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {session && new Date(session.scheduled_at).toLocaleDateString('en-CA', {
            weekday: 'long', month: 'long', day: 'numeric',
          })}
          {session?.location && ` · ${session.location}`}
          {session?.fee_amount && session.fee_amount > 0 && ` · $${session.fee_amount}/person`}
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-number" style={{ color: 'var(--accent)' }}>{registrations.length}</div>
          <div className="stat-label">Signed Up</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{checkedIn}</div>
          <div className="stat-label">Checked In</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{ color: noShows > 0 ? '#dc2626' : 'var(--text-primary)' }}>
            {noShows}
          </div>
          <div className="stat-label">No-shows</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: '4px',
        background: 'var(--bg-elevated)',
        border: '0.5px solid var(--border)',
        borderRadius: '10px', padding: '4px',
        marginBottom: '16px', width: 'fit-content',
      }}>
        {[
          { id: 'checkin', label: 'Check-in' },
          { id: 'payments', label: 'Payments' },
          { id: 'standings', label: 'Standings' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'checkin' | 'payments' | 'standings')}
            style={{
              padding: '7px 14px', borderRadius: '7px',
              fontSize: '12px', fontWeight: '600',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: activeTab === tab.id ? 'var(--btn-primary-bg)' : 'transparent',
              color: activeTab === tab.id ? 'var(--btn-primary-text)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CHECK-IN TAB */}
      {activeTab === 'checkin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {registrations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Users size={32} strokeWidth={1.5} /></div>
              <div className="empty-state-title">No registrations yet</div>
              <div className="empty-state-desc">Players will appear here once they sign up.</div>
            </div>
          ) : registrations.map((reg) => (
            <div
              key={reg.id}
              className="card-sm"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                borderColor: reg.checked_in ? '#bbf7d0' :
                  (!reg.checked_in && session && new Date(session.scheduled_at) < new Date()) ? '#fecaca' : 'var(--border)',
                background: reg.checked_in ? '#f9fff9' : 'var(--bg-surface)',
              }}
            >
              <div style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: reg.checked_in ? '#bbf7d0' : 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)',
                flexShrink: 0,
              }}>
                {reg.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {reg.full_name}
                </div>
                {reg.email && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {reg.email}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {reg.checked_in ? (
                  <span style={{ background: '#f0fdf4', color: '#16a34a', border: '0.5px solid #bbf7d0', borderRadius: '6px', fontSize: '11px', fontWeight: '700', padding: '5px 10px' }}>
                    Here
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => toggleCheckin(reg.id, reg.checked_in)}
                      disabled={updatingId === reg.id}
                      className="btn-g"
                      style={{ fontSize: '11px', padding: '5px 10px' }}
                    >
                      Here
                    </button>
                    <button
                      onClick={() => toggleCheckin(reg.id, true)}
                      disabled={updatingId === reg.id}
                      style={{ background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca', borderRadius: '6px', fontSize: '11px', fontWeight: '700', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      No-show
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PAYMENTS TAB */}
      {activeTab === 'payments' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div className="stat-card">
              <div className="stat-number" style={{ fontSize: '24px', color: 'var(--accent)' }}>${totalPaid}</div>
              <div className="stat-label">Collected</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ fontSize: '24px', color: outstanding > 0 ? '#dc2626' : 'var(--text-primary)' }}>${outstanding}</div>
              <div className="stat-label">Outstanding</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ fontSize: '24px' }}>${totalOwed}</div>
              <div className="stat-label">Total</div>
            </div>
          </div>

          {session?.etransfer_info && (
            <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <CreditCard size={16} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden />
              <span><strong style={{ fontWeight: 600 }}>E-transfer:</strong> <strong>{session.etransfer_info}</strong></span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {registrations.map((reg) => (
              <div key={reg.id} className="card-sm" style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: reg.payment_status === 'unpaid' ? '#fff8f8' : 'var(--bg-surface)',
                borderColor: reg.payment_status === 'unpaid' ? '#fecaca' : 'var(--border)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {reg.full_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Owes ${session?.fee_amount || 0}
                  </div>
                </div>
                <span style={{
                  background: reg.payment_status === 'paid' ? '#f0fdf4' : reg.payment_status === 'partial' ? '#fffbeb' : '#fef2f2',
                  color: reg.payment_status === 'paid' ? '#16a34a' : reg.payment_status === 'partial' ? '#92400e' : '#dc2626',
                  border: `0.5px solid ${reg.payment_status === 'paid' ? '#bbf7d0' : reg.payment_status === 'partial' ? '#fde68a' : '#fecaca'}`,
                  borderRadius: '4px', fontSize: '10px', fontWeight: '700', padding: '2px 8px',
                }}>
                  {reg.payment_status === 'paid' ? 'Paid' : reg.payment_status === 'partial' ? 'Partial' : 'Unpaid'}
                </span>
                {reg.payment_status !== 'paid' && (
                  <button
                    onClick={() => updatePayment(reg.id, 'paid')}
                    disabled={updatingId === reg.id}
                    className="btn-g"
                    style={{ fontSize: '11px', padding: '5px 10px' }}
                  >
                    Mark Paid
                  </button>
                )}
                {reg.payment_status === 'paid' && (
                  <button
                    onClick={() => updatePayment(reg.id, 'unpaid')}
                    className="btn-s"
                    style={{ fontSize: '11px', padding: '5px 10px' }}
                  >
                    Undo
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STANDINGS TAB */}
      {activeTab === 'standings' && (
        <div>
          <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '12px 16px', marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <Lock size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden />
            <span>Only you can see player standings. Players are ranked by reputation points across all sessions.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {registrations
              .sort((a, b) => (b.checked_in ? 1 : 0) - (a.checked_in ? 1 : 0))
              .map((reg, index) => (
                <div key={reg.id} className="card-sm" style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: !reg.checked_in ? '#fff8f8' : 'var(--bg-surface)',
                  borderColor: !reg.checked_in ? '#fecaca' : 'var(--border)',
                }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', width: '20px', flexShrink: 0 }}>
                    {index + 1}
                  </span>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: reg.checked_in ? '#e8f0d0' : '#fecaca',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: '800', color: 'var(--text-primary)',
                    flexShrink: 0,
                  }}>
                    {reg.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {reg.full_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {reg.checked_in ? 'Attended' : 'No-show'}
                      {' · '}
                      {reg.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </div>
                  </div>
                  <span style={{
                    background: reg.payment_status === 'paid' && reg.checked_in ? '#e8f0d0' : '#fef2f2',
                    color: reg.payment_status === 'paid' && reg.checked_in ? '#3a5a10' : '#dc2626',
                    border: `0.5px solid ${reg.payment_status === 'paid' && reg.checked_in ? '#8aaa4a' : '#fecaca'}`,
                    borderRadius: '6px', fontSize: '10px', fontWeight: '700', padding: '3px 8px',
                  }}>
                    {reg.payment_status === 'paid' && reg.checked_in ? 'Good Standing' : 'Needs Attention'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}