'use client'

import { useState } from 'react'

interface Registration {
  id: string
  full_name: string
  payment_status: string
  is_guest: boolean
  host_registration_id: string | null
}

interface Session {
  id: string
  fee_amount: number
  etransfer_info: string | null
  payment_method: string
}

interface Props {
  sessionId: string
  session: Session | null
  registrations: Registration[]
  onRefresh: () => void
}

export default function DropinPayments({ sessionId, session, registrations, onRefresh }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function updatePayment(regId: string, status: string) {
    setUpdatingId(regId)
    await fetch(`/api/dropin/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: regId, payment_status: status }),
    })
    setUpdatingId(null)
    onRefresh()
  }

  const fee = session?.fee_amount || 0
  const allPlayers = registrations
  const totalOwed = allPlayers.length * fee
  const totalPaid = allPlayers.filter(r => r.payment_status === 'paid').length * fee
  const outstanding = totalOwed - totalPaid

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div className="stat-card">
          <div className="stat-number" style={{ fontSize: '22px', color: 'var(--accent)' }}>${totalPaid}</div>
          <div className="stat-label">Collected</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{ fontSize: '22px', color: outstanding > 0 ? '#dc2626' : 'var(--text-primary)' }}>${outstanding}</div>
          <div className="stat-label">Outstanding</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{ fontSize: '22px' }}>${totalOwed}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      {session?.etransfer_info && (
        <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          💳 E-transfer info: <strong>{session.etransfer_info}</strong>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {allPlayers.map((reg) => (
          <div key={reg.id} className="card-sm" style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: reg.payment_status === 'unpaid' ? '#fff8f8' : 'var(--bg-surface)',
            borderColor: reg.payment_status === 'unpaid' ? '#fecaca' : 'var(--border)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{reg.full_name}</span>
                {reg.is_guest && (
                  <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', borderRadius: '99px', fontSize: '9px', fontWeight: '600', padding: '1px 6px' }}>Guest</span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Owes ${fee}</div>
            </div>
            <span style={{
              background: reg.payment_status === 'paid' ? '#f0fdf4' : reg.payment_status === 'partial' ? '#fffbeb' : '#fef2f2',
              color: reg.payment_status === 'paid' ? '#16a34a' : reg.payment_status === 'partial' ? '#92400e' : '#dc2626',
              border: `0.5px solid ${reg.payment_status === 'paid' ? '#bbf7d0' : reg.payment_status === 'partial' ? '#fde68a' : '#fecaca'}`,
              borderRadius: '4px', fontSize: '10px', fontWeight: '700', padding: '2px 8px',
            }}>
              {reg.payment_status === 'paid' ? '✓ Paid' : reg.payment_status === 'partial' ? 'Partial' : '✗ Unpaid'}
            </span>
            {reg.payment_status !== 'paid' ? (
              <button onClick={() => updatePayment(reg.id, 'paid')} disabled={updatingId === reg.id}
                style={{ background: '#5a7a2a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                Mark Paid
              </button>
            ) : (
              <button onClick={() => updatePayment(reg.id, 'unpaid')} className="btn-s" style={{ fontSize: '11px', padding: '5px 10px', flexShrink: 0 }}>
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}