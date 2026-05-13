'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2 } from 'lucide-react'
import ThemeSelector from './ThemeSelector'
import { contrastTextForAccent, resolveLeagueThemeChoice } from '@/lib/leagueTheme'
import {
  LEAGUE_THEME_CHOICE_META,
  LEAGUE_THEME_CHOICE_ORDER,
  appearanceModeForChoice,
  normalizeLeagueThemePresetId,
  type LeagueThemeChoiceId,
} from '@/lib/league-theme-choice'
import { leagueIdentityUiHint } from '@/lib/league-identity-change-policy'
import { broadcastLeagueAppearanceUpdated, subscribeLeagueAppearanceUpdated } from '@/lib/league-appearance-sync'
import {
  PRO_BRAND_COLOR_CHANGES_PER_MONTH,
  PRO_BRAND_COLOR_COUNTER_HELPER,
  proBrandColorChangesRemaining,
} from '@/lib/pro-brand-color-limits'
import { DELETE_LEAGUE_ACCOUNT_CONFIRM_PHRASE } from '@/lib/delete-league-account-constants'
import { MLP_PREF_SPORT_STORAGE_KEY } from '@/lib/sport-templates'

interface OrgSettings {
  name: string
  slug: string
  primary_color: string
  plan: string
  logo_url?: string | null
  news_banner?: string | null
  news_banner_color?: string | null
  league_timezone?: string | null
  league_theme_preset?: string | null
  league_appearance_mode?: string | null
  brand_color_change_count?: number | null
  brand_color_change_period_start?: string | null
  league_name_change_count?: number | null
  league_name_last_changed_at?: string | null
}

const TIMEZONE_OPTIONS = [
  'America/Vancouver',
  'America/Edmonton',
  'America/Winnipeg',
  'America/Toronto',
  'America/Halifax',
  'America/St_Johns',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'UTC',
]

interface WaiverData {
  id?: string
  title: string
  content: string
}

