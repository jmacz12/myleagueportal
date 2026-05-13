'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, ExternalLink, ImagePlus, Loader2, Plus, Save, Send, Trash2 } from 'lucide-react'
import { InlineCircularProgress } from '@/components/league-site/InlineCircularProgress'
import { LeagueSiteAccessPanel } from '@/components/dashboard/LeagueSiteAccessPanel'
import { LeagueSiteContentSectionFields } from '@/components/league-site/LeagueSiteOnPageEditor'
import { resolveThemePreset } from '@/lib/leagueTheme'
import type { LeagueSiteContentSurface, LeagueSitePayload, LeagueSiteSection } from '@/lib/league-site'
import {
  DEFAULT_LEAGUE_HERO_TAGLINE,
  EMPTY_LEAGUE_SITE,
  LEAGUE_SITE_MEDIA_PLACEMENT_LABELS,
  createLeagueSiteContentSection,
  createLeagueSiteSection,
} from '@/lib/league-site'
import { countGalleryImages } from '@/lib/league-site-limits'
import { subscribeLeagueAppearanceUpdated } from '@/lib/league-appearance-sync'

type EditorRow = {
  id: string
  clerk_user_id: string
  invited_email: string | null
  created_at: string
}

export default function LeagueSitePage() {
  return (
    <Suspense fallback={<p style={{ color: 'var(--sidebar-text)' }}>Loading…</p>}>
      <LeagueSitePageClient />
    </Suspense>
  )
}

function LeagueSitePageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState('')
  const [role, setRole] = useState<'owner' | 'editor' | ''>('')
  const [draft, setDraft] = useState<LeagueSitePayload>(EMPTY_LEAGUE_SITE)
  const [published, setPublished] = useState<LeagueSitePayload>(EMPTY_LEAGUE_SITE)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [editors, setEditors] = useState<EditorRow[]>([])
  const [editorEmail, setEditorEmail] = useState('')
  const [editorBusy, setEditorBusy] = useState(false)

  const [dashCreativeSurface, setDashCreativeSurface] = useState<LeagueSiteContentSurface>('about')
  const dashboardSiteEditorPreset = useMemo(() => resolveThemePreset(null, null, 'light'), [])
  const [maxGalleryImages, setMaxGalleryImages] = useState(100)
  const [orgPlan, setOrgPlan] = useState('basic')
  const [heroUploading, setHeroUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/league-site')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not load')
        return
      }
      setDraft(data.draft ?? EMPTY_LEAGUE_SITE)
      setPublished(data.published ?? EMPTY_LEAGUE_SITE)
      setSlug(data.slug ?? '')
      setRole(data.role ?? '')
      setMaxGalleryImages(typeof data.maxGalleryImages === 'number' ? data.maxGalleryImages : 100)
      setOrgPlan(typeof data.plan === 'string' ? data.plan : 'basic')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEditors = useCallback(async () => {
    const res = await fetch('/api/organization-editors')
    if (!res.ok) return
    const data = await res.json().catch(() => ({}))
    setEditors(Array.isArray(data.editors) ? data.editors : [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    return subscribeLeagueAppearanceUpdated(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    if (role === 'owner') loadEditors()
  }, [role, loadEditors])

  async function saveDraft() {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/league-site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Save failed')
        return
      }
      setDraft(data.draft ?? draft)
      setMessage('Draft saved.')
    } finally {
      setSaving(false)
    }
  }

  async function publishSite() {
    setPublishing(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch('/api/league-site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, publish: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Publish failed')
        return
      }
      setDraft(data.draft ?? draft)
      setPublished(data.published ?? published)
      setMessage('Published — visitors now see this version.')
    } finally {
      setPublishing(false)
    }
  }

  async function uploadHero(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setError('')
    setHeroUploading(true)
    try {
      const res = await fetch('/api/league-site/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Upload failed')
        return
      }
      if (typeof data.url === 'string') {
        setDraft((d) => ({ ...d, heroBackgroundUrl: data.url }))
      }
    } finally {
      setHeroUploading(false)
    }
  }

  function updateSection(id: string, fn: (s: LeagueSiteSection) => LeagueSiteSection) {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === id ? fn(s) : s)),
    }))
  }

  function removeSection(id: string) {
    setDraft((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id) }))
  }

  function moveSection(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      const next = idx + dir
      if (next < 0 || next >= d.sections.length) return d
      const copy = [...d.sections]
      const tmp = copy[idx]
      copy[idx] = copy[next]
      copy[next] = tmp
      return { ...d, sections: copy }
    })
  }

  async function addEditor() {
    setEditorBusy(true)
    setError('')
    try {
      const res = await fetch('/api/organization-editors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: editorEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not add editor')
        return
      }
      setEditorEmail('')
      await loadEditors()
      setMessage('Editor added. They can open Dashboard → League website after signing in.')
    } finally {
      setEditorBusy(false)
    }
  }

  async function removeEditor(clerkUserId: string) {
    setEditorBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/organization-editors?clerkUserId=${encodeURIComponent(clerkUserId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Remove failed')
        return
      }
      await loadEditors()
    } finally {
      setEditorBusy(false)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--sidebar-text)' }}>Loading…</p>
  }

  const publicUrl = slug ? `/league/${slug}` : ''
  const activeTab =
    role === 'owner' && searchParams.get('section') === 'access' ? 'access' : 'content'

  return (
    <div style={{ maxWidth: '720px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: 'var(--sidebar-text-active)' }}>
        League website
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--sidebar-text)', margin: '0 0 24px', lineHeight: 1.5 }}>
        Easiest: open your public league page and use <strong>Edit page</strong> (or add <code style={{ fontSize: '12px' }}>?edit=1</code> to the URL). You can also
        edit here. <strong>Save</strong> keeps a draft; <strong>Publish</strong> shows it to everyone.
      </p>

      {role === 'owner' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
          <button
            type="button"
            onClick={() => router.replace('/dashboard/league-site')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: activeTab === 'content' ? '2px solid var(--sidebar-active-border)' : '1px solid var(--sidebar-border)',
              background: activeTab === 'content' ? 'var(--sidebar-active-bg)' : 'var(--bg-elevated, #fff)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--sidebar-text-active)',
            }}
          >
            Website content
          </button>
          <button
            type="button"
            onClick={() => router.replace('/dashboard/league-site?section=access')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: activeTab === 'access' ? '2px solid var(--sidebar-active-border)' : '1px solid var(--sidebar-border)',
              background: activeTab === 'access' ? 'var(--sidebar-active-bg)' : 'var(--bg-elevated, #fff)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--sidebar-text-active)',
            }}
          >
            Access & streams
          </button>
        </div>
      ) : null}

      {message ? (
        <p style={{ fontSize: '13px', color: '#15803d', marginBottom: '12px' }}>{message}</p>
      ) : null}
      {error ? (
        <p style={{ fontSize: '13px', color: '#b91c1c', marginBottom: '12px' }}>{error}</p>
      ) : null}

      {activeTab === 'content' ? (
        <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
        {publicUrl ? (
          <Link
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--sidebar-active-border)',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={16} /> View public page
          </Link>
        ) : null}
        {publicUrl ? (
          <Link
            href={`${publicUrl}?edit=1`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--sidebar-text)',
              textDecoration: 'none',
            }}
          >
            Open with edit banner
          </Link>
        ) : null}
      </div>

      {publicUrl ? (
        <Link
          href={`${publicUrl}?edit=1`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '14px 18px',
            marginBottom: '24px',
            borderRadius: '12px',
            background: 'var(--sidebar-active-border)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '15px',
            textDecoration: 'none',
            boxShadow: '0 6px 18px -8px rgba(0,0,0,0.35)',
          }}
        >
          Open live editor on your league page
        </Link>
      ) : null}

      <section
        style={{
          background: 'var(--bg-elevated, #fff)',
          border: '0.5px solid var(--sidebar-border)',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '18px',
        }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 12px' }}>Hero background</h2>
        <p style={{ fontSize: '13px', color: 'var(--sidebar-text)', margin: '0 0 12px', lineHeight: 1.45 }}>
          Optional photo behind the top banner on your public league home. Images are scaled to <strong>fill the banner</strong> (like{' '}
          <strong>cover</strong> crop): they stay centered, and the sides or top/bottom may be cropped on different screen sizes. A{' '}
          <strong>wide</strong> shot works best.
        </p>
        <p style={{ fontSize: '12px', color: 'var(--sidebar-text)', margin: '0 0 12px', lineHeight: 1.45 }}>
          <strong>Suggested size:</strong> about <strong>1920 × 640 px</strong> (or similar wide ratio, e.g. 3:1). Use at least{' '}
          <strong>~1600px width</strong> so it stays sharp on large displays. A dark overlay keeps your league name readable on busy photos.
        </p>
        {draft.heroBackgroundUrl ? (
          <div style={{ marginBottom: '10px' }}>
            { }
            <img src={draft.heroBackgroundUrl} alt="" style={{ maxHeight: '120px', borderRadius: '8px' }} />
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: heroUploading ? 'wait' : 'pointer',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--sidebar-border)',
              opacity: heroUploading ? 0.85 : 1,
            }}
          >
            {heroUploading ? (
              <InlineCircularProgress indeterminate color="var(--sidebar-active-border)" aria-label="Uploading hero image" />
            ) : (
              <ImagePlus size={16} aria-hidden />
            )}
            {heroUploading ? 'Uploading…' : 'Upload image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              disabled={heroUploading}
              onChange={uploadHero}
            />
          </label>
          <button
            type="button"
            disabled={heroUploading}
            onClick={() => setDraft((d) => ({ ...d, heroBackgroundUrl: null }))}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              color: 'var(--sidebar-text)',
              cursor: heroUploading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              opacity: heroUploading ? 0.45 : 1,
            }}
          >
            Clear
          </button>
        </div>
        <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '0.5px solid var(--sidebar-border)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 8px' }}>Hero tagline</h3>
          <p style={{ fontSize: '12px', color: 'var(--sidebar-text)', margin: '0 0 10px', lineHeight: 1.45 }}>
            Shown under your league name on the public home and join pages. Leave blank to use the default line.
          </p>
          <textarea
            value={draft.heroTagline ?? ''}
            onChange={(e) => {
              const v = e.target.value
              setDraft((d) => ({ ...d, heroTagline: v.trim() === '' ? null : v }))
            }}
            rows={3}
            placeholder={DEFAULT_LEAGUE_HERO_TAGLINE}
            style={{
              width: '100%',
              maxWidth: '100%',
              fontSize: '13px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--sidebar-border)',
              background: 'var(--bg-elevated, #fff)',
              color: 'var(--sidebar-text-active)',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              resize: 'vertical',
              minHeight: '72px',
            }}
          />
        </div>
        <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 8px' }}>Logo initials (no logo image)</h3>
          <p style={{ fontSize: '12px', color: 'var(--sidebar-text)', margin: '0 0 10px', lineHeight: 1.45 }}>
            Letters in the colored square when you have not uploaded a league logo. Leave blank to auto-use initials from your league name.
          </p>
          <input
            type="text"
            value={draft.heroInitials ?? ''}
            maxLength={3}
            onChange={(e) => {
              const t = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)
              setDraft((d) => ({ ...d, heroInitials: t === '' ? null : t }))
            }}
            placeholder="e.g. VH"
            aria-label="Logo placeholder initials"
            style={{
              width: '72px',
              fontSize: '15px',
              fontWeight: 800,
              textAlign: 'center',
              padding: '10px 8px',
              borderRadius: '8px',
              border: '1px solid var(--sidebar-border)',
              background: 'var(--bg-elevated, #fff)',
              color: 'var(--sidebar-text-active)',
              fontFamily: 'inherit',
            }}
          />
        </div>
      </section>

      <details
        style={{
          background: 'var(--bg-elevated, #fff)',
          border: '0.5px solid var(--sidebar-border)',
          borderRadius: '12px',
          padding: '18px',
          marginBottom: '18px',
        }}
      >
        <summary
          style={{
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            listStyle: 'none',
          }}
        >
          Page sections{' '}
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--sidebar-text)' }}>
            (optional — same blocks as the live editor)
          </span>
        </summary>
        <div style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--sidebar-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Add blocks
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {(['home', 'news', 'about'] as const).map((surf) => (
              <button
                key={surf}
                type="button"
                onClick={() => setDashCreativeSurface(surf)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '999px',
                  border: `1px solid ${dashCreativeSurface === surf ? 'var(--sidebar-active-border)' : 'var(--sidebar-border)'}`,
                  background: dashCreativeSurface === surf ? 'rgba(90,122,42,0.12)' : 'transparent',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: 'var(--sidebar-text-active)',
                }}
              >
                {surf === 'home' ? 'Home' : surf === 'news' ? 'News' : 'About'}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, sections: [createLeagueSiteContentSection(dashCreativeSurface), ...d.sections] }))
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--sidebar-active-border)',
                background: 'rgba(90,122,42,0.12)',
                cursor: 'pointer',
                color: 'var(--sidebar-text-active)',
              }}
            >
              <Plus size={14} /> New block
            </button>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--sidebar-text)', margin: '12px 0 10px', lineHeight: 1.5 }}>
          Public page order: <strong>Hero</strong> (name, logo, photo) → <strong>Join / Drop-ins</strong> (set elsewhere) → <strong>sections below</strong> →{' '}
          <strong>Season and teams</strong>.
        </p>
        <ul style={{ fontSize: '12px', color: 'var(--sidebar-text)', margin: '0 0 14px', paddingLeft: '18px', lineHeight: 1.5 }}>
          <li>
            <strong>New block</strong> — title, text, and one adjustable photo (Home, News, or About). Matches the in-page editor.
          </li>
          <li>
            <strong>Legacy Text / News / Media</strong> — still supported for older layouts; prefer new blocks for new content.
          </li>
        </ul>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--sidebar-text)' }}>Legacy add:</span>
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, sections: [createLeagueSiteSection('text'), ...d.sections] }))}
            style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--sidebar-border)', background: 'transparent', cursor: 'pointer' }}
          >
            Text
          </button>
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, sections: [createLeagueSiteSection('news'), ...d.sections] }))}
            style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--sidebar-border)', background: 'transparent', cursor: 'pointer' }}
          >
            News
          </button>
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, sections: [createLeagueSiteSection('media'), ...d.sections] }))}
            style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--sidebar-border)', background: 'transparent', cursor: 'pointer' }}
          >
            Media
          </button>
        </div>

        {draft.sections.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--sidebar-text)', margin: '14px 0 0' }}>
            Add a section with the buttons above. Visitors only see it after you <strong>Publish</strong>.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
            {draft.sections.map((sec, idx) => (
              <div
                key={sec.id}
                style={{
                  border: '1px dashed var(--sidebar-border)',
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--sidebar-text)', textTransform: 'uppercase' }}>
                    {sec.type === 'text'
                      ? 'Text block'
                      : sec.type === 'news'
                        ? 'News block'
                        : sec.type === 'media'
                          ? 'Media block'
                          : `Creative block (${sec.surface})`}{' '}
                    · position {idx + 1} on page
                  </span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      title="Move block up"
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, -1)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--sidebar-border)',
                        background: 'var(--bg-elevated, #fff)',
                        cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        opacity: idx === 0 ? 0.45 : 1,
                      }}
                    >
                      <ChevronUp size={14} /> Up
                    </button>
                    <button
                      type="button"
                      title="Move block down"
                      disabled={idx >= draft.sections.length - 1}
                      onClick={() => moveSection(idx, 1)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--sidebar-border)',
                        background: 'var(--bg-elevated, #fff)',
                        cursor: idx >= draft.sections.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: idx >= draft.sections.length - 1 ? 0.45 : 1,
                      }}
                    >
                      <ChevronDown size={14} /> Down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(sec.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#b91c1c',
                        padding: '4px',
                      }}
                      aria-label="Remove section"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                  Section heading (public)
                </label>
                <input
                  value={sec.title}
                  onChange={(e) => updateSection(sec.id, (s) => ({ ...s, title: e.target.value } as LeagueSiteSection))}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--sidebar-border)',
                    marginBottom: '10px',
                    fontSize: '14px',
                  }}
                />
                {sec.type === 'media' ? (
                  <>
                    <p style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 6px', color: 'var(--sidebar-text-active)' }}>Photo layout</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {(['below', 'behind'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            updateSection(sec.id, (s) => (s.type === 'media' ? { ...s, mediaLayout: m } : s))
                          }
                          style={{
                            padding: '5px 9px',
                            borderRadius: '6px',
                            border: `1px solid ${sec.mediaLayout === m ? 'var(--sidebar-active-border)' : 'var(--sidebar-border)'}`,
                            background: sec.mediaLayout === m ? 'rgba(90,122,42,0.12)' : 'transparent',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: 'var(--sidebar-text-active)',
                          }}
                        >
                          {LEAGUE_SITE_MEDIA_PLACEMENT_LABELS[m]}
                        </button>
                      ))}
                    </div>
                    <MediaEditor
                      section={sec}
                      draft={draft}
                      maxGalleryImages={maxGalleryImages}
                      orgPlan={orgPlan}
                      onChange={(next) => updateSection(sec.id, () => next)}
                    />
                  </>
                ) : sec.type === 'news' ? (
                  <>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                      News content (News tab + latest on league home)
                    </label>
                    <textarea
                      value={sec.body}
                      onChange={(e) =>
                        updateSection(sec.id, (s) => (s.type === 'news' ? { ...s, body: e.target.value } : s))
                      }
                      rows={6}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--sidebar-border)',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        marginBottom: '10px',
                      }}
                    />
                    <p style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 6px', color: 'var(--sidebar-text-active)' }}>
                      Photo placement
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {(['below', 'left', 'right', 'behind'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            updateSection(sec.id, (s) => (s.type === 'news' ? { ...s, mediaLayout: m } : s))
                          }
                          style={{
                            padding: '5px 9px',
                            borderRadius: '6px',
                            border: `1px solid ${sec.mediaLayout === m ? 'var(--sidebar-active-border)' : 'var(--sidebar-border)'}`,
                            background: sec.mediaLayout === m ? 'rgba(90,122,42,0.12)' : 'transparent',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: 'var(--sidebar-text-active)',
                          }}
                        >
                          {LEAGUE_SITE_MEDIA_PLACEMENT_LABELS[m]}
                        </button>
                      ))}
                    </div>
                    <MediaEditor
                      section={sec}
                      draft={draft}
                      maxGalleryImages={maxGalleryImages}
                      orgPlan={orgPlan}
                      onChange={(next) => updateSection(sec.id, () => next)}
                    />
                  </>
                ) : sec.type === 'content' ? (
                  <LeagueSiteContentSectionFields
                    sec={sec}
                    value={draft}
                    preset={dashboardSiteEditorPreset}
                    maxGalleryImages={maxGalleryImages}
                    updateSection={updateSection}
                    onNavigateToCreativeSurface={(surf) => setDashCreativeSurface(surf)}
                  />
                ) : (
                  <>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                      Main text (appears under the heading on the league home, below Join / Drop-ins)
                    </label>
                    <textarea
                      value={sec.body}
                      onChange={(e) =>
                        updateSection(sec.id, (s) => (s.type === 'text' ? { ...s, body: e.target.value } : s))
                      }
                      rows={8}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--sidebar-border)',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        </div>
      </details>
        </>
      ) : (
        <LeagueSiteAccessPanel
          slug={slug}
          editors={editors}
          editorEmail={editorEmail}
          setEditorEmail={setEditorEmail}
          addEditor={addEditor}
          removeEditor={removeEditor}
          editorBusy={editorBusy}
        />
      )}

      {activeTab === 'content' ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <button
          type="button"
          disabled={saving}
          onClick={saveDraft}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid var(--sidebar-border)',
            background: 'var(--bg-elevated, #fff)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Save size={18} aria-hidden />}{' '}
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          disabled={publishing}
          onClick={publishSite}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            borderRadius: '10px',
            border: 'none',
            background: 'var(--sidebar-active-border)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '14px',
            cursor: publishing ? 'wait' : 'pointer',
          }}
        >
          {publishing ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Send size={18} aria-hidden />}{' '}
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
        <span style={{ fontSize: '12px', color: 'var(--sidebar-text)' }}>
          Live site uses the last published version ({published.sections.length} sections).
        </span>
      </div>
      ) : null}
    </div>
  )
}

