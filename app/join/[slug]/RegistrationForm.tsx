'use client'

import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { ThemePreset } from '@/lib/leagueTheme'
import { contrastTextForAccent } from '@/lib/leagueTheme'
import { DEFAULT_SPORT_TEMPLATE_ID, positionsForSportTemplate } from '@/lib/sport-templates'

interface Props {
  organizationId: string
  seasonId: string
  leagueName: string
  primaryColor?: string
  /** When set, form chrome matches league home / join hub theme tokens */
  preset?: ThemePreset | null
  /** Season registration: false — each player registers individually */
  showGuests?: boolean
  /** Long waivers: read full text in a modal with Accept / Decline */
  waiverLayout?: 'inline' | 'modal'
  waiverTitle?: string | null
  waiverText?: string | null
  waiverId?: string | null
  /** Season registration position chips; defaults to basketball if omitted */
  positionOptions?: string[]
}

const DEFAULT_WAIVER_TITLE = 'Liability Waiver'
const DEFAULT_WAIVER_TEXT = 'I acknowledge that participation in sports activities involves risk of injury. I voluntarily assume all risks and release the organizer from liability for any injuries sustained during participation.'

export default function RegistrationForm({
  organizationId,
  seasonId,
  leagueName,
  primaryColor,
  preset,
  showGuests = true,
  waiverLayout = 'inline',
  waiverTitle,
  waiverText,
  waiverId,
  positionOptions,
}: Props) {
  const positionChipOptions = positionOptions ?? positionsForSportTemplate(DEFAULT_SPORT_TEMPLATE_ID)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    positions: [] as string[],
  })
  const [guests, setGuests] = useState<{ full_name: string; email: string; waiver_accepted: boolean }[]>([])
  const [waiverAccepted, setWaiverAccepted] = useState(false)
  const [waiverModalOpen, setWaiverModalOpen] = useState(false)

  const accent = preset?.accent ?? primaryColor ?? '#5a7a2a'
  const surfaceBorder = preset?.surfaceBorder ?? '#d4c9a8'
  const headingCol = preset?.heading ?? '#1a1a0a'
  const mutedCol = preset?.muted ?? '#9a8c6a'
  const bodyCol = preset?.body ?? '#6b5e3a'
  const inputBg = preset?.accentSoftBg ?? '#f8f6f0'
  const surfaceBg = preset?.surfaceBg ?? '#ffffff'
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
    if (!showGuests || guests.length >= 8) return
    setGuests([...guests, { full_name: '', email: '', waiver_accepted: false }])
  }

  function updateGuest(idx: number, field: string, value: string | boolean) {
    setGuests(guests.map((g, i) => i === idx ? { ...g, [field]: value } : g))
  }

  function removeGuest(idx: number) {
    setGuests(guests.filter((_, i) => i !== idx))
  }

  function sanitizePhone(value: string): string {
    return value.replace(/\D/g, '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!waiverAccepted) { setError('You must accept the liability waiver to register.'); return }
    if (positionChipOptions.length > 0 && form.positions.length === 0) {
      setError('Pick at least one position you play.')
      return
    }
    if (showGuests) {
      if (guests.some(g => !g.waiver_accepted)) { setError('All guests must accept the waiver.'); return }
      if (guests.some(g => !g.full_name)) { setError('Please enter a name for all guests.'); return }
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          jersey_number: null,
          organization_id: organizationId,
          season_id: seasonId,
          waiver_accepted: waiverAccepted,
          waiver_id: waiverId || null,
          guests: showGuests ? guests : [],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detail = typeof data.detail === 'string' && data.detail ? ` (${data.detail})` : ''
        setError((data.error || 'Something went wrong') + detail)
        setLoading(false)
        return
      }
      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: inputBg,
    border: `0.5px solid ${surfaceBorder}`,
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    color: headingCol,
    fontFamily: 'inherit',
    outline: 'none',
  }
  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    color: mutedCol,
    marginBottom: '6px',
  }

  if (success) {
    return (
      <div
        style={{
          background: surfaceBg,
          border: `0.5px solid ${surfaceBorder}`,
          borderRadius: '14px',
          padding: '40px 24px',
          textAlign: 'center',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: accent }}>
          <CheckCircle2 size={48} strokeWidth={1.5} aria-hidden />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: headingCol, marginBottom: '8px' }}>You&apos;re registered</h2>
        <p style={{ fontSize: '14px', color: mutedCol, lineHeight: 1.6 }}>
          Welcome to {leagueName}! The organizer will be in touch with next steps.
          {showGuests && guests.length > 0 && ` Your ${guests.length} guest${guests.length > 1 ? 's are' : ' is'} also registered.`}
        </p>
      </div>
    )
  }

  return (
    <>
      {waiverModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="waiver-modal-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setWaiverModalOpen(false) }}
        >
          <div style={{
            background: surfaceBg,
            borderRadius: '14px',
            maxWidth: '440px', width: '100%', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
            border: `1px solid ${surfaceBorder}`,
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          }}>
            <div style={{ padding: '16px 18px', borderBottom: `1px solid ${surfaceBorder}`, flexShrink: 0 }}>
              <h2 id="waiver-modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: headingCol }}>
                {displayWaiverTitle}
              </h2>
            </div>
            <div style={{
              padding: '14px 18px',
              overflowY: 'auto',
              flex: 1,
              fontSize: '13px',
              color: '#4a4428',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}>
              {displayWaiverText}
            </div>
            <div style={{
              padding: '14px 18px',
              borderTop: `1px solid ${surfaceBorder}`,
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}>
              <button
                type="button"
                onClick={() => {
                  setWaiverAccepted(false)
                  setWaiverModalOpen(false)
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${surfaceBorder}`,
                  background: surfaceBg,
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: bodyCol,
                }}
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => {
                  setWaiverAccepted(true)
                  setWaiverModalOpen(false)
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: accent,
                  color: contrastTextForAccent(accent),
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: surfaceBg, border: `0.5px solid ${surfaceBorder}`, borderRadius: '14px', padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 800, color: headingCol, marginBottom: '20px' }}>Register to Play</h2>

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
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="6045550123"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: sanitizePhone(e.target.value) })}
              style={inputStyle} />
          </div>

          {positionChipOptions.length > 0 ? (
            <div>
              <label style={labelStyle}>Position(s) *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                {positionChipOptions.map((pos) => (
                  <button key={pos} type="button" onClick={() => togglePosition(pos)}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700',
                      border: form.positions.includes(pos) ? `1.5px solid ${accent}` : `0.5px solid ${surfaceBorder}`,
                      background: form.positions.includes(pos) ? accent : 'transparent',
                      color: form.positions.includes(pos) ? contrastTextForAccent(accent) : bodyCol,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Waiver */}
          {waiverLayout === 'modal' ? (
            <div style={{ background: inputBg, border: `0.5px solid ${surfaceBorder}`, borderRadius: '8px', padding: '14px 14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: headingCol, marginBottom: '8px' }}>
                {displayWaiverTitle}
              </div>
              <p style={{ fontSize: '12px', color: mutedCol, margin: '0 0 12px', lineHeight: 1.45 }}>
                Tap below to read the full text. You must accept to register.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setWaiverModalOpen(true)}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${accent}`,
                    background: 'white',
                    color: accent,
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Read full waiver
                </button>
                {waiverAccepted ? (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>Accepted</span>
                ) : (
                  <span style={{ fontSize: '12px', color: mutedCol }}>Not accepted yet</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: inputBg, border: `0.5px solid ${surfaceBorder}`, borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: mutedCol, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
                {displayWaiverTitle}
              </div>
              <div style={{ fontSize: '11px', color: bodyCol, lineHeight: 1.5, marginBottom: '10px', maxHeight: '120px', overflowY: 'auto' }}>
                {displayWaiverText}
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={waiverAccepted} onChange={(e) => setWaiverAccepted(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: accent, width: '14px', height: '14px', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: headingCol, fontWeight: 600 }}>
                  I have read and accept the liability waiver
                </span>
              </label>
            </div>
          )}

          {/* Guests — season flow hides this */}
          {showGuests && (
            <div style={{ border: '0.5px solid #d4c9a8', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#f8f6f0', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#1a1a0a' }}>Bringing guests?</div>
                  <div style={{ fontSize: '10px', color: '#9a8c6a', marginTop: '1px' }}>
                    Each guest must accept the waiver.
                  </div>
                </div>
                <button type="button" onClick={addGuest}
                  style={{ background: accent, color: contrastTextForAccent(accent), border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  + Add Guest
                </button>
              </div>

              {guests.map((guest, idx) => (
                <div key={idx} style={{ padding: '12px 14px', borderTop: `0.5px solid ${surfaceBorder}`, background: surfaceBg }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: headingCol }}>Guest {idx + 1}</span>
                    <button type="button" onClick={() => removeGuest(idx)} aria-label="Remove guest"
                      style={{
                        background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer',
                        padding: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '6px',
                      }}>
                      <X size={16} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input type="text" required placeholder="Guest full name"
                      value={guest.full_name} onChange={(e) => updateGuest(idx, 'full_name', e.target.value)}
                      style={{ ...inputStyle, fontSize: '12px', padding: '8px 12px' }} />
                    <input type="email" placeholder="Guest email (optional)"
                      value={guest.email} onChange={(e) => updateGuest(idx, 'email', e.target.value)}
                      style={{ ...inputStyle, fontSize: '12px', padding: '8px 12px' }} />
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={guest.waiver_accepted}
                        onChange={(e) => updateGuest(idx, 'waiver_accepted', e.target.checked)}
                        style={{ marginTop: '2px', accentColor: accent, width: '14px', height: '14px', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: headingCol, fontWeight: 600 }}>
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
              width: '100%',
              background: loading || !form.full_name || !waiverAccepted ? mutedCol : accent,
              color: loading || !form.full_name || !waiverAccepted ? contrastTextForAccent(mutedCol) : contrastTextForAccent(accent),
              border: 'none', borderRadius: '8px', padding: '12px',
              fontSize: '14px', fontWeight: 700,
              cursor: loading || !form.full_name || !waiverAccepted ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'background 0.15s',
            }}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
      </div>
    </>
  )
}
