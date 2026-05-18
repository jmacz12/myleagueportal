'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
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
import { DashboardHelpLauncher } from '@/components/dashboard/DashboardHelpLauncher'
import { broadcastLeagueAppearanceUpdated, subscribeLeagueAppearanceUpdated } from '@/lib/league-appearance-sync'
import {
  PRO_BRAND_COLOR_CHANGES_PER_MONTH,
  PRO_BRAND_COLOR_COUNTER_HELPER,
  proBrandColorChangesRemaining,
} from '@/lib/pro-brand-color-limits'
import { DELETE_LEAGUE_ACCOUNT_CONFIRM_PHRASE } from '@/lib/delete-league-account-constants'
import { MLP_PREF_SPORT_STORAGE_KEY } from '@/lib/sport-templates'
import { CustomDomainPanel } from '@/components/dashboard/CustomDomainPanel'
import { DashboardPlanLockedHint } from '@/components/dashboard/DashboardPlanLockedHint'
import { publicFanSiteOrigin } from '@/lib/public-site-origin'
import type { OrgPlanSlug } from '@/lib/org-plan-tier'

interface OrgSettings {
  name: string
  slug: string
  primary_color: string
  plan: string
  plan_complimentary?: boolean
  demo_plan_switcher_enabled?: boolean
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
  game_email_reminders_enabled?: boolean
  fan_email_registration_opens_enabled?: boolean
  fan_email_dropin_reminders_enabled?: boolean
  fan_email_news_publish_enabled?: boolean
  fan_email_stats_highlights_enabled?: boolean
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

const SETTINGS_TAB_IDS = ['plan', 'league', 'notifications', 'domain', 'waivers'] as const
const MLP_FAN_EMAIL_TEST_STORAGE_KEY = 'mlp_fan_email_test_to'
type SettingsMainTab = (typeof SETTINGS_TAB_IDS)[number]

function SettingsPageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const tabFromUrlValid = SETTINGS_TAB_IDS.includes(tabFromUrl as SettingsMainTab)
    ? (tabFromUrl as SettingsMainTab)
    : null
  const [settingsMainTab, setSettingsMainTab] = useState<SettingsMainTab>(
    tabFromUrlValid ?? 'plan'
  )
  useEffect(() => {
    if (tabFromUrlValid) setSettingsMainTab(tabFromUrlValid)
  }, [tabFromUrlValid])
  const selectSettingsTab = (tab: SettingsMainTab) => {
    setSettingsMainTab(tab)
    const next = `${pathname}?tab=${tab}`
    router.replace(next, { scroll: false })
    if (typeof window !== 'undefined' && window.location.search !== `?tab=${tab}`) {
      window.history.replaceState(null, '', next)
    }
  }
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedLeague, setCopiedLeague] = useState(false)
  const [verifiedFanHostname, setVerifiedFanHostname] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [demoPlanSaving, setDemoPlanSaving] = useState<OrgPlanSlug | null>(null)
  const [form, setForm] = useState({ 
    name: '', 
    slug: '', 
    primary_color: '#5a7a2a', 
    news_banner: '',
    news_banner_color: '#5a7a2a',
    league_timezone: 'America/Vancouver',
    league_theme_preset: 'classic',
    league_appearance_mode: 'light',
    game_email_reminders_enabled: true,
    fan_email_registration_opens_enabled: true,
    fan_email_dropin_reminders_enabled: true,
    fan_email_news_publish_enabled: true,
    fan_email_stats_highlights_enabled: true,
  })
  const [activeWaiverTab, setActiveWaiverTab] = useState<'season' | 'dropin' | null>(null)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifSuccess, setNotifSuccess] = useState(false)
  const [notifError, setNotifError] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [testSending, setTestSending] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState('')

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
    try {
      const stored = localStorage.getItem(MLP_FAN_EMAIL_TEST_STORAGE_KEY)
      if (stored?.includes('@')) setTestEmail(stored)
    } catch {
      /* ignore */
    }
  }, [])

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
    const [res, domRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/settings/custom-domain'),
    ])
    const data = await res.json()
    let vh: string | null = null
    if (domRes.ok) {
      try {
        const d = await domRes.json()
        if (typeof d.verifiedHostname === 'string' && d.verifiedHostname.trim()) {
          vh = d.verifiedHostname.trim().toLowerCase()
        }
      } catch {
        /* ignore */
      }
    }
    setVerifiedFanHostname(vh)
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
      game_email_reminders_enabled: data.org?.game_email_reminders_enabled !== false,
      fan_email_registration_opens_enabled:
        data.org?.fan_email_registration_opens_enabled !== false,
      fan_email_dropin_reminders_enabled: data.org?.fan_email_dropin_reminders_enabled !== false,
      fan_email_news_publish_enabled: data.org?.fan_email_news_publish_enabled !== false,
      fan_email_stats_highlights_enabled: data.org?.fan_email_stats_highlights_enabled !== false,
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

  async function saveNotificationSettings() {
    setNotifSaving(true)
    setNotifError('')
    setNotifSuccess(false)
    const res = await fetch('/api/settings/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game_email_reminders_enabled: form.game_email_reminders_enabled,
        fan_email_registration_opens_enabled: form.fan_email_registration_opens_enabled,
        fan_email_dropin_reminders_enabled: form.fan_email_dropin_reminders_enabled,
        fan_email_news_publish_enabled: form.fan_email_news_publish_enabled,
        fan_email_stats_highlights_enabled: form.fan_email_stats_highlights_enabled,
      }),
    })
    const data = await res.json()
    setNotifSaving(false)
    if (!res.ok) {
      setNotifError(data.error || 'Could not save notification settings.')
      return
    }
    setNotifSuccess(true)
    setTimeout(() => setNotifSuccess(false), 3000)
    void fetchSettings()
  }

  async function sendFanEmailTest(kind: string) {
    const to = testEmail.trim().toLowerCase()
    if (!to || !to.includes('@')) {
      setTestMessage('Enter a valid email address above first.')
      return
    }
    try {
      localStorage.setItem(MLP_FAN_EMAIL_TEST_STORAGE_KEY, to)
    } catch {
      /* ignore */
    }
    setTestSending(kind)
    setTestMessage('')
    const res = await fetch('/api/settings/fan-email-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, kind }),
    })
    const data = await res.json()
    setTestSending(null)
    if (!res.ok) {
      setTestMessage(typeof data.error === 'string' ? data.error : 'Test email could not be sent.')
      return
    }
    const count = Array.isArray(data.sent) ? data.sent.length : 1
    setTestMessage(
      count > 1
        ? `Sent ${count} test emails to ${to}. Check your inbox (and spam).`
        : `Sent. Check ${to} (and spam) for a message marked [TEST].`
    )
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

  async function handleDemoPlanSwitch(plan: OrgPlanSlug) {
    if (!settings?.demo_plan_switcher_enabled || plan === settings.plan) return
    setDemoPlanSaving(plan)
    setError('')
    try {
      const res = await fetch('/api/settings/demo-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not switch demo plan.')
        return
      }
      await fetchSettings()
      broadcastLeagueAppearanceUpdated()
    } catch {
      setError('Could not switch demo plan.')
    } finally {
      setDemoPlanSaving(null)
    }
  }

  const isComplimentary = settings?.plan_complimentary === true
  const demoPlanSwitcher = settings?.demo_plan_switcher_enabled === true
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
    pro: ['150 players max', '3 concurrent seasons', 'Custom logo & colors', 'Custom fan domain (DNS)', 'Waitlist automation', 'Live scoring table'],
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
        {!isPro ? (
          <div style={{ marginBottom: '14px' }}>
            <DashboardPlanLockedHint feature="upload a PDF waiver — extracted text is editable before you save" />
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{description}</p>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0, opacity: isPro ? 1 : 0.65 }}>
              <button type="button" disabled={!isPro} onClick={() => setMode('type')} style={{
                padding: '5px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '6px',
                cursor: isPro ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                border: mode === 'type' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                background: mode === 'type' ? 'var(--accent)' : 'transparent',
                color: mode === 'type' ? 'white' : 'var(--text-muted)',
              }}>Type</button>
              <button type="button" disabled={!isPro} onClick={() => setMode('upload')} style={{
                padding: '5px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '6px',
                cursor: isPro ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                border: mode === 'upload' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                background: mode === 'upload' ? 'var(--accent)' : 'transparent',
                color: mode === 'upload' ? 'white' : 'var(--text-muted)',
              }}>Upload PDF</button>
          </div>
        </div>

        <div style={{ background: '#fffbeb', border: '0.5px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '11px', color: '#92400e', lineHeight: '1.5' }}>
          <strong>Legal notice:</strong> MyLeaguePortal provides document processing tools for convenience and is not a provider of legal advice. The enforceability of your waiver is the sole responsibility of the League Host.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'upload' && (
            <div style={{ border: '1px dashed var(--border)', borderRadius: '8px', padding: '24px', textAlign: 'center', opacity: isPro ? 1 : 0.55, pointerEvents: isPro ? 'auto' : 'none' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PDF</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Upload a PDF — text is pulled out for you to edit and approve
              </p>
              <input type="file" accept=".pdf" onChange={onUpload}
                style={{ display: 'none' }} id={inputId} disabled={extracting || !isPro} />
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

        </div>
      </div>
    )
  }

  const { fanOrigin, displayHost } = useMemo(() => {
    const o = publicFanSiteOrigin(verifiedFanHostname)
    return { fanOrigin: o, displayHost: o.replace(/^https:\/\//, '').replace(/^http:\/\//, '') }
  }, [verifiedFanHostname])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading settings...</div>
  )

  return (
    <div style={{ maxWidth: '640px' }}>

      <div
        style={{
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Settings
          </h1>
          <p className="page-subtitle">Manage your league profile and subscription</p>
        </div>
        <DashboardHelpLauncher topic="settings" />
      </div>

      <div
        role="tablist"
        aria-label="Settings sections"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0',
          marginBottom: '16px',
          borderBottom: '0.5px solid var(--border)',
        }}
      >
        {(
          [
            { id: 'plan' as const, label: 'Plan' },
            { id: 'league' as const, label: 'League & appearance' },
            { id: 'notifications' as const, label: 'Email notifications' },
            { id: 'domain' as const, label: 'Custom domain' },
            { id: 'waivers' as const, label: 'Waivers' },
          ] as const
        ).map((tab) => {
          const selected = settingsMainTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`settings-main-tab-${tab.id}`}
              aria-controls={`settings-main-panel-${tab.id}`}
              onClick={() => selectSettingsTab(tab.id)}
              style={{
                position: 'relative',
                padding: '12px 14px 14px',
                marginBottom: '-0.5px',
                fontSize: '13px',
                fontWeight: selected ? 800 : 600,
                fontFamily: 'inherit',
                border: 'none',
                background: 'transparent',
                color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                borderBottom: selected ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 0.12s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {settingsMainTab === 'plan' && (
        <div
          id="settings-main-panel-plan"
          role="tabpanel"
          aria-labelledby="settings-main-tab-plan"
        >
      {/* Current Plan */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <span className="label">Current Plan</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`badge badge-${settings?.plan || 'basic'}`}>{settings?.plan || 'basic'}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {isComplimentary
                ? 'Included — no charge'
                : settings?.plan === 'basic'
                  ? 'Free'
                  : settings?.plan === 'pro'
                    ? '$49/month'
                    : '$149/month'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isComplimentary && settings?.plan !== 'enterprise' && (
              <button className="btn-primary" onClick={handleUpgrade} disabled={upgrading}
                style={{ fontSize: '12px', padding: '7px 14px' }}>
                {upgrading ? 'Loading...' : 'Upgrade Plan'}
              </button>
            )}
            {!isComplimentary && settings?.plan !== 'basic' && (
              <button className="btn-secondary" onClick={handleBillingPortal} disabled={upgrading}
                style={{ fontSize: '12px', padding: '7px 14px' }}>
                Manage Billing
              </button>
            )}
          </div>
        </div>
        {isComplimentary ? (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.45 }}>
            This league has complimentary access — all features for your current plan tier with no Stripe billing.
          </p>
        ) : null}
        {demoPlanSwitcher ? (
          <div
            style={{
              marginBottom: '14px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: '0.5px solid var(--border)',
              background: '#f8faf5',
            }}
          >
            <span className="label" style={{ marginBottom: '6px' }}>
              Demo showcase — try each tier
            </span>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.45 }}>
              Switch how this league looks to fans and what features unlock. No payment — for your Vancouvarites demo only until the admin console ships.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(['basic', 'pro', 'enterprise'] as const).map((tier) => {
                const active = settings?.plan === tier
                const saving = demoPlanSaving === tier
                return (
                  <button
                    key={tier}
                    type="button"
                    disabled={demoPlanSaving !== null}
                    onClick={() => void handleDemoPlanSwitch(tier)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      cursor: demoPlanSaving !== null ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      textTransform: 'capitalize',
                      border: active ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                      background: active ? 'var(--accent)' : 'white',
                      color: active ? 'white' : 'var(--text-primary)',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Saving…' : tier}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
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
        </div>
      )}

      {settingsMainTab === 'league' && (
        <div
          id="settings-main-panel-league"
          role="tabpanel"
          aria-labelledby="settings-main-tab-league"
        >
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
            <label className="label">Registration link</label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: '0.5px solid var(--border)',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'var(--bg-elevated)',
              }}
            >
              <span
                style={{
                  padding: '9px 12px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  borderRight: '0.5px solid var(--border)',
                  flexShrink: 0,
                  maxWidth: '42%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={`${displayHost}/join/`}
              >
                {displayHost}/join/
              </span>
              <input
                type="text"
                required
                value={form.slug}
                readOnly
                aria-readonly="true"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '9px 12px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <span style={{ padding: '0 12px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700' }}>Locked</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.45 }}>
              Set when you created your league. Season sign-up and drop-ins use this link. Copy and share; it does not change here.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(`${fanOrigin}/join/${form.slug}`).then(() => {
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 2000)
                  })
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '0.5px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--accent)',
                  fontWeight: '700',
                }}
              >
                {copied ? 'Copied' : 'Copy registration link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(`${fanOrigin}/league/${form.slug}`).then(() => {
                    setCopiedLeague(true)
                    window.setTimeout(() => setCopiedLeague(false), 2000)
                  })
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '0.5px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--accent)',
                  fontWeight: '700',
                }}
              >
                {copiedLeague ? 'Copied' : 'Copy public league page'}
              </button>
            </div>
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

          <div style={{ opacity: isPro ? 1 : 0.65 }}>
            {!isPro ? (
              <DashboardPlanLockedHint feature="pick a public league page style (Classic, Bright, Midnight, and more)" />
            ) : null}
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
                      disabled={!isPro}
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
                        cursor: isPro ? 'pointer' : 'not-allowed',
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

          <div style={{ marginTop: '16px' }}>
            {!isPro ? (
              <DashboardPlanLockedHint feature="set a headline banner on your public league site" />
            ) : null}
            <label className="label">League News Banner</label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', opacity: isPro ? 1 : 0.65 }}>
              <div style={{ flex: 1 }}>
                 <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                   Message to display at the top of your portal. Clear to hide.
                 </p>
                 <textarea 
                   className="input" 
                   rows={2} 
                   value={form.news_banner || ''}
                   disabled={!isPro}
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
                  disabled={!isPro}
                  onChange={(e) => setForm({ ...form, news_banner_color: e.target.value })}
                  style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1.5px solid var(--border)', cursor: isPro ? 'pointer' : 'not-allowed', background: 'none', padding: '2px' }} 
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
        </div>
      )}

      {settingsMainTab === 'notifications' && (
        <div
          id="settings-main-panel-notifications"
          role="tabpanel"
          aria-labelledby="settings-main-tab-notifications"
        >
          <div className="card" style={{ marginBottom: '16px', padding: '16px 18px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Automated fan emails
            </p>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Turn each alert type on or off. Roster players and drop-in sign-ups with an email on file receive
              these automatically (each includes its own unsubscribe link).
            </p>
            {!isPro ? (
              <DashboardPlanLockedHint feature="turn fan email alerts on or off for your league" />
            ) : null}
            {(
              [
                {
                  key: 'game_email_reminders_enabled' as const,
                  title: 'Game reminder emails',
                  detail: 'About 24 hours before each scheduled league game.',
                },
                {
                  key: 'fan_email_registration_opens_enabled' as const,
                  title: 'Registration opens emails',
                  detail: 'When season online registration opens.',
                },
                {
                  key: 'fan_email_dropin_reminders_enabled' as const,
                  title: 'Drop-in reminder emails',
                  detail: 'About 24 hours before a drop-in session.',
                },
                {
                  key: 'fan_email_news_publish_enabled' as const,
                  title: 'League & team news emails',
                  detail: 'When you publish the league website or a team posts news.',
                },
                {
                  key: 'fan_email_stats_highlights_enabled' as const,
                  title: 'Stats highlight emails',
                  detail: 'After a final game when stats are saved.',
                },
              ] as const
            ).map((row, i) => (
              <label
                key={row.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: isPro ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  marginTop: i === 0 ? 0 : '12px',
                  opacity: isPro ? 1 : 0.65,
                }}
              >
                <input
                  type="checkbox"
                  checked={form[row.key]}
                  disabled={!isPro}
                  onChange={(e) => setForm({ ...form, [row.key]: e.target.checked })}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  <strong>{row.title}</strong>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                      marginTop: '4px',
                      lineHeight: 1.45,
                    }}
                  >
                    {row.detail}
                  </span>
                </span>
              </label>
            ))}
            {notifSuccess ? (
              <div
                style={{
                  marginTop: '14px',
                  background: '#f0fdf4',
                  border: '0.5px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#16a34a',
                  fontWeight: 600,
                }}
              >
                Notification settings saved.
              </div>
            ) : null}
            {notifError ? (
              <div
                style={{
                  marginTop: '14px',
                  background: '#fef2f2',
                  border: '0.5px solid #fecaca',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#dc2626',
                }}
              >
                {notifError}
              </div>
            ) : null}
            <button
              type="button"
              className="btn-primary"
              disabled={!isPro || notifSaving}
              onClick={() => void saveNotificationSettings()}
              style={{ marginTop: '16px', fontSize: '13px', padding: '9px 16px' }}
            >
              {notifSaving ? 'Saving…' : 'Save notification settings'}
            </button>
          </div>

          <div className="card" style={{ padding: '16px 18px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Send test emails
            </p>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Preview what fans receive. Messages are marked <strong>[TEST]</strong> and do not change real player
              preferences.
            </p>
            <label className="label" htmlFor="fan-email-test-to">
              Send tests to
            </label>
            <input
              id="fan-email-test-to"
              type="email"
              className="input"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={{ marginBottom: '14px', maxWidth: '360px' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(
                [
                  ['game_reminder', 'Game reminder'],
                  ['registration_opens', 'Registration opens'],
                  ['dropin_reminder', 'Drop-in reminder'],
                  ['league_news', 'League news'],
                  ['team_news', 'Team news'],
                  ['stats_highlight', 'Stats highlight'],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  className="btn-secondary"
                  disabled={!!testSending}
                  onClick={() => void sendFanEmailTest(kind)}
                  style={{ fontSize: '12px', padding: '7px 12px' }}
                >
                  {testSending === kind ? 'Sending…' : label}
                </button>
              ))}
              <button
                type="button"
                className="btn-primary"
                disabled={!!testSending}
                onClick={() => void sendFanEmailTest('all')}
                style={{ fontSize: '12px', padding: '7px 14px' }}
              >
                {testSending === 'all' ? 'Sending all…' : 'Send all samples'}
              </button>
            </div>
            {testMessage ? (
              <p
                style={{
                  margin: '14px 0 0',
                  fontSize: '13px',
                  color: testMessage.toLowerCase().includes('could not') ? '#dc2626' : '#15803d',
                  lineHeight: 1.45,
                }}
              >
                {testMessage}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {settingsMainTab === 'domain' && (
        <div
          id="settings-main-panel-domain"
          role="tabpanel"
          aria-labelledby="settings-main-tab-domain"
          style={{ marginBottom: '16px' }}
        >
      <CustomDomainPanel
        plan={settings?.plan || 'basic'}
        slug={form.slug}
        onVerifiedHostname={setVerifiedFanHostname}
      />
        </div>
      )}

      {settingsMainTab === 'waivers' && (
        <div
          id="settings-main-panel-waivers"
          role="tabpanel"
          aria-labelledby="settings-main-tab-waivers"
        >
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
        </div>
      )}

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

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading settings...</div>
      }
    >
      <SettingsPageClient />
    </Suspense>
  )
}