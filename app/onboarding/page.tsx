'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Lock } from 'lucide-react'

export default function OnboardingPage() {
  const { isLoaded } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '' })

  if (!isLoaded) return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', fontSize: '14px',
    }}>
      Loading...
    </div>
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return }
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          background: 'var(--sidebar-bg)',
          padding: '16px 24px',
          borderBottom: '0.5px solid var(--sidebar-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '26px', height: '26px',
            background: 'var(--logo-bg)',
            borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--btn-primary-text)', letterSpacing: '0.06em' }}>ML</span>
          </div>
          <span style={{
            fontSize: '12px', fontWeight: '800',
            color: 'var(--sidebar-text-active)',
            letterSpacing: '0.02em',
          }}>
            MYLEAGUEPORTAL
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 24px' }}>
          <h1 style={{
            fontSize: '20px', fontWeight: '800',
            color: 'var(--text-primary)', marginBottom: '6px',
          }}>
            Welcome to MyLeaguePortal. Let&apos;s set up your league.
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            This takes less than a minute.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* League Name */}
            <div>
              <label className="label">League Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Vancouver Pro-Am Basketball"
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                className="input"
              />
            </div>

            {/* URL preview */}
            <div>
              <label className="label">Your Registration URL</label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: '0.5px solid var(--border)',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'var(--bg-elevated)',
                opacity: 0.7,
              }}>
                <span style={{
                  background: 'var(--bg-elevated)',
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  borderRight: '0.5px solid var(--border)',
                  flexShrink: 0,
                }}>/join/</span>
                <span style={{
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  flex: 1,
                }}>auto-assigned on Basic plan</span>
                <span style={{ padding: '0 12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} aria-hidden>
                  <Lock size={14} strokeWidth={2} />
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Upgrade to Pro to set a custom, memorable URL
              </p>
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
              disabled={loading || !form.name}
              className="btn-primary"
              style={{
                width: '100%', justifyContent: 'center',
                padding: '11px', fontSize: '14px',
              }}
            >
              {loading ? 'Setting up your league...' : 'Create My League →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}