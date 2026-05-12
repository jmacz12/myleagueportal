'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'

interface TeamRow {
  id: string
  name: string
  season_id: string
  color: string | null
  logo_url?: string | null
  stream_url?: string | null
  house_rules?: string | null
}

interface SeasonRow {
  id: string
  name: string
}

interface PollRow {
  id: string
  team_id: string
  status: string
  responses?: Array<{
    id: string
    preferred_number: number
    conflict?: boolean
    player: { full_name: string; email: string | null }
  }>
}

interface TeamNewsPost {
  id: string
  title: string
  body: string
  pinned: boolean
  created_at: string
  updated_at: string
}

interface TeamCalendarEvent {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  location: string | null
  notes: string | null
  source: string
}

type TabId = 'pageContent' | 'teamPage' | 'news' | 'calendar'

export type LeagueTeamManagePanelProps = {
  teamId: string
  orgSlug: string
  /** Light page background (public team page) vs dashboard vars */
  variant?: 'public' | 'dashboard'
  onClose?: () => void
  onDataChanged?: () => void
}

export function LeagueTeamManagePanel({
  teamId,
  orgSlug,
  variant = 'public',
  onClose,
  onDataChanged,
}: LeagueTeamManagePanelProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orgPlan, setOrgPlan] = useState<'basic' | 'pro' | 'enterprise'>('basic')
  const [team, setTeam] = useState<TeamRow | null>(null)
  const [seasonName, setSeasonName] = useState('Season')
  const [openPoll, setOpenPoll] = useState<PollRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('pageContent')
  const [pageDraft, setPageDraft] = useState({ stream_url: '', house_rules: '' })
  const [newsPosts, setNewsPosts] = useState<TeamNewsPost[]>([])
  const [newsForm, setNewsForm] = useState({ title: '', body: '', pinned: false })
  const [upcomingEvents, setUpcomingEvents] = useState<TeamCalendarEvent[]>([])
  const [recentEvents, setRecentEvents] = useState<TeamCalendarEvent[]>([])
  const [eventForm, setEventForm] = useState({
    title: '',
    starts_at: '',
    ends_at: '',
    location: '',
    notes: '',
  })
  const [csvImport, setCsvImport] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [teamsRes, seasonsRes, pollsRes, newsRes, calendarRes] = await Promise.all([
      fetch('/api/teams'),
      fetch('/api/seasons'),
      fetch('/api/jersey-polls'),
      fetch(`/api/teams/${teamId}/news`),
      fetch(`/api/teams/${teamId}/calendar`),
    ])
    const teamsJson = await teamsRes.json().catch(() => ({}))
    const seasonsJson = await seasonsRes.json().catch(() => ({}))
    const pollsJson = await pollsRes.json().catch(() => ({}))
    const newsJson = await newsRes.json().catch(() => ({}))
    const calJson = await calendarRes.json().catch(() => ({}))
    if (!teamsRes.ok) {
      setError(typeof teamsJson?.error === 'string' ? teamsJson.error : 'Could not load team')
      setLoading(false)
      return
    }
    const foundTeam = ((teamsJson.teams || []) as TeamRow[]).find((t) => t.id === teamId) || null
    if (!foundTeam) {
      setError('Team not found')
      setLoading(false)
      return
    }
    setTeam(foundTeam)
    setPageDraft({
      stream_url: foundTeam.stream_url ?? '',
      house_rules: foundTeam.house_rules ?? '',
    })
    const planRaw = String(teamsJson.org_plan || 'basic').toLowerCase()
    setOrgPlan(planRaw === 'enterprise' ? 'enterprise' : planRaw === 'pro' ? 'pro' : 'basic')

    const seasons = (seasonsJson.seasons || []) as SeasonRow[]
    setSeasonName(seasons.find((s) => s.id === foundTeam.season_id)?.name || 'Season')

    const polls = (pollsJson.polls || []) as PollRow[]
    setOpenPoll(polls.find((p) => p.team_id === teamId && p.status === 'open') || null)
    setNewsPosts((newsJson.posts || []) as TeamNewsPost[])
    setUpcomingEvents((calJson.upcoming || []) as TeamCalendarEvent[])
    setRecentEvents((calJson.recent || []) as TeamCalendarEvent[])
    setLoading(false)
  }, [teamId])

  useEffect(() => {
    void load()
  }, [load])

  async function afterMutation() {
    await load()
    onDataChanged?.()
  }

  async function createNewsPost() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${teamId}/news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newsForm),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not create post.')
        return
      }
      setNewsForm({ title: '', body: '', pinned: false })
      await afterMutation()
    } finally {
      setBusy(false)
    }
  }

  async function deleteNewsPost(postId: string) {
    if (!confirm('Delete this post?')) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${teamId}/news/${postId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not delete post.')
        return
      }
      await afterMutation()
    } finally {
      setBusy(false)
    }
  }

  async function createCalendarEvent() {
    setBusy(true)
    setError('')
    try {
      const payload = {
        ...eventForm,
        ends_at: eventForm.ends_at || null,
        location: eventForm.location || null,
        notes: eventForm.notes || null,
      }
      const res = await fetch(`/api/teams/${teamId}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not create event.')
        return
      }
      setEventForm({ title: '', starts_at: '', ends_at: '', location: '', notes: '' })
      await afterMutation()
    } finally {
      setBusy(false)
    }
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('Delete this event?')) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${teamId}/calendar/${eventId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not delete event.')
        return
      }
      await afterMutation()
    } finally {
      setBusy(false)
    }
  }

  async function importCsvEvents() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${teamId}/calendar/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvImport }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not import events.')
        return
      }
      setCsvImport('')
      await afterMutation()
    } finally {
      setBusy(false)
    }
  }

  async function uploadTeamLogo(file: File) {
    setBusy(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/teams/${teamId}/logo`, { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not upload team logo.')
        return
      }
      await afterMutation()
    } finally {
      setBusy(false)
    }
  }

  async function clearTeamLogo() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${teamId}/logo`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not remove team logo.')
        return
      }
      await afterMutation()
    } finally {
      setBusy(false)
    }
  }

  async function openJerseyPoll() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/jersey-polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not open poll.')
        return
      }
      await afterMutation()
    } finally {
      setBusy(false)
    }
  }

  async function savePublicPageFields() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/teams/${teamId}/public-page`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stream_url: pageDraft.stream_url.trim() || null,
          house_rules: pageDraft.house_rules.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not save page settings.')
        return
      }
      await afterMutation()
    } finally {
      setBusy(false)
    }
  }

  async function closeJerseyPoll(pollId: string) {
    if (!confirm('Close this jersey poll?')) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/jersey-polls/${pollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not close poll.')
        return
      }
      await afterMutation()
    } finally {
      setBusy(false)
    }
  }

  const publicTeamUrl = useMemo(() => {
    if (!orgSlug || !teamId) return null
    if (typeof window === 'undefined') return `/league/${orgSlug}/teams/${teamId}`
    return `${window.location.origin}/league/${orgSlug}/teams/${teamId}`
  }, [orgSlug, teamId])

  const shell =
    variant === 'public'
      ? {
          cardBg: 'rgba(255,255,255,0.92)',
          cardBorder: '1px solid rgba(15,23,42,0.12)',
          text: '#0f172a',
          muted: '#64748b',
          tabBorder: 'rgba(15,23,42,0.15)',
          tabActiveBg: 'rgba(90,122,42,0.12)',
          tabActiveBorder: '#5a7a2a',
        }
      : {
          cardBg: 'var(--bg-surface)',
          cardBorder: '1px solid var(--border)',
          text: 'var(--text-primary)',
          muted: 'var(--text-muted)',
          tabBorder: 'var(--border)',
          tabActiveBg: 'var(--accent-muted)',
          tabActiveBorder: 'var(--accent)',
        }

  if (loading) {
    return (
      <div style={{ padding: '24px', color: shell.muted, fontSize: '14px', fontWeight: 600 }}>
        Loading team tools…
      </div>
    )
  }

  if (!team) {
    return (
      <div style={{ padding: '24px', color: '#b91c1c', fontSize: '14px' }}>{error || 'Team not found.'}</div>
    )
  }

  const canUpload = orgPlan === 'pro' || orgPlan === 'enterprise'

  return (
    <div
      style={{
        borderRadius: '16px',
        border: shell.cardBorder,
        background: shell.cardBg,
        padding: '20px',
        color: shell.text,
        boxShadow: variant === 'public' ? '0 18px 50px -24px rgba(15,23,42,0.35)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', color: shell.muted, textTransform: 'uppercase' }}>
            Team management
          </div>
          <h2 style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: 800 }}>{team.name}</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: shell.muted }}>{seasonName}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {publicTeamUrl ? (
            <a
              href={publicTeamUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: variant === 'public' ? '#5a7a2a' : 'var(--accent)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Fan view ↗
            </a>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                border: shell.cardBorder,
                background: 'transparent',
                borderRadius: '10px',
                padding: '8px',
                cursor: 'pointer',
                color: shell.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {(
          [
            { id: 'pageContent' as const, label: 'Page & links' },
            { id: 'teamPage' as const, label: 'Logo & poll' },
            { id: 'news' as const, label: 'News' },
            { id: 'calendar' as const, label: 'Events' },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setError('')
                setActiveTab(tab.id)
              }}
              style={{
                borderRadius: '999px',
                border: `1px solid ${active ? shell.tabActiveBorder : shell.tabBorder}`,
                background: active ? shell.tabActiveBg : 'transparent',
                color: shell.text,
                padding: '7px 13px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'pageContent' ? (
        <div style={{ display: 'grid', gap: '14px' }}>
          <p style={{ fontSize: '13px', color: shell.muted, margin: 0, lineHeight: 1.5 }}>
            These fields appear on the public team page <strong style={{ color: shell.text }}>Overview</strong> tab. Use{' '}
            <strong style={{ color: shell.text }}>News</strong> and <strong style={{ color: shell.text }}>Events</strong>{' '}
            tabs here for posts and practices.
          </p>
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: shell.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Watch live / stream link
            </div>
            <p style={{ fontSize: '12px', color: shell.muted, margin: '6px 0 8px', lineHeight: 1.45 }}>
              YouTube, Twitch, or any https link. Shows as a &quot;Watch live&quot; button on the team Overview. League organizers can also set defaults and all teams in{' '}
              <strong style={{ color: shell.text }}>Dashboard → League website → Access & streams</strong>.
            </p>
            <input
              type="url"
              placeholder="https://youtube.com/..."
              value={pageDraft.stream_url}
              onChange={(e) => setPageDraft((d) => ({ ...d, stream_url: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: shell.cardBorder,
                fontSize: '13px',
                fontFamily: 'inherit',
                background: variant === 'public' ? '#fff' : 'var(--input-bg)',
                color: shell.text,
              }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: shell.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              House rules & reminders
            </div>
            <p style={{ fontSize: '12px', color: shell.muted, margin: '6px 0 8px', lineHeight: 1.45 }}>
              Parking, arrival time, jersey colors, score sheet duties—whatever your team should see first.
            </p>
            <textarea
              value={pageDraft.house_rules}
              onChange={(e) => setPageDraft((d) => ({ ...d, house_rules: e.target.value }))}
              rows={5}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: shell.cardBorder,
                fontSize: '13px',
                fontFamily: 'inherit',
                minHeight: '100px',
                background: variant === 'public' ? '#fff' : 'var(--input-bg)',
                color: shell.text,
              }}
            />
          </div>
          <div
            style={{
              border: shell.cardBorder,
              borderRadius: '10px',
              padding: '12px',
              background: variant === 'public' ? 'rgba(15,23,42,0.04)' : 'var(--bg-elevated)',
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 800, color: shell.text, marginBottom: '6px' }}>Game stats & score sheets</div>
            <p style={{ fontSize: '12px', color: shell.muted, margin: 0, lineHeight: 1.5 }}>
              Scores and stats come from games you enter under{' '}
              <Link href="/dashboard/games" style={{ fontWeight: 700, color: variant === 'public' ? '#5a7a2a' : 'var(--accent)' }}>
                Games
              </Link>
              . Pro shows main stats on the public Stats tab; Enterprise adds fouls, turnovers, and a full game log.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            style={{
              width: 'fit-content',
              fontSize: '12px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: variant === 'public' ? '#5a7a2a' : 'var(--btn-primary-bg)',
              color: variant === 'public' ? '#fff' : 'var(--btn-primary-text)',
              fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
            onClick={() => void savePublicPageFields()}
          >
            Save page & links
          </button>
          {error ? (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                padding: '10px 12px',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'teamPage' ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: shell.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Team logo
            </div>
            <p style={{ fontSize: '12px', color: shell.muted, margin: '6px 0 10px', lineHeight: 1.45 }}>
              Pro/Enterprise: shown on this public team page.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  border: shell.cardBorder,
                  background: variant === 'public' ? 'rgba(15,23,42,0.04)' : 'var(--bg-elevated)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {team.logo_url ? (
                   
                  <img src={team.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '10px', color: shell.muted, fontWeight: 700 }}>No logo</span>
                )}
              </div>
              {canUpload ? (
                <>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: shell.cardBorder,
                      borderRadius: '8px',
                      padding: '7px 12px',
                      cursor: busy ? 'wait' : 'pointer',
                      opacity: busy ? 0.7 : 1,
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    <ImagePlus size={15} /> Upload image
                    <input
                      type="file"
                      hidden
                      disabled={busy}
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        void uploadTeamLogo(file)
                      }}
                    />
                  </label>
                  {team.logo_url ? (
                    <button
                      type="button"
                      disabled={busy}
                      style={{
                        fontSize: '12px',
                        padding: '7px 12px',
                        borderRadius: '8px',
                        border: shell.cardBorder,
                        background: 'transparent',
                        cursor: busy ? 'wait' : 'pointer',
                        fontFamily: 'inherit',
                        fontWeight: 600,
                        color: shell.text,
                      }}
                      onClick={() => void clearTeamLogo()}
                    >
                      Remove logo
                    </button>
                  ) : null}
                </>
              ) : (
                <span style={{ fontSize: '12px', color: shell.muted, fontWeight: 600 }}>
                  Upgrade to Pro to upload team logos.
                </span>
              )}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: shell.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Jersey number poll
            </div>
            {openPoll ? (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '13px', marginBottom: '10px' }}>
                  Poll is open. Responses: {openPoll.responses?.length || 0}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={busy || !orgSlug}
                    style={{
                      fontSize: '12px',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: variant === 'public' ? '#5a7a2a' : 'var(--btn-primary-bg)',
                      color: variant === 'public' ? '#fff' : 'var(--btn-primary-text)',
                      fontWeight: 700,
                      cursor: busy ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                    onClick={async () => {
                      const url = `${window.location.origin}/join/${orgSlug}/jersey-poll/${openPoll.id}`
                      await navigator.clipboard.writeText(url)
                    }}
                  >
                    Copy player poll link
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    style={{
                      fontSize: '12px',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: shell.cardBorder,
                      background: 'transparent',
                      fontWeight: 700,
                      cursor: busy ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      color: shell.text,
                    }}
                    onClick={() => void closeJerseyPoll(openPoll.id)}
                  >
                    Close poll
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '8px' }}>
                <p style={{ fontSize: '13px', color: shell.muted, marginBottom: '10px', lineHeight: 1.45 }}>
                  Players pick a number with the email they used to register. You set the final numbers under Players in the dashboard.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  style={{
                    fontSize: '12px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: variant === 'public' ? '#5a7a2a' : 'var(--btn-primary-bg)',
                    color: variant === 'public' ? '#fff' : 'var(--btn-primary-text)',
                    fontWeight: 700,
                    cursor: busy ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onClick={() => void openJerseyPoll()}
                >
                  Open jersey poll
                </button>
              </div>
            )}
          </div>

          {error ? (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                padding: '10px 12px',
                fontSize: '12px',
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'news' ? (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Team news</div>
          <p style={{ fontSize: '13px', color: shell.muted, lineHeight: 1.45, marginBottom: '12px' }}>
            Post updates for players and families. Shown on this public team page.
          </p>
          <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
            <input
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: shell.cardBorder,
                fontSize: '13px',
                fontFamily: 'inherit',
                background: variant === 'public' ? '#fff' : 'var(--input-bg)',
                color: shell.text,
              }}
              placeholder="Post title"
              value={newsForm.title}
              onChange={(e) => setNewsForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: shell.cardBorder,
                fontSize: '13px',
                fontFamily: 'inherit',
                minHeight: '72px',
                background: variant === 'public' ? '#fff' : 'var(--input-bg)',
                color: shell.text,
              }}
              rows={3}
              placeholder="What changed?"
              value={newsForm.body}
              onChange={(e) => setNewsForm((f) => ({ ...f, body: e.target.value }))}
            />
            <label style={{ fontSize: '12px', color: shell.muted, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={newsForm.pinned}
                onChange={(e) => setNewsForm((f) => ({ ...f, pinned: e.target.checked }))}
              />
              Pin this post
            </label>
            <button
              type="button"
              style={{
                width: 'fit-content',
                fontSize: '12px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: variant === 'public' ? '#5a7a2a' : 'var(--btn-primary-bg)',
                color: variant === 'public' ? '#fff' : 'var(--btn-primary-text)',
                fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
              disabled={busy}
              onClick={() => void createNewsPost()}
            >
              Publish team post
            </button>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {newsPosts.length === 0 ? (
              <p style={{ fontSize: '12px', color: shell.muted }}>No team posts yet.</p>
            ) : (
              newsPosts.map((post) => (
                <div key={post.id} style={{ border: shell.cardBorder, borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>
                      {post.title}{' '}
                      {post.pinned ? (
                        <span style={{ fontSize: '10px', color: variant === 'public' ? '#5a7a2a' : 'var(--accent)' }}>
                          Pinned
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      style={{
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: shell.cardBorder,
                        background: 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        color: shell.text,
                      }}
                      onClick={() => void deleteNewsPost(post.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: shell.muted, marginTop: '6px', whiteSpace: 'pre-wrap' }}>{post.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activeTab === 'calendar' ? (
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Team calendar</div>
          <p style={{ fontSize: '13px', color: shell.muted, lineHeight: 1.45, marginBottom: '12px' }}>
            Events appear in the schedule block on this public page. Import many rows from CSV.
          </p>
          <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Event title"
              value={eventForm.title}
              onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: shell.cardBorder,
                fontSize: '13px',
                fontFamily: 'inherit',
                background: variant === 'public' ? '#fff' : 'var(--input-bg)',
                color: shell.text,
              }}
            />
            <input
              type="datetime-local"
              value={eventForm.starts_at}
              onChange={(e) => setEventForm((f) => ({ ...f, starts_at: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: shell.cardBorder,
                fontSize: '13px',
                fontFamily: 'inherit',
                background: variant === 'public' ? '#fff' : 'var(--input-bg)',
                color: shell.text,
              }}
            />
            <input
              type="datetime-local"
              value={eventForm.ends_at}
              onChange={(e) => setEventForm((f) => ({ ...f, ends_at: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: shell.cardBorder,
                fontSize: '13px',
                fontFamily: 'inherit',
                background: variant === 'public' ? '#fff' : 'var(--input-bg)',
                color: shell.text,
              }}
            />
            <input
              type="text"
              placeholder="Location"
              value={eventForm.location}
              onChange={(e) => setEventForm((f) => ({ ...f, location: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: shell.cardBorder,
                fontSize: '13px',
                fontFamily: 'inherit',
                background: variant === 'public' ? '#fff' : 'var(--input-bg)',
                color: shell.text,
              }}
            />
            <textarea
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: shell.cardBorder,
                fontSize: '13px',
                fontFamily: 'inherit',
                minHeight: '56px',
                background: variant === 'public' ? '#fff' : 'var(--input-bg)',
                color: shell.text,
              }}
              rows={2}
              placeholder="Notes"
              value={eventForm.notes}
              onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <button
              type="button"
              style={{
                width: 'fit-content',
                fontSize: '12px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: variant === 'public' ? '#5a7a2a' : 'var(--btn-primary-bg)',
                color: variant === 'public' ? '#fff' : 'var(--btn-primary-text)',
                fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
              disabled={busy}
              onClick={() => void createCalendarEvent()}
            >
              Add event
            </button>
          </div>
          <div style={{ borderTop: `1px solid ${shell.tabBorder}`, marginTop: '8px', paddingTop: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>CSV import</div>
            <p style={{ fontSize: '11px', color: shell.muted, marginBottom: '8px' }}>
              Format: <code>title,starts_at,location</code> (one event per line)
            </p>
            <textarea
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: shell.cardBorder,
                fontSize: '12px',
                fontFamily: 'inherit',
                minHeight: '88px',
                background: variant === 'public' ? '#fff' : 'var(--input-bg)',
                color: shell.text,
              }}
              rows={4}
              placeholder="Practice,2026-05-10T18:30,Main Gym"
              value={csvImport}
              onChange={(e) => setCsvImport(e.target.value)}
            />
            <button
              type="button"
              style={{
                marginTop: '8px',
                fontSize: '12px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: shell.cardBorder,
                background: 'transparent',
                fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                color: shell.text,
              }}
              disabled={busy}
              onClick={() => void importCsvEvents()}
            >
              Import rows
            </button>
          </div>
          <div style={{ borderTop: `1px solid ${shell.tabBorder}`, marginTop: '12px', paddingTop: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Upcoming</div>
            {upcomingEvents.length === 0 ? (
              <p style={{ fontSize: '12px', color: shell.muted }}>No upcoming events.</p>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {upcomingEvents.map((ev) => (
                  <div key={ev.id} style={{ border: shell.cardBorder, borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{ev.title}</div>
                      <button
                        type="button"
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: shell.cardBorder,
                          background: 'transparent',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          color: shell.text,
                        }}
                        onClick={() => void deleteEvent(ev.id)}
                      >
                        Delete
                      </button>
                    </div>
                    <div style={{ fontSize: '12px', color: shell.muted, marginTop: '4px' }}>
                      {new Date(ev.starts_at).toLocaleString()}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ borderTop: `1px solid ${shell.tabBorder}`, marginTop: '12px', paddingTop: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Recent</div>
            {recentEvents.length === 0 ? (
              <p style={{ fontSize: '12px', color: shell.muted }}>No recent events.</p>
            ) : (
              <div style={{ display: 'grid', gap: '6px' }}>
                {recentEvents.map((ev) => (
                  <div key={ev.id} style={{ fontSize: '12px', color: shell.muted }}>
                    {new Date(ev.starts_at).toLocaleDateString()} · {ev.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