function MediaEditor({
  section,
  draft,
  maxGalleryImages,
  orgPlan,
  onChange,
}: {
  section: Extract<LeagueSiteSection, { type: 'media' }> | Extract<LeagueSiteSection, { type: 'news' }>
  draft: LeagueSitePayload
  maxGalleryImages: number
  orgPlan: string
  onChange: (s: Extract<LeagueSiteSection, { type: 'media' }> | Extract<LeagueSiteSection, { type: 'news' }>) => void
}) {
  const [uploadBatch, setUploadBatch] = useState<{ current: number; total: number } | null>(null)

  const galleryTotal = countGalleryImages(draft)
  const overLimit = galleryTotal > maxGalleryImages
  const remainingSlots = Math.max(0, maxGalleryImages - galleryTotal)
  const uploadBusy = uploadBatch !== null

  async function addFromFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return
    const take = files.slice(0, remainingSlots)
    if (!take.length) return

    let items = [...section.items]
    try {
      for (let i = 0; i < take.length; i++) {
        setUploadBatch({ current: i + 1, total: take.length })
        const file = take[i]
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/league-site/upload', { method: 'POST', body: fd })
        const data = await res.json().catch(() => ({}))
        if (res.ok && typeof data.url === 'string') {
          items = [...items, { url: data.url, kind: 'image' as const }]
        }
      }
      if (items.length !== section.items.length) {
        onChange({ ...section, items })
      }
    } finally {
      setUploadBatch(null)
    }
  }

  return (
    <div>
      <p style={{ fontSize: '12px', color: 'var(--sidebar-text)', margin: '0 0 8px', lineHeight: 1.45 }}>
        Gallery photos (all media + news blocks): <strong>{galleryTotal}</strong> / {maxGalleryImages}{' '}
        <span style={{ fontSize: '11px', opacity: 0.85 }}>({orgPlan} plan)</span>
        {overLimit ? (
          <span style={{ color: '#b91c1c', fontWeight: 700 }}> — over limit; save or publish will fail until you remove images.</span>
        ) : null}
      </p>
      <p style={{ fontSize: '12px', color: 'var(--sidebar-text)', margin: '0 0 10px', lineHeight: 1.45 }}>
        Photos appear on the league home with zoom; large galleries use a carousel. Video links open in a new tab.
      </p>
      {uploadBatch ? (
        <div
          role="status"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '12px',
            padding: '8px 12px',
            borderRadius: '10px',
            border: '1px solid var(--sidebar-border)',
            background: 'var(--bg-elevated, #fff)',
          }}
        >
          <InlineCircularProgress
            indeterminate
            color="var(--sidebar-active-border)"
            aria-label={`Uploading photo ${uploadBatch.current} of ${uploadBatch.total}`}
          />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--sidebar-text-active)' }}>
            Uploading photo {uploadBatch.current} of {uploadBatch.total}…
          </span>
        </div>
      ) : null}
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: remainingSlots > 0 && !uploadBusy ? 'pointer' : 'not-allowed',
          opacity: remainingSlots > 0 && !uploadBusy ? 1 : 0.65,
        }}
      >
        <Plus size={14} aria-hidden /> Add images
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          disabled={remainingSlots <= 0 || uploadBusy}
          onChange={addFromFiles}
        />
      </label>
      <p style={{ fontSize: '12px', color: 'var(--sidebar-text)', margin: '8px 0' }}>
        Or paste a hosted image or embed URL below (one per line). For video, use a direct file URL or a link; visitors open it in a new tab.
      </p>
      <textarea
        placeholder="https://…"
        value={section.items.map((i) => i.url).join('\n')}
        onChange={(e) => {
          const lines = e.target.value
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
          onChange({
            ...section,
            items: lines.map((url) => ({
              url,
              kind: url.match(/\.(mp4|webm)(\?|$)/i) ? ('video' as const) : ('image' as const),
            })),
          })
        }}
        rows={4}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: '8px',
          border: '1px solid var(--sidebar-border)',
          fontSize: '13px',
          fontFamily: 'monospace',
        }}
      />
    </div>
  )
}
