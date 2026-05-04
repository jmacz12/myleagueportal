'use client'

import { useState, useEffect } from 'react'
import ThemeSelector from './ThemeSelector'

interface OrgSettings {
  name: string
  slug: string
  primary_color: string
  plan: string
  news_banner?: string | null
}

interface WaiverData {
  id?: string
  title: string
  content: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', primary_color: '#5a7a2a', news_banner: '' })
  const [activeWaiverTab, setActiveWaiverTab] = useState<'season' | 'dropin' | null>(null)

  // Season waiver state
  const [seasonWaiver, setSeasonWaiver] = useState<WaiverData | null>(null)
  const [seasonWaiverForm, setSeasonWaiverForm] = useState({ title: 'Liability Waiver', content: '' })
  const [seasonWaiverSaving, setSeasonWaiverSaving] = useState(false)
  const [seasonWaiverSuccess, setSeasonWaiverSuccess] = useState(false)
  const [seasonWaiverMode, setSeasonWaiverMode] = useState<'type' | 'upload'>('type')
  const [seasonExtracting, setSeasonExtracting] = useState(false)
  const [seasonNeedsVerification, setSeasonNeedsVerification] = useState(false)
  const [seasonExtractError, setSeasonExtractError] = useState('')

  // Drop-in waiver state
  const [dropinWaiver, setDropinWaiver] = useState<WaiverData | null>(null)
  const [dropinWaiverForm, setDropinWaiverForm] = useState({ title: 'Drop-in Liability Waiver', content: '' })
  const [dropinWaiverSaving, setDropinWaiverSaving] = useState(false)
  const [dropinWaiverSuccess, setDropinWaiverSuccess] = useState(false)
  const [dropinWaiverMode, setDropinWaiverMode] = useState<'type' | 'upload'>('type')
  const [dropinExtracting, setDropinExtracting] = useState(false)
  const [dropinNeedsVerification, setDropinNeedsVerification] = useState(false)
  const [dropinExtractError, setDropinExtractError] = useState('')

  useEffect(() => { fetchSettings(); fetchWaivers() }, [])

  async function fetchSettings() {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setSettings(data.org)
    setForm({
      name: data.org?.name || '',
      slug: data.org?.slug || '',
      primary_color: data.org?.primary_color || '#5a7a2a',
      news_banner: data.org?.news_banner || '',
    })
    setLoading(false)
  }

