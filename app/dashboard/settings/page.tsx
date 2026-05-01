'use client'

import { useState, useEffect } from 'react'
import ThemeSelector from './ThemeSelector'

interface OrgSettings {
  name: string
  slug: string
  primary_color: string
  plan: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    primary_color: '#5a7a2a',
  })

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setSettings(data.org)
    setForm({
      name: data.org?.name || '',
      slug: data.org?.slug || '',
      primary_color: data.org?.primary_color || '#5a7a2a',
    })
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong'); setSaving(false); return }
    setSuccess(true)
    setSaving(false)
    fetchSettings()
    setTimeout(() => setSuccess(false), 3000)
  }

  async function handleUpgrade() {
    setUpgrading(true)
    const targetPlan = settings?.plan === 'basic' ? 'pro' : 'enterprise'
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: targetPlan }),
    })
    const data = await res.json()
    if (data.url) { window.location.href = data.url }
    else { setError('Failed to start checkout.'); setUpgrading(false) }
  }

  async function handleBillingPortal() {
    setUpgrading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) { window.location.href = data.url }
    else { setError('Failed to open billing portal.'); setUpgrading(false) }
  }

  const planFeatures: Record<string, string[]> = {
    basic: ['50 players max', '1 active season', 'Standard branding', 'Basic roster management'],
    pro: ['150 players max', '3 concurrent seasons', 'Custom logo & colors', 'Waitlist automation', 'Live scoring table'],
    enterprise: ['Unlimited players & seasons', 'Full white-label', 'Multi-admin access', 'Native live streaming', 'AI Co-Pilot (Beta)'],
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
      Loading settings...
    </div>
  )

  return (
    <div style={{ maxWidth: '640px' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your league profile and subscription</p>
      </div>

      {/* Current Plan */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <span className="label">Current Plan</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`badge badge-${settings?.plan || 'basic'}`}>
              {settings?.plan || 'basic'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {settings?.plan === 'basic' ? 'Free' : settings?.plan === 'pro' ? '$49/month' : '$149/month'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {settings?.plan !== 'enterprise' && (
              <button className="btn-primary" onClick={handleUpgrade} disabled={upgrading}
                style={{ fontSize: '12px', padding: '7px 14px' }}>
                {upgrading ? 'Loading...' : 'Upgrade Plan'}
              </button>
            )}
            {settings?.plan !== 'basic' && (
              <button className="btn-secondary" onClick={handleBillingPortal} disabled={upgrading}
                style={{ fontSize: '12px', padding: '7px 14px' }}>
                Manage Billing
              </button>
            )}
          </div>
        </div>
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: '8px',
          padding: '12px 16px',
          border: '0.5px solid var(--border)',
        }}>
          <span className="label" style={{ marginBottom: '8px' }}>Your plan includes</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {planFeatures[settings?.plan || 'basic'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent)', fontWeight: '700' }}>✓</span>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* League Profile */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <span className="label" style={{ display: 'block', marginBottom: '16px' }}>League Profile</span>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Name */}
          <div>
            <label className="label">League Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="label">
              Registration URL
              {settings?.plan === 'basic' && (
                <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                  (Pro feature — upgrade to customize)
                </span>
              )}
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '0.5px solid var(--border)',
              borderRadius: '8px',
              overflow: 'hidden',
              background: settings?.plan === 'basic' ? 'var(--bg-elevated)' : 'var(--input-bg)',
              opacity: settings?.plan === 'basic' ? 0.7 : 1,
            }}>
              <span style={{
                background: 'var(--bg-elevated)',
                padding: '9px 12px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                borderRight: '0.5px solid var(--border)',
                flexShrink: 0,
              }}>/join/</span>
              <input
                type="text"
                required
                value={form.slug}
                readOnly={settings?.plan === 'basic'}
                onChange={(e) => {
                  if (settings?.plan === 'basic') return
                  setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
                }}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              {settings?.plan === 'basic' && (
                <span style={{ padding: '0 12px', color: 'var(--text-muted)', fontSize: '13px' }}>🔒</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`myleagueportal.com/join/${form.slug}`)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              style={{
                marginTop: '6px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--accent)',
                fontWeight: '600',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {copied ? '✓ Copied!' : '📋 Copy registration link'}
            </button>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {settings?.plan === 'basic'
                ? 'Upgrade to Pro to set a custom, memorable URL'
                : `Players register at: myleagueportal.com/join/${form.slug}`}
            </p>
          </div>

          {/* Brand Color */}
          <div>
            <label className="label">
              Brand Color
              {settings?.plan === 'basic' && (
                <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                  (Pro feature)
                </span>
              )}
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              opacity: settings?.plan === 'basic' ? 0.5 : 1,
              pointerEvents: settings?.plan === 'basic' ? 'none' : 'auto',
            }}>
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                disabled={settings?.plan === 'basic'}
                style={{
                  width: '44px',
                  height: '36px',
                  borderRadius: '6px',
                  border: '0.5px solid var(--border)',
                  cursor: 'pointer',
                  background: 'none',
                  padding: '2px',
                }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Applied to your public registration page
              </span>
            </div>
          </div>

          {/* Feedback */}
          {success && (
            <div style={{
              background: '#f0fdf4',
              border: '0.5px solid #bbf7d0',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '13px',
              color: '#16a34a',
              fontWeight: '600',
            }}>
              ✓ Settings saved successfully!
            </div>
          )}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '0.5px solid #fecaca',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '13px',
              color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary"
            style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Theme */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <span className="label">Dashboard Theme</span>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Choose how your dashboard looks
          </p>
        </div>
        <ThemeSelector plan={settings?.plan || 'basic'} />
      </div>

      {/* Danger Zone */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid #fecaca',
        borderRadius: '12px',
        padding: '20px 24px',
      }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#dc2626', marginBottom: '4px' }}>
          Danger Zone
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          These actions are permanent and cannot be undone.
        </p>
        <button
          onClick={() => alert('Please contact support to delete your account.')}
          className="btn-danger"
          style={{ fontSize: '12px', padding: '7px 14px' }}
        >
          Delete League & Account
        </button>
      </div>
    </div>
  )
}