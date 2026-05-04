'use client'

import { useState } from 'react'
import { Users } from 'lucide-react'

interface Registration {
  id: string
  full_name: string
  email: string | null
  checked_in: boolean
  payment_status: string
  positions: string[]
  is_guest: boolean
  host_registration_id: string | null
  guest_count: number
}

interface Props {
  sessionId: string
  registrations: Registration[]
  onRefresh: () => void
}

export default function DropinCheckin({ sessionId, registrations, onRefresh }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function toggleCheckin(regId: string, current: boolean) {
    setUpdatingId(regId)
    await fetch(`/api/dropin/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: regId, checked_in: !current }),
    })
    setUpdatingId(null)
    onRefresh()
  }

  // Group guests with their hosts
  const hosts = registrations.filter(r => !r.is_guest)
  const guests = registrations.filter(r => r.is_guest)

  function getGuestsForHost(hostId: string) {
    return guests.filter(g => g.host_registration_id === hostId)
  }

  if (registrations.length === 0) return (
    <div className="empty-state">
      <div className="empty-state-icon"><Users size={32} strokeWidth={1.5} /></div>
      <div className="empty-state-title">No registrations yet</div>
      <div className="empty-state-desc">Players will appear here once they sign up.</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {hosts.map((reg) => {
        const hostGuests = getGuestsForHost(reg.id)
        return (
          <div key={reg.id}>
            {/* Host player */}
            <div className="card-sm" style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              borderColor: reg.checked_in ? '#bbf7d0' : 'var(--border)',
              background: reg.checked_in ? '#f9fff9' : 'var(--bg-surface)',
              borderRadius: hostGuests.length > 0 ? '10px 10px 0 0' : '10px',
              marginBottom: hostGuests.length > 0 ? '0' : '0',
            }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: reg.checked_in ? '#bbf7d0' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', flexShrink: 0 }}>
                {reg.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{reg.full_name}</span>
                  {hostGuests.length > 0 && (
                    <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', borderRadius: '99px', fontSize: '10px', fontWeight: '600', padding: '1px 7px' }}>
                      +{hostGuests.length} guest{hostGuests.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {reg.positions && reg.positions.length > 0 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {reg.positions.join(', ')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {reg.checked_in ? (
                  <span style={{ background: '#f0fdf4', color: '#16a34a', border: '0.5px solid #bbf7d0', borderRadius: '6px', fontSize: '11px', fontWeight: '700', padding: '5px 10px' }}>Here</span>
                ) : (
                  <>
                    <button onClick={() => toggleCheckin(reg.id, reg.checked_in)} disabled={updatingId === reg.id}
                      style={{ background: '#5a7a2a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Here
                    </button>
                    <button onClick={() => toggleCheckin(reg.id, true)} disabled={updatingId === reg.id}
                      style={{ background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca', borderRadius: '6px', fontSize: '11px', fontWeight: '700', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      No-show
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Guest players */}
            {hostGuests.map((guest, idx) => (
              <div key={guest.id} className="card-sm" style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                borderColor: guest.checked_in ? '#bbf7d0' : 'var(--border)',
                background: guest.checked_in ? '#f9fff9' : 'var(--bg-elevated)',
                borderRadius: idx === hostGuests.length - 1 ? '0 0 10px 10px' : '0',
                borderTop: 'none',
                paddingLeft: '20px',
              }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', flexShrink: 0, border: '1px dashed var(--border)' }}>
                  {guest.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>{guest.full_name}</span>
                    <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', borderRadius: '99px', fontSize: '9px', fontWeight: '600', padding: '1px 6px' }}>Guest</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {guest.checked_in ? (
                    <span style={{ background: '#f0fdf4', color: '#16a34a', border: '0.5px solid #bbf7d0', borderRadius: '6px', fontSize: '10px', fontWeight: '700', padding: '4px 8px' }}>Here</span>
                  ) : (
                    <>
                      <button onClick={() => toggleCheckin(guest.id, guest.checked_in)} disabled={updatingId === guest.id}
                        style={{ background: '#5a7a2a', color: 'white', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: '700', padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Here
                      </button>
                      <button onClick={() => toggleCheckin(guest.id, true)} disabled={updatingId === guest.id}
                        style={{ background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca', borderRadius: '6px', fontSize: '10px', fontWeight: '700', padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        No-show
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}