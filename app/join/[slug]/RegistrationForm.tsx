'use client'

import { useState } from 'react'

interface Props {
  organizationId: string
  seasonId: string
  leagueName: string
  primaryColor?: string
}

export default function RegistrationForm({ organizationId, seasonId, leagueName, primaryColor }: Props) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', jersey_number: '', position: '',
  })

  const accent = primaryColor || '#5a7a2a'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, organization_id: organizationId, season_id: seasonId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return }
      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{
        background: 'white',
        border: '0.5px solid #e2e8f0',
        borderRadius: '14px',
        padding: '40px 24px',
        textAlign: 'center',
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1a1a0a', marginBottom: '8px' }}>
          You're registered!
        </h2>
        <p style={{ fontSize: '14px', color: '#9a8c6a', lineHeight: '1.6' }}>
          Welcome to {leagueName}! The organizer will be in touch with next steps.
        </p>
      </div>
    )
  }

  const inputStyle = {
    width: '100%',
    background: '#f8f6f0',
    border: '0.5px solid #d4c9a8',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    color: '#1a1a0a',
    fontFamily: 'inherit',
    outline: 'none',
    marginBottom: '2px',
  }

  const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
    color: '#9a8c6a',
    marginBottom: '6px',
  }

  return (
    <div style={{
      background: 'white',
      border: '0.5px solid #d4c9a8',
      borderRadius: '14px',
      padding: '24px',
      marginBottom: '24px',
    }}>
      <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#1a1a0a', marginBottom: '20px' }}>
        Register to Play
      </h2>

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
            <label style={labelStyle}>Position (optional)</label>
            <select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
              style={{ ...inputStyle, appearance: 'none' as any }}>
              <option value="">Select...</option>
              <option value="PG">Point Guard</option>
              <option value="SG">Shooting Guard</option>
              <option value="SF">Small Forward</option>
              <option value="PF">Power Forward</option>
              <option value="C">Center</option>
            </select>
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2', border: '0.5px solid #fecaca',
            borderRadius: '8px', padding: '12px 14px',
            fontSize: '13px', color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !form.full_name}
          style={{
            width: '100%',
            background: loading || !form.full_name ? '#9a8c6a' : accent,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: loading || !form.full_name ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Registering...' : 'Register Now →'}
        </button>

      </form>
    </div>
  )
}