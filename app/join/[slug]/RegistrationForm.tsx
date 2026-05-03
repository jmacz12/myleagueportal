'use client'

import { useState } from 'react'

interface Props {
  organizationId: string
  seasonId: string
  leagueName: string
  primaryColor?: string
  maxGuests?: number
  waiverTitle?: string | null
  waiverText?: string | null
  waiverId?: string | null
}

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C']

const DEFAULT_WAIVER_TITLE = 'Liability Waiver'
const DEFAULT_WAIVER_TEXT = 'I acknowledge that participation in sports activities involves risk of injury. I voluntarily assume all risks and release the organizer from liability for any injuries sustained during participation.'

export default function RegistrationForm({
  organizationId,
  seasonId,
  leagueName,
  primaryColor,
  maxGuests = 1,
  waiverTitle,
  waiverText,
  waiverId,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', jersey_number: '',
    positions: [] as string[],
  })
  const [guests, setGuests] = useState<{ full_name: string; email: string; waiver_accepted: boolean }[]>([])
  const [waiverAccepted, setWaiverAccepted] = useState(false)

  const accent = primaryColor || '#5a7a2a'
  const displayWaiverTitle = waiverTitle || DEFAULT_WAIVER_TITLE
  const displayWaiverText = waiverText || DEFAULT_WAIVER_TEXT

  function togglePosition(pos: string) {
    setForm(f => ({
      ...f,
      positions: f.positions.includes(pos)
        ? f.positions.filter(p => p !== pos)
        : [...f.positions, pos],
    }))
  }

  function addGuest() {
    if (guests.length >= maxGuests) return
    setGuests([...guests, { full_name: '', email: '', waiver_accepted: false }])
  }

  function updateGuest(idx: number, field: string, value: string | boolean) {
    setGuests(guests.map((g, i) => i === idx ? { ...g, [field]: value } : g))
  }

  function removeGuest(idx: number) {
    setGuests(guests.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!waiverAccepted) { setError('You must accept the liability waiver to register.'); return }
    if (guests.some(g => !g.waiver_accepted)) { setError('All guests must accept the waiver.'); return }
    if (guests.some(g => !g.full_name)) { setError('Please enter a name for all guests.'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          organization_id: organizationId,
          season_id: seasonId,
          waiver_accepted: waiverAccepted,
          waiver_id: waiverId || null,
          guests,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return }
      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: '#f8f6f0', border: '0.5px solid #d4c9a8',
    borderRadius: '8px', padding: '10px 14px', fontSize: '14px',
    color: '#1a1a0a', fontFamily: 'inherit', outline: 'none',
  }
  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: '700' as const,
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
    color: '#9a8c6a', marginBottom: '6px',
  }

  if (success) return (
    <div style={{ background: 'white', border: '0.5px solid #d4c9a8', borderRadius: '14px', padding: '40px 24px', textAlign: 'center', marginBottom: '24px' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
      <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1a1a0a', marginBottom: '8px' }}>You're registered!</h2>
      <p style={{ fontSize: '14px', color: '#9a8c6a', lineHeight: '1.6' }}>
        Welcome to {leagueName}! The organizer will be in touch with next steps.
        {guests.length > 0 && ` Your ${guests.length} guest${guests.length > 1 ? 's are' : ' is'} also registered.`}
      </p>
    </div>
  )

  return (
    <div style={{ background: 'white', border: '0.5px solid #d4c9a8', borderRadius: '14px', padding: '24px', marginBottom: '24px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#1a1a0a', marginBottom: '20px' }}>Register to Play</h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        <div>
          <label style={labelStyle}>Full Name *</label>
          <input type="text" required placeholder="John Smith"
            value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Email Address</label>
          <input type="email" placeholder="john@example.com"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Phone Number</label>
          <input type="tel" placeholder="604-555-0123"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Jersey # (optional)</label>
            <input type="number" min="0" max="99" placeholder="23"
              value={form.jersey_number} onChange={(e) => setForm({ ...form, jersey_number: e.target.value })}
              style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Position(s)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
              {POSITIONS.map(pos => (
                <button key={pos} type="button" onClick={() => togglePosition(pos)}
                  style={{
                    padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700',
                    border: form.positions.includes(pos) ? `1.5px solid ${accent}` : '0.5px solid #d4c9a8',
                    background: form.positions.includes(pos) ? accent : 'transparent',
                    color: form.positions.includes(pos) ? 'white' : '#6b5e3a',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  {pos}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Waiver — shows org's real waiver if set, falls back to default */}
        <div style={{ background: '#f8f6f0', border: '0.5px solid #d4c9a8', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9a8c6a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
            {displayWaiverTitle}
          </div>
          <div style={{ fontSize: '11px', color: '#6b5e3a', lineHeight: '1.5', marginBottom: '10px', maxHeight: '120px', overflowY: 'auto' }}>
            {displayWaiverText}
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={waiverAccepted} onChange={(e) => setWaiverAccepted(e.target.checked)}
              style={{ marginTop: '2px', accentColor: accent, width: '14px', height: '14px', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#1a1a0a', fontWeight: '600' }}>
              I have read and accept the liability waiver
            </span>
          </label>
        </div>

        {/* Guests */}
        {maxGuests > 0 && (
          <div style={{ border: '0.5px solid #d4c9a8', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#f8f6f0', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#1a1a0a' }}>Bringing guests?</div>
                <div style={{ fontSize: '10px', color: '#9a8c6a', marginTop: '1px' }}>
                  You can bring up to {maxGuests} guest{maxGuests > 1 ? 's' : ''}. Each guest must accept the waiver.
                </div>
              </div>
              {guests.length < maxGuests && (
                <button type="button" onClick={addGuest}
                  style={{ background: accent, color: 'white', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  + Add Guest
                </button>
              )}
            </div>

            {guests.map((guest, idx) => (
              <div key={idx} style={{ padding: '12px 14px', borderTop: '0.5px solid #d4c9a8', background: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1a1a0a' }}>Guest {idx + 1}</span>
                  <button type="button" onClick={() => removeGuest(idx)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '16px', cursor: 'pointer', padding: '0', fontWeight: '700' }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input type="text" required placeholder="Guest full name"
                    value={guest.full_name} onChange={(e) => updateGuest(idx, 'full_name', e.target.value)}
                    style={{ ...inputStyle, fontSize: '12px', padding: '8px 12px' }} />
                  <input type="email" placeholder="Guest email (for waiver)"
                    value={guest.email} onChange={(e) => updateGuest(idx, 'email', e.target.value)}
                    style={{ ...inputStyle, fontSize: '12px', padding: '8px 12px' }} />
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={guest.waiver_accepted}
                      onChange={(e) => updateGuest(idx, 'waiver_accepted', e.target.checked)}
                      style={{ marginTop: '2px', accentColor: accent, width: '14px', height: '14px', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: '#1a1a0a', fontWeight: '600' }}>
                      Guest accepts the liability waiver
                    </span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || !form.full_name || !waiverAccepted}
          style={{
            width: '100%', background: loading || !form.full_name || !waiverAccepted ? '#9a8c6a' : accent,
            color: 'white', border: 'none', borderRadius: '8px', padding: '12px',
            fontSize: '14px', fontWeight: '700', cursor: loading || !form.full_name || !waiverAccepted ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'background 0.15s',
          }}>
          {loading ? 'Registering...' : `Register Now${guests.length > 0 ? ` + ${guests.length} Guest${guests.length > 1 ? 's' : ''}` : ''} →`}
        </button>
      </form>
    </div>
  )
}