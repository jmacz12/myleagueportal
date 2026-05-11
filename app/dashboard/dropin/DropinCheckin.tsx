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
  is_waitlist?: boolean
  created_at?: string
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

  async function updateRegistration(regId: string, payload: Record<string, unknown>) {
    setUpdatingId(regId)
    await fetch(`/api/dropin/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_id: regId, ...payload }),
    })
    setUpdatingId(null)
    onRefresh()
  }

  async function toggleCheckin(regId: string, current: boolean) {
    await updateRegistration(regId, { checked_in: !current })
  }

  async function moveWithinList(regId: string, direction: 'up' | 'down') {
    await updateRegistration(regId, { move_direction: direction })
  }

  async function moveBetweenLists(regId: string, toWaitlist: boolean) {
    await updateRegistration(regId, { move_waitlist: toWaitlist })
  }

  // Group guests with their hosts
  const hosts = registrations.filter(r => !r.is_guest)
  const guests = registrations.filter(r => r.is_guest)
  const rosterHosts = hosts.filter((r) => !r.is_waitlist)
  const waitlistHosts = hosts.filter((r) => !!r.is_waitlist)

  function getGuestsForHost(hostId: string) {
    return guests.filter(g => g.host_registration_id === hostId)
  }

  function renderHostRow(reg: Registration, rank: number, inWaitlist: boolean, listLen: number) {
    const hostGuests = getGuestsForHost(reg.id)
    return (
      <div key={reg.id}>
        <div className="card-sm dropin-checkin-host-card" style={{
          borderColor: reg.checked_in ? '#bbf7d0' : 'var(--border)',
          background: reg.checked_in ? '#f9fff9' : 'var(--bg-surface)',
          borderRadius: hostGuests.length > 0 ? '10px 10px 0 0' : '10px',
        }}>
          <div className="dropin-checkin-host-meta">
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', flexShrink: 0 }}>
              #{rank}
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: reg.checked_in ? '#bbf7d0' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', flexShrink: 0 }}>
              {reg.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{reg.full_name}</span>
                {hostGuests.length > 0 && (
                  <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', borderRadius: '99px', fontSize: '10px', fontWeight: '600', padding: '2px 8px' }}>
                    +{hostGuests.length} guest{hostGuests.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {reg.positions && reg.positions.length > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {reg.positions.join(', ')}
                </div>
              )}
            </div>
          </div>
          <div className="dropin-checkin-actions">
            <button
              type="button"
              onClick={() => moveWithinList(reg.id, 'up')}
              disabled={updatingId === reg.id || rank <= 1}
              className="dropin-action-btn"
              aria-label="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveWithinList(reg.id, 'down')}
              disabled={updatingId === reg.id || rank >= listLen}
              className="dropin-action-btn"
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => moveBetweenLists(reg.id, !inWaitlist)}
              disabled={updatingId === reg.id}
              className="dropin-action-btn"
            >
              {inWaitlist ? 'To roster' : 'To waitlist'}
            </button>
            {reg.checked_in ? (
              <span style={{ background: '#f0fdf4', color: '#16a34a', border: '0.5px solid #bbf7d0', borderRadius: '8px', fontSize: '12px', fontWeight: '700', padding: '8px 12px', minHeight: '40px', display: 'inline-flex', alignItems: 'center' }}>Here</span>
            ) : (
              <>
                <button type="button" onClick={() => toggleCheckin(reg.id, reg.checked_in)} disabled={updatingId === reg.id}
                  style={{ background: 'var(--accent)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', padding: '8px 12px', minHeight: '40px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Here
                </button>
                <button type="button" onClick={() => toggleCheckin(reg.id, true)} disabled={updatingId === reg.id}
                  style={{ background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: '700', padding: '8px 12px', minHeight: '40px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  No-show
                </button>
              </>
            )}
          </div>
        </div>
        {hostGuests.map((guest, idx) => (
          <div key={guest.id} className="card-sm dropin-checkin-guest-row" style={{
            borderColor: guest.checked_in ? '#bbf7d0' : 'var(--border)',
            background: guest.checked_in ? '#f9fff9' : 'var(--bg-elevated)',
            borderRadius: idx === hostGuests.length - 1 ? '0 0 10px 10px' : '0',
            borderTop: 'none',
            paddingLeft: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', flexShrink: 0, border: '1px dashed var(--border)' }}>
                {guest.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{guest.full_name}</span>
                  <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', borderRadius: '99px', fontSize: '9px', fontWeight: '600', padding: '2px 7px' }}>Guest</span>
                </div>
              </div>
            </div>
            <div className="dropin-checkin-guest-actions">
              {guest.checked_in ? (
                <span style={{ background: '#f0fdf4', color: '#16a34a', border: '0.5px solid #bbf7d0', borderRadius: '8px', fontSize: '11px', fontWeight: '700', padding: '8px 12px', minHeight: '40px', display: 'inline-flex', alignItems: 'center' }}>Here</span>
              ) : (
                <>
                  <button type="button" onClick={() => toggleCheckin(guest.id, guest.checked_in)} disabled={updatingId === guest.id}
                    style={{ background: 'var(--accent)', color: 'var(--btn-primary-text)', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', padding: '8px 12px', minHeight: '40px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Here
                  </button>
                  <button type="button" onClick={() => toggleCheckin(guest.id, true)} disabled={updatingId === guest.id}
                    style={{ background: '#fef2f2', color: '#dc2626', border: '0.5px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: '700', padding: '8px 12px', minHeight: '40px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    No-show
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (registrations.length === 0) return (
    <div className="empty-state">
      <div className="empty-state-icon"><Users size={32} strokeWidth={1.5} /></div>
      <div className="empty-state-title">No registrations yet</div>
      <div className="empty-state-desc">Players will appear here once they sign up.</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
          Roster ({rosterHosts.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rosterHosts.length === 0 ? (
            <div className="card-sm" style={{ color: 'var(--text-muted)' }}>No players in roster yet.</div>
          ) : (
            rosterHosts.map((reg, i) => renderHostRow(reg, i + 1, false, rosterHosts.length))
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
          Waitlist ({waitlistHosts.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {waitlistHosts.length === 0 ? (
            <div className="card-sm" style={{ color: 'var(--text-muted)' }}>No one on the waitlist.</div>
          ) : (
            waitlistHosts.map((reg, i) => renderHostRow(reg, i + 1, true, waitlistHosts.length))
          )}
        </div>
      </div>
    </div>
  )
}