  async function fetchWaivers() {
    const res = await fetch('/api/waiver')
    const data = await res.json()
    if (data.season) {
      setSeasonWaiver(data.season)
      setSeasonWaiverForm({ title: data.season.title, content: data.season.content })
    }
    if (data.dropin) {
      setDropinWaiver(data.dropin)
      setDropinWaiverForm({ title: data.dropin.title, content: data.dropin.content })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess(false)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong'); setSaving(false); return }
    setSuccess(true); setSaving(false)
    fetchSettings()
    setTimeout(() => setSuccess(false), 3000)
  }

  async function saveWaiver(type: 'season' | 'dropin', waiverForm: { title: string; content: string }, verified = false) {
    const res = await fetch('/api/waiver', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...waiverForm, type, verified }),
    })
    return res.ok
  }

  async function handleSeasonWaiverSave() {
    setSeasonWaiverSaving(true)
    const ok = await saveWaiver('season', seasonWaiverForm)
    if (ok) { setSeasonWaiverSuccess(true); fetchWaivers(); setTimeout(() => setSeasonWaiverSuccess(false), 3000) }
    setSeasonWaiverSaving(false)
  }

  async function handleSeasonWaiverVerify() {
    setSeasonWaiverSaving(true)
    const ok = await saveWaiver('season', seasonWaiverForm, true)
    if (ok) { setSeasonWaiverSuccess(true); setSeasonNeedsVerification(false); fetchWaivers(); setTimeout(() => setSeasonWaiverSuccess(false), 3000) }
    setSeasonWaiverSaving(false)
  }

  async function handleDropinWaiverSave() {
    setDropinWaiverSaving(true)
    const ok = await saveWaiver('dropin', dropinWaiverForm)
    if (ok) { setDropinWaiverSuccess(true); fetchWaivers(); setTimeout(() => setDropinWaiverSuccess(false), 3000) }
    setDropinWaiverSaving(false)
  }

  async function handleDropinWaiverVerify() {
    setDropinWaiverSaving(true)
    const ok = await saveWaiver('dropin', dropinWaiverForm, true)
    if (ok) { setDropinWaiverSuccess(true); setDropinNeedsVerification(false); fetchWaivers(); setTimeout(() => setDropinWaiverSuccess(false), 3000) }
    setDropinWaiverSaving(false)
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'season' | 'dropin') {
    const file = e.target.files?.[0]
    if (!file) return
    if (type === 'season') { setSeasonExtracting(true); setSeasonExtractError('') }
    else { setDropinExtracting(true); setDropinExtractError('') }
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/waiver/extract', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.text) {
        if (type === 'season') { setSeasonWaiverForm(f => ({ ...f, content: data.text })); setSeasonNeedsVerification(true) }
        else { setDropinWaiverForm(f => ({ ...f, content: data.text })); setDropinNeedsVerification(true) }
      } else {
        if (type === 'season') setSeasonExtractError(data.error || 'Could not extract text')
        else setDropinExtractError(data.error || 'Could not extract text')
      }
    } catch {
      if (type === 'season') setSeasonExtractError('Something went wrong. Please try again.')
      else setDropinExtractError('Something went wrong. Please try again.')
    }
    if (type === 'season') setSeasonExtracting(false)
    else setDropinExtracting(false)
    e.target.value = ''
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

  const isPro = settings?.plan === 'pro' || settings?.plan === 'enterprise'

  const planFeatures: Record<string, string[]> = {
    basic: ['50 players max', '1 active season', 'Standard branding', 'Basic roster management'],
    pro: ['150 players max', '3 concurrent seasons', 'Custom logo & colors', 'Waitlist automation', 'Live scoring table'],
    enterprise: ['Unlimited players & seasons', 'Full white-label', 'Multi-admin access', 'Native live streaming', 'AI Co-Pilot (Beta)'],
  }

  function WaiverCard({
    title, description, waiver, waiverForm, setWaiverForm, saving, success,
    mode, setMode, extracting, needsVerification, setNeedsVerification,
    extractError, onSave, onVerify, onUpload, inputId, isPro,
  }: {
    title: string, description: string,
    waiver: WaiverData | null,
    waiverForm: { title: string; content: string },
    setWaiverForm: (f: { title: string; content: string }) => void,
    saving: boolean, success: boolean,
    mode: 'type' | 'upload', setMode: (m: 'type' | 'upload') => void,
    extracting: boolean, needsVerification: boolean,
    setNeedsVerification: (v: boolean) => void,
    extractError: string,
    onSave: () => void, onVerify: () => void,
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
    inputId: string, isPro: boolean,
  }) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{description}</p>
          {isPro && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button type="button" onClick={() => setMode('type')} style={{
                padding: '5px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '6px',
                cursor: 'pointer', fontFamily: 'inherit',
                border: mode === 'type' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                background: mode === 'type' ? 'var(--accent)' : 'transparent',
                color: mode === 'type' ? 'white' : 'var(--text-muted)',
              }}>✏️ Type</button>
              <button type="button" onClick={() => setMode('upload')} style={{
                padding: '5px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '6px',
                cursor: 'pointer', fontFamily: 'inherit',
                border: mode === 'upload' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                background: mode === 'upload' ? 'var(--accent)' : 'transparent',
                color: mode === 'upload' ? 'white' : 'var(--text-muted)',
              }}>📄 Upload PDF</button>
            </div>
          )}
        </div>

        <div style={{ background: '#fffbeb', border: '0.5px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '11px', color: '#92400e', lineHeight: '1.5' }}>
          ⚠️ <strong>Legal Notice:</strong> MyLeaguePortal provides document processing tools for convenience and is not a provider of legal advice. The enforceability of your waiver is the sole responsibility of the League Host.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isPro && mode === 'upload' && (
            <div style={{ border: '1px dashed var(--border)', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Upload your existing PDF waiver — we'll extract the text for you to review
              </p>
              <input type="file" accept=".pdf" onChange={onUpload}
                style={{ display: 'none' }} id={inputId} disabled={extracting} />
              <label htmlFor={inputId} style={{
                display: 'inline-block', padding: '7px 16px', fontSize: '12px', fontWeight: '700',
                borderRadius: '6px', cursor: extracting ? 'not-allowed' : 'pointer',
                background: 'var(--bg-elevated)', border: '0.5px solid var(--border)',
                color: 'var(--text-primary)', fontFamily: 'inherit', opacity: extracting ? 0.6 : 1,
              }}>
                {extracting ? '⏳ Extracting...' : 'Choose PDF File'}
              </label>
              {extracting && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Reading your document...</p>}
              {extractError && <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px' }}>{extractError}</p>}
            </div>
          )}

          <div>
            <label className="label">Waiver Title</label>
            <input type="text" className="input" value={waiverForm.title}
              onChange={(e) => setWaiverForm({ ...waiverForm, title: e.target.value })}
              placeholder="e.g. Liability Waiver & Release" />
          </div>

          <div>
            <label className="label">
              Waiver Text
              {needsVerification && (
                <span style={{ marginLeft: '8px', fontSize: '10px', color: '#d97706', fontWeight: '700' }}>
                  ⚠️ Scroll through and verify before approving
                </span>
              )}
            </label>
            <textarea className="input" rows={8} value={waiverForm.content}
              onChange={(e) => { setWaiverForm({ ...waiverForm, content: e.target.value }); setNeedsVerification(false) }}
              placeholder="Write your waiver here, or upload a PDF above to extract the text automatically."
              style={{ resize: 'vertical', lineHeight: '1.6' }} />
          </div>

          {success && (
            <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>
              ✓ Waiver saved! Players will see this on the registration page.
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {needsVerification ? (
              <button type="button" disabled={saving || !waiverForm.content} onClick={onVerify}
                style={{
                  padding: '9px 16px', fontSize: '13px', fontWeight: '700', borderRadius: '8px',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: '#d97706', color: 'white',
                  opacity: saving || !waiverForm.content ? 0.6 : 1,
                }}>
                {saving ? 'Saving...' : '✓ Verify & Approve Waiver'}
              </button>
            ) : (
              <button type="button" className="btn-primary" disabled={saving || !waiverForm.content} onClick={onSave}>
                {saving ? 'Saving...' : 'Save Waiver'}
              </button>
            )}
            {waiver && !needsVerification && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>✓ Active — showing on registration page</span>
            )}
          </div>

          {!isPro && (
            <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
              🔒 <strong>Pro/Enterprise:</strong> Upload an existing PDF waiver and we'll extract the text automatically.
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading settings...</div>
  )

  return (
    <div style={{ maxWidth: '640px' }}>

      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-title">⚙️ Settings</h1>
        <p className="page-subtitle">Manage your league profile and subscription</p>
      </div>

      {/* Current Plan */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <span className="label">Current Plan</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`badge badge-${settings?.plan || 'basic'}`}>{settings?.plan || 'basic'}</span>
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
        <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px 16px', border: '0.5px solid var(--border)' }}>
          <span className="label" style={{ marginBottom: '8px' }}>Your plan includes</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {planFeatures[settings?.plan || 'basic'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent)', fontWeight: '700' }}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* League Profile */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <span className="label" style={{ display: 'block', marginBottom: '16px' }}>League Profile</span>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label">League Name</label>
            <input type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">
              Registration URL
              {settings?.plan === 'basic' && (
                <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                  (Pro feature — upgrade to customize)
                </span>
              )}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '0.5px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: settings?.plan === 'basic' ? 'var(--bg-elevated)' : 'var(--input-bg)', opacity: settings?.plan === 'basic' ? 0.7 : 1 }}>
              <span style={{ background: 'var(--bg-elevated)', padding: '9px 12px', fontSize: '13px', color: 'var(--text-muted)', borderRight: '0.5px solid var(--border)', flexShrink: 0 }}>/join/</span>
              <input type="text" required value={form.slug} readOnly={settings?.plan === 'basic'}
                onChange={(e) => { if (settings?.plan === 'basic') return; setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }) }}
                style={{ flex: 1, padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
              {settings?.plan === 'basic' && <span style={{ padding: '0 12px', color: 'var(--text-muted)', fontSize: '13px' }}>🔒</span>}
            </div>
            <button type="button" onClick={() => { navigator.clipboard.writeText(`myleagueportal.com/join/${form.slug}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              style={{ marginTop: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)', fontWeight: '600', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {copied ? '✓ Copied!' : '📋 Copy registration link'}
            </button>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {settings?.plan === 'basic' ? 'Upgrade to Pro to set a custom, memorable URL' : `Players register at: myleagueportal.com/join/${form.slug}`}
            </p>
          </div>
          <div>
            <label className="label">
              Brand Color
              {settings?.plan === 'basic' && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>(Pro feature)</span>}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: settings?.plan === 'basic' ? 0.5 : 1, pointerEvents: settings?.plan === 'basic' ? 'none' : 'auto' }}>
              <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                disabled={settings?.plan === 'basic'}
                style={{ width: '44px', height: '36px', borderRadius: '6px', border: '0.5px solid var(--border)', cursor: 'pointer', background: 'none', padding: '2px' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Applied to your public registration page</span>
            </div>
          </div>
          
          {/* NEWS BANNER INPUT ADDED HERE */}
          <div>
            <label className="label">League News Banner</label>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              This message will appear at the top of your Public Registration page and Organizer Dashboard.
            </p>
            <textarea 
              className="input" 
              rows={3} 
              value={form.news_banner || ''}
              onChange={(e) => setForm({ ...form, news_banner: e.target.value })}
              placeholder="e.g., Registration for Summer 2026 is now open! Early bird ends May 15th."
              style={{ resize: 'vertical', lineHeight: '1.6' }} 
            />
          </div>

          {success && <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>✓ Settings saved successfully!</div>}
          {error && <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#dc2626' }}>{error}</div>}
          <button type="submit" disabled={saving} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Theme */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <span className="label">Dashboard Theme</span>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Choose how your dashboard looks</p>
        </div>
        <ThemeSelector plan={settings?.plan || 'basic'} />
      </div>

      {/* Waiver */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: activeWaiverTab ? '16px' : '0' }}>
          <div>
            <span className="label">Liability Waivers</span>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Manage waivers for seasons and drop-ins separately.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => setActiveWaiverTab(activeWaiverTab === 'season' ? null : 'season')} style={{
              padding: '6px 14px', fontSize: '12px', fontWeight: '700', borderRadius: '6px',
              cursor: 'pointer', fontFamily: 'inherit',
              border: activeWaiverTab === 'season' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
              background: activeWaiverTab === 'season' ? 'var(--accent)' : 'transparent',
              color: activeWaiverTab === 'season' ? 'white' : 'var(--text-muted)',
            }}>📅 Season</button>
            <button type="button" onClick={() => setActiveWaiverTab(activeWaiverTab === 'dropin' ? null : 'dropin')} style={{
              padding: '6px 14px', fontSize: '12px', fontWeight: '700', borderRadius: '6px',
              cursor: 'pointer', fontFamily: 'inherit',
              border: activeWaiverTab === 'dropin' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
              background: activeWaiverTab === 'dropin' ? 'var(--accent)' : 'transparent',
              color: activeWaiverTab === 'dropin' ? 'white' : 'var(--text-muted)',
            }}>🎲 Drop-in</button>
          </div>
        </div>

        {activeWaiverTab !== null && (
          <div>
            {activeWaiverTab === 'season' ? (
              <WaiverCard
                title="Season Waiver"
                description="Players sign this once when registering for a season. Valid for the entire season."
                waiver={seasonWaiver}
                waiverForm={seasonWaiverForm}
                setWaiverForm={setSeasonWaiverForm}
                saving={seasonWaiverSaving}
                success={seasonWaiverSuccess}
                mode={seasonWaiverMode}
                setMode={setSeasonWaiverMode}
                extracting={seasonExtracting}
                needsVerification={seasonNeedsVerification}
                setNeedsVerification={setSeasonNeedsVerification}
                extractError={seasonExtractError}
                onSave={handleSeasonWaiverSave}
                onVerify={handleSeasonWaiverVerify}
                onUpload={(e) => handlePdfUpload(e, 'season')}
                inputId="season-pdf-upload"
                isPro={isPro}
              />
            ) : (
              <WaiverCard
                title="Drop-in Waiver"
                description="Players sign this on their first drop-in. Valid for 365 days."
                waiver={dropinWaiver}
                waiverForm={dropinWaiverForm}
                setWaiverForm={setDropinWaiverForm}
                saving={dropinWaiverSaving}
                success={dropinWaiverSuccess}
                mode={dropinWaiverMode}
                setMode={setDropinWaiverMode}
                extracting={dropinExtracting}
                needsVerification={dropinNeedsVerification}
                setNeedsVerification={setDropinNeedsVerification}
                extractError={dropinExtractError}
                onSave={handleDropinWaiverSave}
                onVerify={handleDropinWaiverVerify}
                onUpload={(e) => handlePdfUpload(e, 'dropin')}
                inputId="dropin-pdf-upload"
                isPro={isPro}
              />
            )}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid #fecaca', borderRadius: '12px', padding: '20px 24px' }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#dc2626', marginBottom: '4px' }}>Danger Zone</div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>These actions are permanent and cannot be undone.</p>
        <button onClick={() => alert('Please contact support to delete your account.')}
          className="btn-danger" style={{ fontSize: '12px', padding: '7px 14px' }}>
          Delete League & Account
        </button>
      </div>

    </div>
  )
}