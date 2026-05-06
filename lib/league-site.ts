import { sanitizePublicFontKey } from '@/lib/public-league-fonts'

export type LeagueSiteMediaItem = {
  url: string
  caption?: string
  kind: 'image' | 'video'
}

export type LeagueSiteSection =
  | { id: string; type: 'text'; title: string; body: string }
  | { id: string; type: 'news'; title: string; body: string }
  | { id: string; type: 'media'; title: string; items: LeagueSiteMediaItem[] }

export type LeagueSitePayload = {
  heroBackgroundUrl: string | null
  /** Subtitle under the org name on the public hero (league + join pages). */
  heroTagline: string | null
  /** Shown in the logo placeholder when no logo (1–3 letters). */
  heroInitials: string | null
  /** Optional typography preset for public league + join hub surfaces (see `public-league-fonts`). */
  publicFontKey: string | null
  sections: LeagueSiteSection[]
}

export const DEFAULT_LEAGUE_HERO_TAGLINE =
  'Compete weekly, follow every roster, and jump into the season or pickup runs—all in one league home.'

export const EMPTY_LEAGUE_SITE: LeagueSitePayload = {
  heroBackgroundUrl: null,
  heroTagline: null,
  heroInitials: null,
  publicFontKey: null,
  sections: [],
}

const MAX_HERO_TAGLINE = 500
const MAX_HERO_INITIALS = 3

/** Initials for placeholder block: custom from CMS, else derived from org name. */
export function displayHeroInitials(heroInitials: string | null | undefined, orgName: string): string {
  const t = (typeof heroInitials === 'string' ? heroInitials : '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, MAX_HERO_INITIALS)
  if (t) return t
  const w = orgName.trim().split(/\s+/).filter(Boolean)
  if (w.length >= 2) return (w[0].charAt(0) + w[1].charAt(0)).toUpperCase().slice(0, MAX_HERO_INITIALS)
  if (w.length === 1 && w[0].length >= 2) return w[0].slice(0, 2).toUpperCase()
  return 'L'
}

export function createLeagueSiteSection(kind: LeagueSiteSection['type']): LeagueSiteSection {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `sec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  if (kind === 'media') return { id, type: 'media', title: 'Photos & videos', items: [] }
  if (kind === 'news') return { id, type: 'news', title: 'News', body: '' }
  return { id, type: 'text', title: 'Section title', body: '' }
}

const MAX_SECTIONS = 24
const MAX_TITLE = 200
const MAX_BODY = 24_000
/** Max items stored per media section (URLs/images); total gallery images are capped separately by plan in the API. */
const MAX_MEDIA = 100
const MAX_URL = 2048
const MAX_CAPTION = 280

function clip(s: string, max: number): string {
  const t = typeof s === 'string' ? s.trim() : ''
  return t.length <= max ? t : t.slice(0, max)
}

function sanitizeMediaItem(raw: unknown): LeagueSiteMediaItem | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const url = clip(String(o.url ?? ''), MAX_URL)
  if (!url) return null
  const kind = o.kind === 'video' ? 'video' : 'image'
  const caption = o.caption != null ? clip(String(o.caption), MAX_CAPTION) : undefined
  return { url, kind, ...(caption ? { caption } : {}) }
}

function sanitizeSection(raw: unknown): LeagueSiteSection | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = clip(String(o.id ?? ''), 80)
  const type = o.type
  const title = clip(String(o.title ?? ''), MAX_TITLE)
  if (!id || !title) return null

  if (type === 'media') {
    const itemsIn = Array.isArray(o.items) ? o.items : []
    const items: LeagueSiteMediaItem[] = []
    for (const it of itemsIn.slice(0, MAX_MEDIA)) {
      const m = sanitizeMediaItem(it)
      if (m) items.push(m)
    }
    return { id, type: 'media', title, items }
  }

  if (type === 'news' || type === 'text') {
    const body = clip(String(o.body ?? ''), MAX_BODY)
    return { id, type, title, body }
  }

  return null
}

export function parseLeagueSitePayload(raw: unknown): LeagueSitePayload {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_LEAGUE_SITE }
  const o = raw as Record<string, unknown>
  const heroRaw = o.heroBackgroundUrl
  const heroBackgroundUrl =
    heroRaw == null || heroRaw === ''
      ? null
      : clip(String(heroRaw), MAX_URL) || null

  const tagRaw = o.heroTagline
  const heroTagline =
    tagRaw == null || tagRaw === '' ? null : clip(String(tagRaw), MAX_HERO_TAGLINE) || null

  const initRaw = o.heroInitials
  let heroInitials: string | null = null
  if (initRaw != null && String(initRaw).trim() !== '') {
    const letters = clip(String(initRaw), MAX_HERO_INITIALS)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, MAX_HERO_INITIALS)
    heroInitials = letters || null
  }

  const sectionsIn = Array.isArray(o.sections) ? o.sections : []
  const sections: LeagueSiteSection[] = []
  for (const s of sectionsIn.slice(0, MAX_SECTIONS)) {
    const sec = sanitizeSection(s)
    if (sec) sections.push(sec)
  }
  const publicFontKey = sanitizePublicFontKey(o.publicFontKey)
  return { heroBackgroundUrl, heroTagline, heroInitials, publicFontKey, sections }
}
