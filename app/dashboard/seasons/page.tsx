'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { inferSignupMode, effectiveSignupOpensAtIso } from '@/lib/seasonSignup'
import SeasonSignupTimingFields from './SeasonSignupTimingFields'
import { DashboardHelpLauncher } from '@/components/dashboard/DashboardHelpLauncher'

interface Season {
  id: string
  name: string
  is_active: boolean
  start_date: string | null
  end_date: string | null
  /** Competitive seasons only: controls public /join season signup */
  allow_online_registration?: boolean
  signup_opens_mode?: string | null
  signup_opens_days_before?: number | null
  online_registration_opens_at?: string | null
  online_registration_closes_at?: string | null
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatSeasonDateLabel(iso: string | null | undefined): string {
  if (!iso) return 'Not set'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Not set'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatSignupDateTimeLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

interface SettingsDraft {
  name: string
  start_date: string
  end_date: string
  signupOption: string
  signupDaysBefore: string
  customOpensAt: string
  closesAt: string
}

function emptySettingsDraft(): SettingsDraft {
  return {
    name: '',
    start_date: '',
    end_date: '',
    signupOption: 'open_now',
    signupDaysBefore: '3',
    customOpensAt: '',
    closesAt: '',
  }
}

function populateSettingsDraft(setter: React.Dispatch<React.SetStateAction<SettingsDraft>>, season: Season) {
  setter({
    name: season.name || '',
    start_date: season.start_date ? String(season.start_date).slice(0, 10) : '',
    end_date: season.end_date ? String(season.end_date).slice(0, 10) : '',
    signupOption: inferSignupMode(season),
    signupDaysBefore: String(season.signup_opens_days_before ?? 3),
    customOpensAt: isoToDatetimeLocal(season.online_registration_opens_at),
    closesAt: isoToDatetimeLocal(season.online_registration_closes_at),
  })
}

function signupOpensSummaryLines(season: Season): { opens: string; closes: string } {
  const mode = inferSignupMode(season)
  if (mode === 'closed') {
    return { opens: 'Keep closed', closes: '—' }
  }
  let opens = ''
  if (mode === 'open_now') {
    opens = 'Open now (public join is available immediately)'
  } else if (mode === 'scheduled') {
    const d = season.signup_opens_days_before ?? 3
    const eff = effectiveSignupOpensAtIso(season)
    opens = `${d} day${d === 1 ? '' : 's'} before season starts`
    if (eff) opens += ` (${formatSignupDateTimeLabel(eff)})`
  } else if (mode === 'custom' && season.online_registration_opens_at) {
    opens = formatSignupDateTimeLabel(season.online_registration_opens_at)
  } else {
    opens = '—'
  }
  const closes = season.online_registration_closes_at
    ? formatSignupDateTimeLabel(season.online_registration_closes_at)
    : 'No deadline'
  return { opens, closes }
}

interface OrgInfo {
  plan: string
  seasonLimit: number
}

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    signupOption: 'open_now',
    signupDaysBefore: '3',
    customOpensAt: '',
    closesAt: '',
  })
  const [windowEditId, setWindowEditId] = useState<string | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => emptySettingsDraft())
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaveError, setSettingsSaveError] = useState('')
  /** Active season only: collapsed shows a single Edit; expanding reveals Online / inactive / delete */
  const [activeSeasonActionsOpenId, setActiveSeasonActionsOpenId] = useState<string | null>(null)

  useEffect(() => { fetchSeasons() }, [])

  async function fetchSeasons() {
    const res = await fetch('/api/seasons')
    const data = await res.json()
    setSeasons(data.seasons || [])
    setOrgInfo(data.orgInfo || null)
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        signup_opens_mode: form.signupOption,
        signup_opens_days_before: form.signupOption === 'scheduled' ? form.signupDaysBefore : undefined,
        online_registration_opens_at:
          form.signupOption === 'custom' && form.customOpensAt
            ? new Date(form.customOpensAt).toISOString()
            : null,
        online_registration_closes_at: form.closesAt ? new Date(form.closesAt).toISOString() : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong'); setSubmitting(false); return }
    setForm({
      name: '',
      start_date: '',
      end_date: '',
      signupOption: 'open_now',
      signupDaysBefore: '3',
      customOpensAt: '',
      closesAt: '',
    })
    setShowForm(false)
    fetchSeasons()
    setSubmitting(false)
  }

  async function toggleActive(seasonId: string, currentStatus: boolean) {
    await fetch('/api/seasons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_id: seasonId, is_active: !currentStatus }),
    })
    fetchSeasons()
  }

  async function toggleOnlineSignup(seasonId: string, current: boolean) {
    await fetch('/api/seasons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_id: seasonId, allow_online_registration: !current }),
    })
    fetchSeasons()
  }

  async function saveSeasonSettings(seasonId: string) {
    const trimmedName = settingsDraft.name.trim()
    if (!trimmedName) {
      setSettingsSaveError('Season name is required')
      return
    }
    setSettingsSaving(true)
    setSettingsSaveError('')
    const payload: Record<string, unknown> = {
      season_id: seasonId,
      name: trimmedName,
      start_date: settingsDraft.start_date ? settingsDraft.start_date : null,
      end_date: settingsDraft.end_date ? settingsDraft.end_date : null,
      signup_opens_mode: settingsDraft.signupOption,
      signup_opens_days_before:
        settingsDraft.signupOption === 'scheduled' ? settingsDraft.signupDaysBefore : undefined,
      online_registration_opens_at:
        settingsDraft.signupOption === 'custom' && settingsDraft.customOpensAt
          ? new Date(settingsDraft.customOpensAt).toISOString()
          : null,
      online_registration_closes_at: settingsDraft.closesAt
        ? new Date(settingsDraft.closesAt).toISOString()
        : null,
    }

    const res = await fetch('/api/seasons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    setSettingsSaving(false)
    if (!res.ok) {
      setSettingsSaveError(typeof data.error === 'string' ? data.error : 'Could not save changes')
      return
    }
    setWindowEditId(null)
    setActiveSeasonActionsOpenId(null)
    fetchSeasons()
  }

  async function deleteSeason(seasonId: string) {
    if (!confirm('Delete this season? This will also delete all players and stats in this season.')) return
    setDeletingId(seasonId)
    await fetch('/api/seasons', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season_id: seasonId }),
    })
    setDeletingId(null)
    setActiveSeasonActionsOpenId((prev) => (prev === seasonId ? null : prev))
    fetchSeasons()
  }

  const atLimit = orgInfo && seasons.length >= orgInfo.seasonLimit

  return (
    <div style={{ maxWidth: '760px' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Seasons</h1>
          <p className="page-subtitle">
            Competitive league seasons. For pickup or between-season play, use{' '}
            <Link href="/dashboard/dropin" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Drop-ins
            </Link>
            .
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexShrink: 0 }}>
          <DashboardHelpLauncher topic="seasons" />
          <button
            onClick={() => !atLimit && setShowForm(!showForm)}
            className="btn-primary"
            style={{ opacity: atLimit ? 0.5 : 1, cursor: atLimit ? 'not-allowed' : 'pointer' }}
          >
            + New Season
          </button>
        </div>
      </div>

      {/* Upgrade Banner */}
      {atLimit && (
        <div className="upgrade-banner" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: '700', color: 'var(--accent-text)', marginBottom: '2px', fontSize: '14px' }}>
                Season limit reached
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Your <strong>{orgInfo?.plan}</strong> plan allows {orgInfo?.seasonLimit} season{orgInfo?.seasonLimit === 1 ? '' : 's'}.
                {orgInfo?.plan === 'basic' ? ' Upgrade to Pro for up to 3 seasons.' : ' Upgrade to Enterprise for unlimited.'}
              </p>
            </div>
            <Link href="/dashboard/settings" style={{ textDecoration: 'none' }}>
              <button className="btn-primary" style={{ fontSize: '12px', padding: '7px 14px' }}>
                Upgrade plan
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* New Season Form */}
      {showForm && !atLimit && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Create New Season
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div>
              <label className="label">Season Name *</label>
              <input type="text" required placeholder="e.g. Summer 2025" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label">Start Date</label>
                <input type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="input" />
              </div>
              <div>
                <label className="label">End Date</label>
                <input type="date" value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="input" />
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Public season signup
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.45, margin: '0 0 12px' }}>
                Same choices as Drop-ins — controls when players can join this season on your public link.
              </p>
              <SeasonSignupTimingFields
                signupOption={form.signupOption}
                setSignupOption={(v) => setForm({ ...form, signupOption: v })}
                signupDaysBefore={form.signupDaysBefore}
                setSignupDaysBefore={(v) => setForm({ ...form, signupDaysBefore: v })}
                customOpensAt={form.customOpensAt}
                setCustomOpensAt={(v) => setForm({ ...form, customOpensAt: v })}
                closesAt={form.closesAt}
                setClosesAt={(v) => setForm({ ...form, closesAt: v })}
                seasonStartDate={form.start_date}
              />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Creating...' : 'Create Season'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Seasons List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading seasons...</div>
      ) : seasons.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><CalendarDays size={32} strokeWidth={1.5} /></div>
          <div className="empty-state-title">No seasons yet</div>
          <div className="empty-state-desc">
            Create your first league season. For pickup sessions, open{' '}
            <Link href="/dashboard/dropin" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Drop-ins
            </Link>
            .
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {seasons.map((season) => {
            const actionsExpanded = season.is_active && activeSeasonActionsOpenId === season.id
            const signupSum = signupOpensSummaryLines(season)
            return (
            <div
              key={season.id}
              className="card-sm"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  {actionsExpanded && season.is_active ? (
                    <input
                      type="text"
                      className="input"
                      value={settingsDraft.name}
                      onChange={(e) => setSettingsDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="Season name"
                      aria-label="Season name"
                      style={{
                        flex: '1 1 180px',
                        minWidth: '140px',
                        fontSize: '14px',
                        fontWeight: 700,
                        padding: '6px 10px',
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{season.name}</span>
                  )}
                  {season.is_active && <span className="badge badge-active">Active</span>}
                </div>
                {actionsExpanded && season.is_active ? (
                  <div style={{ marginTop: '10px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginBottom: '6px',
                      }}
                    >
                      Season dates
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxWidth: '440px' }}>
                      <div>
                        <label className="label" style={{ fontSize: '10px' }}>Starts</label>
                        <input
                          type="date"
                          className="input"
                          value={settingsDraft.start_date}
                          onChange={(e) => setSettingsDraft((d) => ({ ...d, start_date: e.target.value }))}
                          style={{ fontSize: '12px', marginTop: '4px' }}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: '10px' }}>Ends</label>
                        <input
                          type="date"
                          className="input"
                          value={settingsDraft.end_date}
                          onChange={(e) => setSettingsDraft((d) => ({ ...d, end_date: e.target.value }))}
                          style={{ fontSize: '12px', marginTop: '4px' }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (season.start_date || season.end_date) ? (
                  <div style={{ marginTop: '10px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginBottom: '6px',
                      }}
                    >
                      Season dates
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gap: '4px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.45,
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Starts</span>
                        {' · '}
                        {formatSeasonDateLabel(season.start_date)}
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Ends</span>
                        {' · '}
                        {formatSeasonDateLabel(season.end_date)}
                      </div>
                    </div>
                  </div>
                ) : null}
                {season.is_active && inferSignupMode(season) === 'closed' && !actionsExpanded && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.5, marginBottom: 0 }}>
                    Join page signup is set to <strong>Keep closed</strong>. Open <strong>Edit</strong> to choose Open now, schedule, or custom.
                  </p>
                )}
                {season.is_active && actionsExpanded ? (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', marginBottom: 0, lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Join page signup</strong>
                    {' — '}
                    not the same as season dates. Currently: {signupSum.opens} · closes {signupSum.closes}. Use{' '}
                    <strong>Signup timing</strong> below to change.
                  </p>
                ) : (
                  <div style={{ marginTop: '12px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        marginBottom: '4px',
                      }}
                    >
                      Join page signup window
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
                      Not the same as season dates — this only controls public registration timing (like Drop-ins).
                    </p>
                    <div
                      style={{
                        display: 'grid',
                        gap: '4px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.45,
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Opens</span>
                        {' · '}
                        {signupSum.opens}
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Closes</span>
                        {' · '}
                        {signupSum.closes}
                      </div>
                    </div>
                    {!season.is_active && windowEditId !== season.id && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '11px', padding: '6px 12px', marginTop: '10px' }}
                        onClick={() => {
                          setWindowEditId(season.id)
                          setSettingsSaveError('')
                          populateSettingsDraft(setSettingsDraft, season)
                        }}
                      >
                        Edit signup settings
                      </button>
                    )}
                  </div>
                )}
                {!season.is_active && windowEditId === season.id && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
                      Season & signup settings
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label className="label" style={{ fontSize: '11px' }}>Season name</label>
                      <input
                        type="text"
                        className="input"
                        value={settingsDraft.name}
                        onChange={(e) => setSettingsDraft((d) => ({ ...d, name: e.target.value }))}
                        placeholder="e.g. Summer 2026"
                        style={{ fontSize: '13px', marginTop: '4px' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                      <div>
                        <label className="label" style={{ fontSize: '11px' }}>Season starts</label>
                        <input
                          type="date"
                          className="input"
                          value={settingsDraft.start_date}
                          onChange={(e) => setSettingsDraft((d) => ({ ...d, start_date: e.target.value }))}
                          style={{ fontSize: '12px', marginTop: '4px' }}
                        />
                      </div>
                      <div>
                        <label className="label" style={{ fontSize: '11px' }}>Season ends</label>
                        <input
                          type="date"
                          className="input"
                          value={settingsDraft.end_date}
                          onChange={(e) => setSettingsDraft((d) => ({ ...d, end_date: e.target.value }))}
                          style={{ fontSize: '12px', marginTop: '4px' }}
                        />
                      </div>
                    </div>
                    <SeasonSignupTimingFields
                      signupOption={settingsDraft.signupOption}
                      setSignupOption={(v) => setSettingsDraft((d) => ({ ...d, signupOption: v }))}
                      signupDaysBefore={settingsDraft.signupDaysBefore}
                      setSignupDaysBefore={(v) => setSettingsDraft((d) => ({ ...d, signupDaysBefore: v }))}
                      customOpensAt={settingsDraft.customOpensAt}
                      setCustomOpensAt={(v) => setSettingsDraft((d) => ({ ...d, customOpensAt: v }))}
                      closesAt={settingsDraft.closesAt}
                      setClosesAt={(v) => setSettingsDraft((d) => ({ ...d, closesAt: v }))}
                      seasonStartDate={settingsDraft.start_date}
                    />
                    {settingsSaveError && (
                      <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '10px' }}>{settingsSaveError}</div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={settingsSaving}
                        style={{ fontSize: '11px', padding: '6px 12px' }}
                        onClick={() => void saveSeasonSettings(season.id)}
                      >
                        {settingsSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '11px', padding: '6px 12px' }}
                        onClick={() => { setWindowEditId(null); setSettingsSaveError('') }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flexShrink: 0, justifyContent: 'flex-end', alignItems: 'center', alignSelf: 'center' }}>
                {season.is_active ? (
                  actionsExpanded ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => {
                        setActiveSeasonActionsOpenId(null)
                        setSettingsDraft(emptySettingsDraft())
                        setSettingsSaveError('')
                      }}
                    >
                      Done
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 14px', fontWeight: 600 }}
                      onClick={() => {
                        setActiveSeasonActionsOpenId(season.id)
                        setSettingsSaveError('')
                        populateSettingsDraft(setSettingsDraft, season)
                      }}
                    >
                      Edit
                    </button>
                  )
                ) : (
                  <>
                    <button
                      type="button"
                      title="Toggle public signup on your join link"
                      onClick={() => toggleOnlineSignup(season.id, !!season.allow_online_registration)}
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '6px 10px', fontWeight: 700 }}
                    >
                      {season.allow_online_registration ? 'Online: on' : 'Online: off'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(season.id, season.is_active)}
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      Set Active
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSeason(season.id)}
                      disabled={deletingId === season.id}
                      className="btn-danger"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      {deletingId === season.id ? '...' : 'Delete'}
                    </button>
                  </>
                )}
              </div>
              </div>

              {actionsExpanded && (
                <div
                  style={{
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => {
                        void toggleActive(season.id, season.is_active)
                        setActiveSeasonActionsOpenId(null)
                        setSettingsSaveError('')
                      }}
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      Set Inactive
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSeason(season.id)}
                      disabled={deletingId === season.id}
                      className="btn-danger"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      {deletingId === season.id ? '...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={settingsSaving}
                      style={{ fontSize: '12px', padding: '6px 14px', marginLeft: 'auto' }}
                      onClick={() => void saveSeasonSettings(season.id)}
                    >
                      {settingsSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                  <details style={{ marginTop: '12px' }}>
                    <summary
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        userSelect: 'none',
                        color: 'var(--text-primary)',
                      }}
                    >
                      Signup timing (join page)
                    </summary>
                    <div style={{ marginTop: '12px' }}>
                      <SeasonSignupTimingFields
                        signupOption={settingsDraft.signupOption}
                        setSignupOption={(v) => setSettingsDraft((d) => ({ ...d, signupOption: v }))}
                        signupDaysBefore={settingsDraft.signupDaysBefore}
                        setSignupDaysBefore={(v) => setSettingsDraft((d) => ({ ...d, signupDaysBefore: v }))}
                        customOpensAt={settingsDraft.customOpensAt}
                        setCustomOpensAt={(v) => setSettingsDraft((d) => ({ ...d, customOpensAt: v }))}
                        closesAt={settingsDraft.closesAt}
                        setClosesAt={(v) => setSettingsDraft((d) => ({ ...d, closesAt: v }))}
                        seasonStartDate={settingsDraft.start_date}
                      />
                    </div>
                  </details>
                  {settingsSaveError && (
                    <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '10px' }}>{settingsSaveError}</div>
                  )}
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}