export default function SettingsPage() {
  const router = useRouter()
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
    news_banner: '',
    news_banner_color: '#5a7a2a',
    league_timezone: 'America/Vancouver',
    league_theme_preset: 'classic',
    league_appearance_mode: 'light',
  })
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
  const [waiverExporting, setWaiverExporting] = useState(false)
  const [waiverExportError, setWaiverExportError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [deletePanelOpen, setDeletePanelOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    fetchSettings()
    fetchWaivers()
  }, [])

  /** After Stripe Checkout, webhook may lag; sync from `session_id` then refresh settings. */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    const upgraded = params.get('upgraded')
    if (!sessionId || (upgraded !== 'true' && upgraded !== '1')) return

    const doneKey = `mlp_stripe_sync_done_${sessionId}`
    if (sessionStorage.getItem(doneKey) === '1') {
      void fetchSettings()
      router.replace('/dashboard/settings', { scroll: false })
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/stripe/sync-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        if (cancelled) return
        if (res.ok) {
          sessionStorage.setItem(doneKey, '1')
          setSuccess(true)
          await fetchSettings()
        } else {
          const j = (await res.json().catch(() => null)) as { error?: string } | null
          setError(j?.error || 'Could not confirm your upgrade yet. Wait a few seconds and refresh the page.')
        }
      } catch {
        if (!cancelled) {
          setError('Could not confirm your upgrade yet. Wait a few seconds and refresh the page.')
        }
      } finally {
        if (!cancelled) {
          router.replace('/dashboard/settings', { scroll: false })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    return subscribeLeagueAppearanceUpdated(() => {
      void fetchSettings()
    })
  }, [])

  async function fetchSettings() {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setSettings(data.org)
    const themeChoice = normalizeLeagueThemePresetId(
      data.org?.league_theme_preset,
      data.org?.league_appearance_mode
    )
    setForm({
      name: data.org?.name || '',
      slug: data.org?.slug || '',
      primary_color: data.org?.primary_color || '#5a7a2a',
      news_banner: data.org?.news_banner || '',
      news_banner_color: data.org?.news_banner_color || '#5a7a2a',
      league_timezone: data.org?.league_timezone || 'America/Vancouver',
      league_theme_preset: themeChoice,
      league_appearance_mode: appearanceModeForChoice(themeChoice),
    })
    setLoading(false)
  }

  async function downloadWaiverSignatureLog() {
    setWaiverExporting(true)
    setWaiverExportError('')
    try {
      const res = await fetch('/api/waiver/signatures')
      const data = await res.json()
      if (!res.ok) {
        setWaiverExportError(data.error || 'Failed to load signatures')
        return
      }
      const rows = (data.signatures || []) as Array<{
        id: string
        full_name: string
        email: string
        signed_at: string
        ip_address: string | null
        waiver_id: string | null
        waiver_title: string
      }>
      const header = ['signed_at', 'full_name', 'email', 'waiver_title', 'waiver_id', 'signature_id', 'ip_address']
      const escape = (s: string | null | undefined) => {
        const v = String(s ?? '')
        if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
        return v
      }
      const lines = [
        header.join(','),
        ...rows.map((r) =>
          [r.signed_at, r.full_name, r.email, r.waiver_title, r.waiver_id, r.id, r.ip_address]
            .map(escape)
            .join(',')
        ),
      ]
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `waiver-signatures-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setWaiverExporting(false)
    }
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

  async function uploadLeagueLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/settings/logo', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Logo upload failed')
        return
      }
      await fetchSettings()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    } finally {
      setLogoUploading(false)
    }
  }

  async function clearLeagueLogo() {
    setError('')
    setLogoUploading(true)
    try {
      const res = await fetch('/api/settings/logo', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Could not remove logo')
        return
      }
      await fetchSettings()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
    } finally {
      setLogoUploading(false)
    }
  }

  async function runDeleteLeagueAndAccount() {
    setDeleteBusy(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/settings/delete-league-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: deleteConfirmText.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean }
      if (!res.ok) {
        setDeleteError(typeof data.error === 'string' ? data.error : 'Delete failed')
        return
      }
      try {
        sessionStorage.removeItem(MLP_PREF_SPORT_STORAGE_KEY)
      } catch {
        /* ignore */
      }
      window.location.replace('/sign-up')
    } catch {
      setDeleteError('Network error. Check your connection and try again.')
    } finally {
      setDeleteBusy(false)
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
    fetchSettings().then(() => broadcastLeagueAppearanceUpdated())
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
  const isEnterprise = settings?.plan === 'enterprise'
  const proColorChangesRemaining =
    settings?.plan === 'pro'
      ? proBrandColorChangesRemaining({
          plan: settings.plan,
          brand_color_change_count: settings.brand_color_change_count,
          brand_color_change_period_start: settings.brand_color_change_period_start,
        }) ?? 0
      : 0

  const identityUi = useMemo(
    () =>
      leagueIdentityUiHint({
        plan: settings?.plan,
        changeCount: settings?.league_name_change_count,
        lastChangedAt: settings?.league_name_last_changed_at,
      }),
    [settings?.plan, settings?.league_name_change_count, settings?.league_name_last_changed_at]
  )

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
              }}>Type</button>
              <button type="button" onClick={() => setMode('upload')} style={{
                padding: '5px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '6px',
                cursor: 'pointer', fontFamily: 'inherit',
                border: mode === 'upload' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                background: mode === 'upload' ? 'var(--accent)' : 'transparent',
                color: mode === 'upload' ? 'white' : 'var(--text-muted)',
              }}>Upload PDF</button>
            </div>
          )}
        </div>

        <div style={{ background: '#fffbeb', border: '0.5px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '11px', color: '#92400e', lineHeight: '1.5' }}>
          <strong>Legal notice:</strong> MyLeaguePortal provides document processing tools for convenience and is not a provider of legal advice. The enforceability of your waiver is the sole responsibility of the League Host.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isPro && mode === 'upload' && (
            <div style={{ border: '1px dashed var(--border)', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PDF</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Upload a PDF — text is pulled out for you to edit and approve
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
                  Review carefully before approving
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
              Waiver saved. Players will see this on the registration page.
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
                {saving ? 'Saving...' : 'Verify and approve waiver'}
              </button>
            ) : (
              <button type="button" className="btn-primary" disabled={saving || !waiverForm.content} onClick={onSave}>
                {saving ? 'Saving...' : 'Save Waiver'}
              </button>
            )}
            {waiver && !needsVerification && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active — on registration page</span>
            )}
          </div>

          {!isPro && (
            <div style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <strong>Pro/Enterprise:</strong> Upload a PDF waiver and edit the extracted text before saving.
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
        <h1 className="page-title">Settings</h1>
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
                <span style={{ color: 'var(--text-muted)', fontWeight: '700' }}>•</span>{f}
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
            <input
              type="text"
              required
              value={form.name}
              readOnly={!identityUi.canEditName}
              onChange={(e) => {
                if (!identityUi.canEditName) return
                setForm({ ...form, name: e.target.value })
              }}
              className="input"
              style={{ opacity: identityUi.canEditName ? 1 : 0.85 }}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.45 }}>
              {identityUi.helperText}
            </p>
          </div>

          <div>
            <label className="label">League logo</label>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.45 }}>
              Appears on your public league page, sign-up link, and drop-ins. Any shape works; it scales to fit. Replaces the letter block until you remove it.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '12px',
                  border: '0.5px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {settings?.logo_url ? (
                   
                  <img src={settings.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '8px', textAlign: 'center' }}>
                    No logo
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    cursor: logoUploading ? 'wait' : 'pointer',
                    border: '0.5px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    opacity: logoUploading ? 0.75 : 1,
                  }}
                >
                  {logoUploading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ImagePlus size={16} aria-hidden />}
                  {logoUploading ? 'Working…' : 'Upload image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    disabled={logoUploading}
                    onChange={uploadLeagueLogo}
                  />
                </label>
                {settings?.logo_url ? (
                  <button
                    type="button"
                    disabled={logoUploading}
                    onClick={clearLeagueLogo}
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '0.5px solid var(--border)',
                      background: 'transparent',
                      cursor: logoUploading ? 'not-allowed' : 'pointer',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>
            </div>
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
            <div style={{ display: 'flex', alignItems: 'center', border: '0.5px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: settings?.plan === 'basic' ? 'var(--bg-elevated)' : 'var(--input-bg)', opacity: settings?.plan === 'basic' || !identityUi.canEditSlug ? 0.7 : 1 }}>
              <span style={{ background: 'var(--bg-elevated)', padding: '9px 12px', fontSize: '13px', color: 'var(--text-muted)', borderRight: '0.5px solid var(--border)', flexShrink: 0 }}>/join/</span>
              <input type="text" required value={form.slug} readOnly={settings?.plan === 'basic' || !identityUi.canEditSlug}
                onChange={(e) => {
                  if (settings?.plan === 'basic' || !identityUi.canEditSlug) return
                  setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
                }}
                style={{ flex: 1, padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit' }} />
              {(settings?.plan === 'basic' || !identityUi.canEditSlug) && <span style={{ padding: '0 12px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700' }}>Locked</span>}
            </div>
            <button type="button" onClick={() => { navigator.clipboard.writeText(`myleagueportal.com/join/${form.slug}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
              style={{ marginTop: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)', fontWeight: '600', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {copied ? 'Copied' : 'Copy registration link'}
            </button>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.45 }}>
              {settings?.plan === 'basic' ? 'Pro and up: pick your own short link for sign-up.' : `Sign-up and drop-ins: myleagueportal.com/join/${form.slug}`}
              <br />
              Public league page (teams, news):{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>myleagueportal.com/league/{form.slug}</span>
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
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Feeds into your public page colors</span>
            </div>
            {settings?.plan === 'pro' && (
              <>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.45 }}>
                  Brand color changes remaining this month:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{proColorChangesRemaining}</strong> /{' '}
                  {PRO_BRAND_COLOR_CHANGES_PER_MONTH}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.45 }}>
                  {PRO_BRAND_COLOR_COUNTER_HELPER} Saving here updates colors right away. “Publish” on the league site editor only pushes content changes.
                </p>
              </>
            )}
          </div>

          {isPro && (
            <div>
              <label className="label">League theme</label>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                {isEnterprise
                  ? 'Five public page styles. Most use your brand color; Bright is a light blue look; Midnight is dark mode.'
                  : 'Five page styles on Pro. Bright is the main light option; Midnight is dark mode.'}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
                {LEAGUE_THEME_CHOICE_ORDER.map((choiceId) => {
                  const meta = LEAGUE_THEME_CHOICE_META[choiceId]
                  const selected =
                    normalizeLeagueThemePresetId(form.league_theme_preset, form.league_appearance_mode) === choiceId
                  return (
                    <button
                      key={choiceId}
                      type="button"
                      title={meta.description}
                      onClick={() =>
                        setForm({
                          ...form,
                          league_theme_preset: choiceId,
                          league_appearance_mode: appearanceModeForChoice(choiceId),
                        })
                      }
                      style={{
                        flex: '0 0 auto',
                        borderRadius: '999px',
                        border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        padding: '8px 14px',
                        background: selected ? 'var(--accent-muted)' : 'var(--bg-surface)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontWeight: 800,
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {meta.name}
                    </button>
                  )
                })}
              </div>
              {(() => {
                const choice = normalizeLeagueThemePresetId(
                  form.league_theme_preset,
                  form.league_appearance_mode
                ) as LeagueThemeChoiceId
                const active = resolveLeagueThemeChoice(form.primary_color, choice)
                const meta = LEAGUE_THEME_CHOICE_META[choice]
                return (
                  <div
                    style={{
                      borderRadius: '10px',
                      border: `1px solid ${active.surfaceBorder}`,
                      background: active.pageBg,
                      padding: '12px',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '999px', background: active.pageBg, border: '1px solid rgba(0,0,0,0.08)' }} />
                        <span style={{ fontSize: '10px', color: active.body }}>Page</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '999px', background: active.surfaceBg, border: `1px solid ${active.surfaceBorder}` }} />
                        <span style={{ fontSize: '10px', color: active.body }}>Card</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '999px', background: active.accent, border: '1px solid rgba(0,0,0,0.08)' }} />
                        <span style={{ fontSize: '10px', color: active.body }}>Accent</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: active.heading }}>{meta.name}</div>
                    <div style={{ fontSize: '11px', color: active.body, marginTop: '2px' }}>{meta.description}</div>
                    <div style={{ marginTop: '8px', fontSize: '10px', fontWeight: 700, color: contrastTextForAccent(active.accent), background: active.accent, borderRadius: '999px', padding: '4px 8px', display: 'inline-block' }}>
                      Active
                    </div>
                  </div>
                )
              })()}
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.45 }}>
                Same look as your public league and sign-up pages. Save with the button at the bottom of Settings.
              </p>
            </div>
          )}
          
          <div>
            <label className="label">League Time Zone</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="input"
                value={form.league_timezone}
                onChange={(e) => setForm({ ...form, league_timezone: e.target.value })}
                style={{ flex: 1, minWidth: '220px' }}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
                  if (detected) setForm({ ...form, league_timezone: detected })
                }}
                style={{ padding: '8px 10px', fontSize: '12px' }}
              >
                Use my current timezone
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Public drop-in times are displayed in this league timezone.
            </p>
          </div>

          <div>
            <label className="label">League News Banner</label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                 <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                   Message to display at the top of your portal. Clear to hide.
                 </p>
                 <textarea 
                   className="input" 
                   rows={2} 
                   value={form.news_banner || ''}
                   onChange={(e) => setForm({ ...form, news_banner: e.target.value })}
                   placeholder="e.g., Summer Registration is live!"
                   style={{ resize: 'vertical' }}
                 />
              </div>
              <div style={{ width: '100px' }}>
                <label className="label" style={{ fontSize: '11px' }}>Banner Color</label>
                <input 
                  type="color" 
                  value={form.news_banner_color || '#5a7a2a'} 
                  onChange={(e) => setForm({ ...form, news_banner_color: e.target.value })}
                  style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1.5px solid var(--border)', cursor: 'pointer', background: 'none', padding: '2px' }} 
                />
              </div>
            </div>
          </div>

          {success && <div style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>Settings saved.</div>}
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
            }}>Season</button>
            <button type="button" onClick={() => setActiveWaiverTab(activeWaiverTab === 'dropin' ? null : 'dropin')} style={{
              padding: '6px 14px', fontSize: '12px', fontWeight: '700', borderRadius: '6px',
              cursor: 'pointer', fontFamily: 'inherit',
              border: activeWaiverTab === 'dropin' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
              background: activeWaiverTab === 'dropin' ? 'var(--accent)' : 'transparent',
              color: activeWaiverTab === 'dropin' ? 'white' : 'var(--text-muted)',
            }}>Drop-in</button>
          </div>
        </div>

        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={waiverExporting}
            onClick={() => void downloadWaiverSignatureLog()}
            style={{ fontSize: '12px', padding: '7px 14px' }}
          >
            {waiverExporting ? 'Preparing…' : 'Download signed waiver log (CSV)'}
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
            Exports every waiver acceptance for your league (season and drop-in), with name, email, time, and waiver title.
          </span>
          {waiverExportError && (
            <span style={{ fontSize: '12px', color: '#dc2626', width: '100%' }}>{waiverExportError}</span>
          )}
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
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
          Permanently deletes your league (players, seasons, games, waivers, website content, billing link) and your Horizon sign-in
          account. You can register again afterward with the same email.
        </p>
        {!deletePanelOpen ? (
          <button
            type="button"
            className="btn-danger"
            style={{ fontSize: '12px', padding: '7px 14px' }}
            onClick={() => {
              setDeleteError('')
              setDeleteConfirmText('')
              setDeletePanelOpen(true)
            }}
          >
            Delete league & account…
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '420px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Type this phrase to confirm
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={DELETE_LEAGUE_ACCOUNT_CONFIRM_PHRASE}
                disabled={deleteBusy}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: '6px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '0.5px solid var(--border)',
                  fontSize: '13px',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                }}
              />
            </label>
            {deleteError ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#dc2626', lineHeight: 1.45 }}>{deleteError}</p>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-danger"
                style={{ fontSize: '12px', padding: '7px 14px' }}
                disabled={
                  deleteBusy || deleteConfirmText.trim() !== DELETE_LEAGUE_ACCOUNT_CONFIRM_PHRASE
                }
                onClick={() => void runDeleteLeagueAndAccount()}
              >
                {deleteBusy ? 'Deleting…' : 'Delete everything'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '7px 14px' }}
                disabled={deleteBusy}
                onClick={() => {
                  setDeletePanelOpen(false)
                  setDeleteConfirmText('')
                  setDeleteError('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}