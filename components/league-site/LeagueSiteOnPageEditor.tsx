'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ImagePlus, Loader2, Palette, Plus, Save, Send, Trash2, X } from 'lucide-react'
import type { LeagueAppearanceMode, ThemePreset } from '@/lib/leagueTheme'
import { sanitizeLeagueAppearanceMode } from '@/lib/public-league-branding'
import {
  LEAGUE_THEME_CHOICE_META,
  LEAGUE_THEME_CHOICE_ORDER,
  appearanceModeForChoice,
  normalizeLeagueThemePresetId,
  type LeagueThemeChoiceId,
} from '@/lib/league-theme-choice'
import type { LeagueSitePayload, LeagueSiteSection } from '@/lib/league-site'
import { PUBLIC_LEAGUE_FONT_OPTIONS } from '@/lib/public-league-fonts'
import { createLeagueSiteSection } from '@/lib/league-site'
import { countGalleryImages } from '@/lib/league-site-limits'
import { InlineCircularProgress } from '@/components/league-site/InlineCircularProgress'

export function LeagueSiteStickyEditBar({
  preset,
  saving,
  publishing,
  onSaveDraft,
  onPublish,
  doneHref,
  statusMessage,
  errorMessage,
  websiteLockedForPlan,
  websiteLockedMessage,
}: {
  preset: ThemePreset
  saving: boolean
  publishing: boolean
  onSaveDraft: () => void
  onPublish: () => void
  doneHref: string
  statusMessage: string
  errorMessage: string
  /** Basic plan: draft/publish disabled — league website is a Pro+ feature */
  websiteLockedForPlan?: boolean
  websiteLockedMessage?: string
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        padding: '10px 16px',
        background: preset.surfaceBg,
        borderBottom: `1px solid ${preset.surfaceBorder}`,
        boxShadow: '0 6px 20px -8px rgba(0,0,0,0.25)',
      }}
    >
      <div
        style={{
          maxWidth: '1000px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
          justifyContent: 'space-between',
        }}
      >
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: preset.heading }}>
          {websiteLockedForPlan
            ? websiteLockedMessage ||
              'League website editing needs Pro or Enterprise. Upgrade in Settings to save a custom public page.'
            : 'Editing draft — visitors still see the last published version until you Publish.'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            disabled={saving || websiteLockedForPlan}
            onClick={onSaveDraft}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '10px',
              border: `1px solid ${preset.surfaceBorder}`,
              background: preset.pageBg,
              color: preset.body,
              fontWeight: 700,
              fontSize: '13px',
              cursor: websiteLockedForPlan ? 'not-allowed' : saving ? 'wait' : 'pointer',
              opacity: websiteLockedForPlan ? 0.45 : 1,
            }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}{' '}
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            type="button"
            disabled={publishing || websiteLockedForPlan}
            onClick={onPublish}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '10px',
              border: 'none',
              background: preset.accent,
              color: '#fff',
              fontWeight: 800,
              fontSize: '13px',
              cursor: publishing || websiteLockedForPlan ? 'not-allowed' : 'pointer',
              opacity: websiteLockedForPlan ? 0.45 : 1,
            }}
          >
            {publishing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}{' '}
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
          <Link
            href={doneHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '13px',
              color: preset.body,
              textDecoration: 'none',
              border: `1px solid ${preset.surfaceBorder}`,
            }}
          >
            <X size={16} /> Done
          </Link>
        </div>
      </div>
      {statusMessage ? (
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#15803d', maxWidth: '1000px', marginLeft: 'auto', marginRight: 'auto' }}>
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#b91c1c', maxWidth: '1000px', marginLeft: 'auto', marginRight: 'auto' }}>
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}

export function LeagueSiteLookControls({
  draftSite,
  onDraftChange,
  preset,
  accessRole,
  orgPlan,
  orgPrimaryColor,
  orgThemePreset,
  orgAppearanceMode,
  onAppearanceApplied,
  onPreviewChange,
  websiteLockedForPlan,
  appearanceMeta,
}: {
  draftSite: LeagueSitePayload
  onDraftChange: (fn: (prev: LeagueSitePayload) => LeagueSitePayload) => void
  preset: ThemePreset
  accessRole: 'owner' | 'editor'
  orgPlan: string
  orgPrimaryColor: string | null
  orgThemePreset: string | null
  orgAppearanceMode?: string | null
  onAppearanceApplied: (o: {
    primary_color: string | null
    league_theme_preset: string
    league_appearance_mode: LeagueAppearanceMode
  }) => void
  /** Live page preview while editing (Pro/Enterprise owners only). */
  onPreviewChange?: (v: {
    primary_color: string
    league_theme_preset: string
    league_appearance_mode: LeagueAppearanceMode
  }) => void
  /** Basic: website CMS locked — typography saved with draft is disabled */
  websiteLockedForPlan?: boolean
  appearanceMeta?: {
    proBrandColorChangesRemaining: number | null
    proBrandColorChangesMonthlyLimit: number
  }
}) {
  const [open, setOpen] = useState(true)
  const [appearanceSaving, setAppearanceSaving] = useState(false)
  const [appearanceError, setAppearanceError] = useState('')
  const [appearanceOk, setAppearanceOk] = useState('')
  const [localColor, setLocalColor] = useState(() => orgPrimaryColor || '#5a7a2a')
  const [localThemeChoice, setLocalThemeChoice] = useState<LeagueThemeChoiceId>(() =>
    normalizeLeagueThemePresetId(orgThemePreset, orgAppearanceMode)
  )

  const planLower = String(orgPlan || 'basic').toLowerCase()
  const canEditTheme = accessRole === 'owner' && planLower !== 'basic'
  const basicOwner = accessRole === 'owner' && planLower === 'basic'
  const isPro = planLower === 'pro'

  useEffect(() => {
    setLocalColor(orgPrimaryColor || '#5a7a2a')
    setLocalThemeChoice(normalizeLeagueThemePresetId(orgThemePreset, orgAppearanceMode))
  }, [orgPrimaryColor, orgThemePreset, orgAppearanceMode])

  useEffect(() => {
    if (!onPreviewChange || !canEditTheme) return
    onPreviewChange({
      primary_color: localColor,
      league_theme_preset: localThemeChoice,
      league_appearance_mode: appearanceModeForChoice(localThemeChoice),
    })
  }, [onPreviewChange, canEditTheme, localColor, localThemeChoice])

  async function saveAppearance() {
    if (!canEditTheme) return
    setAppearanceSaving(true)
    setAppearanceError('')
    setAppearanceOk('')
    try {
      const res = await fetch('/api/league-org-appearance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_color: localColor,
          league_theme_preset: localThemeChoice,
          league_appearance_mode: appearanceModeForChoice(localThemeChoice),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAppearanceError(typeof data.error === 'string' ? data.error : 'Could not save appearance.')
        return
      }
      if (typeof data.warning === 'string') {
        setAppearanceOk(data.warning)
      } else {
        setAppearanceOk('Saved. Visitors see this update immediately.')
      }
      if (data.organization) {
        onAppearanceApplied({
          primary_color: data.organization.primary_color ?? null,
          league_theme_preset: String(data.organization.league_theme_preset || 'classic'),
          league_appearance_mode: sanitizeLeagueAppearanceMode(data.organization.league_appearance_mode),
        })
      }
    } finally {
      setAppearanceSaving(false)
    }
  }

  const fontSelectValue = draftSite.publicFontKey ?? 'plus-jakarta'

  return (
    <div
      style={{
        borderBottom: `1px solid ${preset.surfaceBorder}`,
        background: preset.accentSoftBg,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          maxWidth: '1000px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 20px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 800, color: preset.heading }}>
          <Palette size={18} aria-hidden style={{ color: preset.accent }} />
          Typography & theme
        </span>
        {open ? <ChevronUp size={18} color={preset.muted} /> : <ChevronDown size={18} color={preset.muted} />}
      </button>

      {open ? (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: preset.muted, marginBottom: '8px' }}>
              Page font (saved with draft / Publish)
            </label>
            <select
              value={fontSelectValue}
              disabled={!!websiteLockedForPlan}
              onChange={(e) => {
                const v = e.target.value
                onDraftChange((prev) => ({
                  ...prev,
                  publicFontKey: v === 'plus-jakarta' ? null : v,
                }))
              }}
              style={{
                width: '100%',
                maxWidth: '360px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: `1px solid ${preset.surfaceBorder}`,
                background: preset.surfaceBg,
                color: preset.heading,
                fontWeight: 600,
                fontSize: '14px',
                opacity: websiteLockedForPlan ? 0.55 : 1,
                cursor: websiteLockedForPlan ? 'not-allowed' : 'pointer',
              }}
            >
              {PUBLIC_LEAGUE_FONT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: preset.muted, lineHeight: 1.45 }}>
              {websiteLockedForPlan
                ? 'Custom fonts are part of the league website editor on Pro and Enterprise.'
                : 'Applies to this league home and join hub pages. Save draft or Publish to ship font changes.'}
            </p>
          </div>

          {accessRole === 'editor' ? (
            <p style={{ margin: 0, fontSize: '13px', color: preset.body, lineHeight: 1.5 }}>
              Brand color and palette presets can only be changed by the league owner (Dashboard → Settings or owner edit session).
            </p>
          ) : null}

          {basicOwner ? (
            <>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.surfaceBg,
                  fontSize: '13px',
                  color: preset.body,
                  lineHeight: 1.55,
                }}
              >
                <strong style={{ color: preset.heading }}>Brand color and five theme presets</strong> (Classic, Bold, Soft, Bright, Midnight) sync with{' '}
                <strong style={{ color: preset.heading }}>Dashboard → Settings</strong> on{' '}
                <strong style={{ color: preset.heading }}>Pro</strong> and <strong style={{ color: preset.heading }}>Enterprise</strong>.{' '}
                <Link href="/dashboard/settings" style={{ fontWeight: 800, color: preset.accent }}>
                  Upgrade
                </Link>{' '}
                to unlock. Below is a preview of what you&apos;ll control.
              </div>
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: preset.muted }}>
                  Pro preview (locked)
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', opacity: 0.55, pointerEvents: 'none' }}>
                  {LEAGUE_THEME_CHOICE_ORDER.map((id) => (
                    <span
                      key={id}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '999px',
                        border: `1px solid ${preset.surfaceBorder}`,
                        background: preset.surfaceBg,
                        color: preset.heading,
                        fontSize: '12px',
                        fontWeight: 700,
                      }}
                    >
                      {LEAGUE_THEME_CHOICE_META[id].name}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {canEditTheme ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: preset.heading }}>Brand color</label>
                <input
                  type="color"
                  value={localColor}
                  onChange={(e) => setLocalColor(e.target.value)}
                  style={{
                    width: '44px',
                    height: '36px',
                    borderRadius: '8px',
                    border: `1px solid ${preset.surfaceBorder}`,
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                  aria-label="Brand color"
                />
                <span style={{ fontSize: '12px', color: preset.muted }}>{localColor}</span>
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.surfaceBg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: preset.muted }}>
                    Theme preset
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: preset.muted, lineHeight: 1.45 }}>
                    Choose one of five public looks. <strong style={{ color: preset.heading }}>Bright</strong> and{' '}
                    <strong style={{ color: preset.heading }}>Midnight</strong> are full presets alongside Classic, Bold, and Soft.
                  </p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  {LEAGUE_THEME_CHOICE_ORDER.map((choiceId) => {
                    const meta = LEAGUE_THEME_CHOICE_META[choiceId]
                    const selected = localThemeChoice === choiceId
                    return (
                      <button
                        key={choiceId}
                        type="button"
                        title={meta.description}
                        onClick={() => setLocalThemeChoice(choiceId)}
                        style={{
                          flex: '0 0 auto',
                          borderRadius: '999px',
                          border: `2px solid ${selected ? preset.accent : preset.surfaceBorder}`,
                          padding: '8px 14px',
                          background: selected ? preset.accentSoftBg : preset.pageBg,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontWeight: 800,
                          fontSize: '12px',
                          color: preset.heading,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {meta.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                disabled={appearanceSaving}
                onClick={() => void saveAppearance()}
                style={{
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  background: preset.accent,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: appearanceSaving ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {appearanceSaving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                {appearanceSaving ? 'Saving…' : 'Save brand & theme'}
              </button>
              {isPro &&
              appearanceMeta?.proBrandColorChangesRemaining != null &&
              appearanceMeta.proBrandColorChangesMonthlyLimit ? (
                <p style={{ margin: 0, fontSize: '12px', color: preset.muted, lineHeight: 1.45 }}>
                  <strong style={{ color: preset.heading }}>Pro:</strong> brand <em>color</em> changes left this month:{' '}
                  <strong style={{ color: preset.heading }}>
                    {appearanceMeta.proBrandColorChangesRemaining}
                  </strong>{' '}
                  / {appearanceMeta.proBrandColorChangesMonthlyLimit}. Theme presets and fonts don&apos;t count toward this cap.
                </p>
              ) : null}
            </>
          ) : null}

          {appearanceError ? (
            <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>{appearanceError}</p>
          ) : null}
          {appearanceOk ? (
            <p style={{ margin: 0, fontSize: '12px', color: '#15803d', fontWeight: 600 }}>{appearanceOk}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function LeagueSiteHeroEditOverlay({
  preset,
  heroBackgroundUrl,
  heroTagline,
  heroInitials,
  onChangeUrl,
  onChangeTagline,
  onChangeInitials,
}: {
  preset: ThemePreset
  heroBackgroundUrl: string | null
  /** Subtitle under the league name (publish saves full draft). */
  heroTagline: string | null
  /** Logo placeholder when no logo image (1–3 characters). */
  heroInitials: string | null
  onChangeUrl: (url: string | null) => void
  onChangeTagline: (value: string | null) => void
  onChangeInitials: (value: string | null) => void
}) {
  const [heroUploading, setHeroUploading] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setHeroUploading(true)
    try {
      const res = await fetch('/api/league-site/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data.url === 'string') onChangeUrl(data.url)
    } finally {
      setHeroUploading(false)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'stretch',
        maxWidth: '100%',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
      <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>Hero background</span>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: heroUploading ? 'wait' : 'pointer',
          padding: '6px 12px',
          borderRadius: '8px',
          background: preset.surfaceBg,
          color: preset.heading,
          opacity: heroUploading ? 0.75 : 1,
        }}
      >
        {heroUploading ? (
          <InlineCircularProgress indeterminate size={18} color={preset.accent} aria-label="Uploading hero image" />
        ) : (
          <ImagePlus size={14} aria-hidden />
        )}
        {heroUploading ? 'Uploading…' : 'Upload'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          disabled={heroUploading}
          onChange={onFile}
        />
      </label>
      <button
        type="button"
        disabled={heroUploading}
        onClick={() => onChangeUrl(null)}
        style={{
          fontSize: '12px',
          fontWeight: 700,
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.35)',
          background: 'transparent',
          color: '#fff',
          cursor: heroUploading ? 'not-allowed' : 'pointer',
          opacity: heroUploading ? 0.5 : 1,
        }}
      >
        Clear
      </button>
      {heroBackgroundUrl ? (
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {heroBackgroundUrl}
        </span>
      ) : null}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'flex-start',
          justifyContent: 'center',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          paddingTop: '10px',
        }}
      >
        <label style={{ flex: '1 1 220px', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>Tagline</span>
          <textarea
            value={heroTagline ?? ''}
            onChange={(e) => {
              const v = e.target.value
              onChangeTagline(v.trim() === '' ? null : v)
            }}
            rows={2}
            placeholder="Short welcome line under your league name"
            style={{
              width: '100%',
              resize: 'vertical',
              minHeight: '44px',
              maxHeight: '120px',
              fontSize: '12px',
              padding: '8px 10px',
              borderRadius: '8px',
              border: `1px solid ${preset.surfaceBorder}`,
              background: preset.surfaceBg,
              color: preset.heading,
              fontFamily: 'inherit',
            }}
          />
        </label>
        <label style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.88)' }}>Logo initials</span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)', maxWidth: '200px', lineHeight: 1.35 }}>
            Upload a real logo in Dashboard → Settings (replaces this block).
          </span>
          <input
            type="text"
            value={heroInitials ?? ''}
            maxLength={3}
            onChange={(e) => {
              const t = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)
              onChangeInitials(t === '' ? null : t)
            }}
            placeholder="AB"
            aria-label="Logo placeholder initials"
            style={{
              width: '56px',
              fontSize: '14px',
              fontWeight: 800,
              textAlign: 'center',
              padding: '8px 6px',
              borderRadius: '8px',
              border: `1px solid ${preset.surfaceBorder}`,
              background: preset.surfaceBg,
              color: preset.heading,
              fontFamily: 'inherit',
            }}
          />
        </label>
      </div>
    </div>
  )
}

export function LeagueSiteSectionsEditor({
  value,
  onChange,
  preset,
  maxGalleryImages = 100,
}: {
  value: LeagueSitePayload
  onChange: (next: LeagueSitePayload) => void
  preset: ThemePreset
  /** Total gallery images allowed (plan limit); enforced again on save. */
  maxGalleryImages?: number
}) {
  function updateSections(fn: (sections: LeagueSiteSection[]) => LeagueSiteSection[]) {
    onChange({ ...value, sections: fn(value.sections) })
  }

  function updateSection(id: string, fn: (s: LeagueSiteSection) => LeagueSiteSection) {
    updateSections((sections) => sections.map((s) => (s.id === id ? fn(s) : s)))
  }

  function move(idx: number, dir: -1 | 1) {
    const next = idx + dir
    if (next < 0 || next >= value.sections.length) return
    updateSections((sections) => {
      const copy = [...sections]
      const t = copy[idx]
      copy[idx] = copy[next]
      copy[next] = t
      return copy
    })
  }

  function removeSection(id: string) {
    updateSections((sections) => sections.filter((s) => s.id !== id))
  }

  const add = (kind: LeagueSiteSection['type']) => {
    updateSections((sections) => [...sections, createLeagueSiteSection(kind)])
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px 32px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => add('text')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 700,
            padding: '8px 12px',
            borderRadius: '10px',
            border: `2px dashed ${preset.accent}`,
            background: preset.accentSoftBg,
            color: preset.heading,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Text section
        </button>
        <button
          type="button"
          onClick={() => add('news')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 700,
            padding: '8px 12px',
            borderRadius: '10px',
            border: `2px dashed ${preset.accent}`,
            background: preset.accentSoftBg,
            color: preset.heading,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} /> News section
        </button>
        <button
          type="button"
          onClick={() => add('media')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: 700,
            padding: '8px 12px',
            borderRadius: '10px',
            border: `2px dashed ${preset.accent}`,
            background: preset.accentSoftBg,
            color: preset.heading,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Media section
        </button>
      </div>

      <p style={{ fontSize: '12px', color: preset.muted, margin: '0 0 16px', lineHeight: 1.5 }}>
        Sections appear here on the page (below Join / Drop-ins), in this order. Use arrows to reorder.
      </p>

      {value.sections.length === 0 ? (
        <p style={{ fontSize: '14px', color: preset.body, padding: '20px', border: `1px dashed ${preset.surfaceBorder}`, borderRadius: '12px', textAlign: 'center' }}>
          No sections yet — add one above.
        </p>
      ) : null}

      {value.sections.map((sec, idx) => (
        <div
          key={sec.id}
          style={{
            marginBottom: '18px',
            padding: '16px',
            borderRadius: '14px',
            border: `2px solid ${preset.accent}`,
            background: preset.surfaceBg,
            boxShadow: '0 8px 24px -18px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: preset.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {sec.type} · position {idx + 1}
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                title="Move block up"
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 800,
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.pageBg,
                  borderRadius: '8px',
                  padding: '6px 10px',
                  cursor: idx === 0 ? 'not-allowed' : 'pointer',
                  opacity: idx === 0 ? 0.4 : 1,
                  color: preset.heading,
                }}
              >
                <ChevronUp size={14} /> Up
              </button>
              <button
                type="button"
                title="Move block down"
                disabled={idx >= value.sections.length - 1}
                onClick={() => move(idx, 1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 800,
                  border: `1px solid ${preset.surfaceBorder}`,
                  background: preset.pageBg,
                  borderRadius: '8px',
                  padding: '6px 10px',
                  cursor: idx >= value.sections.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: idx >= value.sections.length - 1 ? 0.4 : 1,
                  color: preset.heading,
                }}
              >
                <ChevronDown size={14} /> Down
              </button>
              <button
                type="button"
                aria-label="Remove section"
                onClick={() => removeSection(sec.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#b91c1c',
                  padding: '6px',
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: preset.heading }}>Section heading</label>
          <input
            value={sec.title}
            onChange={(e) => updateSection(sec.id, (s) => ({ ...s, title: e.target.value } as LeagueSiteSection))}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: `1px solid ${preset.surfaceBorder}`,
              marginBottom: '12px',
              fontSize: '15px',
              fontWeight: 700,
            }}
          />

          {sec.type === 'media' ? (
            <MediaUrlsEditor
              section={sec}
              preset={preset}
              payload={value}
              maxGalleryImages={maxGalleryImages}
              onChange={(next) => updateSection(sec.id, () => next)}
            />
          ) : (
            <>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: preset.heading }}>
                {sec.type === 'news' ? 'News content' : 'Main text'}
              </label>
              <textarea
                value={sec.body}
                onChange={(e) =>
                  updateSection(sec.id, (s) =>
                    s.type === 'text' || s.type === 'news' ? { ...s, body: e.target.value } : s
                  )
                }
                rows={10}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: `1px solid ${preset.surfaceBorder}`,
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  lineHeight: 1.55,
                  resize: 'vertical',
                }}
              />
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function MediaUrlsEditor({
  section,
  preset,
  payload,
  maxGalleryImages,
  onChange,
}: {
  section: Extract<LeagueSiteSection, { type: 'media' }>
  preset: ThemePreset
  payload: LeagueSitePayload
  maxGalleryImages: number
  onChange: (s: Extract<LeagueSiteSection, { type: 'media' }>) => void
}) {
  const [uploadBatch, setUploadBatch] = useState<{ current: number; total: number } | null>(null)

  const galleryTotal = countGalleryImages(payload)
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
      <p style={{ fontSize: '12px', color: preset.muted, margin: '0 0 10px', lineHeight: 1.45 }}>
        Gallery photos: <strong style={{ color: preset.heading }}>{galleryTotal}</strong> / {maxGalleryImages}
        {overLimit ? (
          <span style={{ color: '#b91c1c', fontWeight: 700 }}> — over your plan limit; remove photos or publishing will fail.</span>
        ) : null}
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
            border: `1px solid ${preset.surfaceBorder}`,
            background: preset.pageBg,
          }}
        >
          <InlineCircularProgress
            indeterminate
            color={preset.accent}
            aria-label={`Uploading photo ${uploadBatch.current} of ${uploadBatch.total}`}
          />
          <span style={{ fontSize: '13px', fontWeight: 700, color: preset.heading }}>
            Uploading photo {uploadBatch.current} of {uploadBatch.total}…
          </span>
        </div>
      ) : null}
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: remainingSlots > 0 && !uploadBusy ? 'pointer' : 'not-allowed',
          marginBottom: '10px',
          color: remainingSlots > 0 && !uploadBusy ? preset.accent : preset.muted,
          opacity: remainingSlots > 0 && !uploadBusy ? 1 : 0.65,
        }}
      >
        <Plus size={14} aria-hidden /> Add images from device
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          disabled={remainingSlots <= 0 || uploadBusy}
          onChange={addFromFiles}
        />
      </label>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: preset.heading }}>
        Image / video URLs (one per line)
      </label>
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
        rows={6}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: '10px',
          border: `1px solid ${preset.surfaceBorder}`,
          fontSize: '13px',
          fontFamily: 'monospace',
        }}
      />
    </div>
  )
}
