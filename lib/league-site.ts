import { sanitizePublicFontKey } from '@/lib/public-league-fonts'

export type LeagueSiteMediaItem = {
  url: string
  caption?: string
  kind: 'image' | 'video'
}

/** How photos sit relative to the block body (news) or title (media). */
export type LeagueSiteSectionMediaPlacement = 'below' | 'left' | 'right' | 'behind'

export const LEAGUE_SITE_MEDIA_PLACEMENT_LABELS: Record<LeagueSiteSectionMediaPlacement, string> = {
  below: 'Below text',
  left: 'Left of text',
  right: 'Right of text',
  behind: 'Behind text',
}

/** Which public tab surface a creative block belongs to (Home / News / About). */
export type LeagueSiteContentSurface = 'home' | 'news' | 'about'

/** One stackable text run in a creative block (like Canva text layers). */
export type LeagueSiteContentTextPiece = {
  id: string
  role: 'heading' | 'paragraph'
  text: string
  /** Horizontal anchor (% of canvas width), center of the layer — 0–100. */
  xPct: number
  /** Vertical anchor (% of canvas height), center of the layer — 0–100. */
  yPct: number
}

/** Optional hero-style image behind text (text layer always renders on top). */
export type LeagueSiteContentImage = {
  url: string
  /** Focal point for `object-fit: cover` (0–100). */
  objectPositionX: number
  objectPositionY: number
  /** Width of the image frame as % of the block width (15–100). */
  widthPct: number
  /** Fixed frame height in px; image fills this box with `object-fit: cover` (vertical handles resize this). */
  maxHeightPx: number
  rotateDeg: number
  scale: number
  borderRadiusPx: number
  /** Nudge image position in % of its own box (rough pan). */
  offsetX: number
  offsetY: number
}

export type LeagueSiteSection =
  | { id: string; type: 'text'; title: string; body: string }
  | {
      id: string
      type: 'news'
      title: string
      body: string
      items: LeagueSiteMediaItem[]
      mediaLayout: LeagueSiteSectionMediaPlacement
    }
  | {
      id: string
      type: 'media'
      title: string
      items: LeagueSiteMediaItem[]
      mediaLayout: LeagueSiteSectionMediaPlacement
    }
  | {
      id: string
      type: 'content'
      surface: LeagueSiteContentSurface
      /** Derived: first heading (or first line of copy) for cards / APIs. */
      title: string
      /** Derived: paragraph pieces joined. */
      body: string
      image: LeagueSiteContentImage | null
      textPieces: LeagueSiteContentTextPiece[]
    }

/** Classic section kinds (legacy); creative blocks use `createLeagueSiteContentSection`. */
export type LeagueSiteClassicKind = 'text' | 'news' | 'media'

export type LeagueSiteNewsTabSection =
  | Extract<LeagueSiteSection, { type: 'news' }>
  | (Extract<LeagueSiteSection, { type: 'content' }> & { surface: 'news' })

export type LeagueSiteAboutTabSection =
  | Extract<LeagueSiteSection, { type: 'text' }>
  | Extract<LeagueSiteSection, { type: 'media' }>
  | (Extract<LeagueSiteSection, { type: 'content' }> & { surface: 'about' })

export type LeagueSiteHomeTabSection = Extract<LeagueSiteSection, { type: 'content' }> & { surface: 'home' }

export function isLeagueSiteNewsSurfaceSection(s: LeagueSiteSection): s is LeagueSiteNewsTabSection {
  return s.type === 'news' || (s.type === 'content' && s.surface === 'news')
}

export function isLeagueSiteAboutTabSection(s: LeagueSiteSection): s is LeagueSiteAboutTabSection {
  return s.type === 'text' || s.type === 'media' || (s.type === 'content' && s.surface === 'about')
}

export function isLeagueSiteHomeSurfaceSection(s: LeagueSiteSection): s is LeagueSiteHomeTabSection {
  return s.type === 'content' && s.surface === 'home'
}

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

export function createLeagueSiteSection(kind: LeagueSiteClassicKind): LeagueSiteSection {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `sec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  if (kind === 'media') return { id, type: 'media', title: 'Photos & videos', items: [], mediaLayout: 'below' }
  if (kind === 'news') return { id, type: 'news', title: 'News', body: '', items: [], mediaLayout: 'below' }
  return { id, type: 'text', title: 'Section title', body: '' }
}

export function createLeagueSiteContentSection(surface: LeagueSiteContentSurface): LeagueSiteSection {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `sec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return {
    id,
    type: 'content',
    surface,
    title: '',
    body: '',
    image: null,
    textPieces: [],
  }
}

function clampNum(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, n))
}

export function defaultLeagueSiteContentImage(url: string): LeagueSiteContentImage {
  return {
    url,
    objectPositionX: 50,
    objectPositionY: 50,
    widthPct: 100,
    maxHeightPx: 420,
    rotateDeg: 0,
    scale: 1,
    borderRadiusPx: 14,
    offsetX: 0,
    offsetY: 0,
  }
}

function sanitizeContentSurface(raw: unknown): LeagueSiteContentSurface {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'home' || s === 'news' || s === 'about') return s
  return 'about'
}

function sanitizeContentImage(raw: unknown): LeagueSiteContentImage | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const url = clip(String(o.url ?? ''), MAX_URL)
  if (!url) return null
  const ox = Number(o.objectPositionX)
  const oy = Number(o.objectPositionY)
  const wp = Number(o.widthPct)
  const mh = Number(o.maxHeightPx)
  const rd = Number(o.rotateDeg)
  const sc = Number(o.scale)
  const br = Number(o.borderRadiusPx)
  const ofx = Number(o.offsetX)
  const ofy = Number(o.offsetY)
  return {
    url,
    objectPositionX: Number.isFinite(ox) ? clampNum(ox, 0, 100) : 50,
    objectPositionY: Number.isFinite(oy) ? clampNum(oy, 0, 100) : 50,
    widthPct: Number.isFinite(wp) ? clampNum(wp, 15, 100) : 100,
    maxHeightPx: Math.round(Number.isFinite(mh) ? clampNum(mh, 80, 900) : 420),
    rotateDeg: Number.isFinite(rd) ? clampNum(rd, -180, 180) : 0,
    scale: Number.isFinite(sc) ? clampNum(sc, 0.2, 4) : 1,
    borderRadiusPx: Math.round(Number.isFinite(br) ? clampNum(br, 0, 48) : 14),
    offsetX: Number.isFinite(ofx) ? clampNum(ofx, -80, 80) : 0,
    offsetY: Number.isFinite(ofy) ? clampNum(ofy, -80, 80) : 0,
  }
}

const MAX_TEXT_PIECES = 24
const MAX_PIECE_TEXT = 12_000

export function newLeagueSiteContentTextPieceId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Default canvas anchor for a new text layer (index = existing piece count). */
export function defaultLeagueSiteContentTextPieceLayout(
  index: number,
  role: 'heading' | 'paragraph'
): { xPct: number; yPct: number } {
  const yBase = 14 + index * (role === 'heading' ? 18 : 16)
  return { xPct: 50, yPct: Math.min(92, Math.max(8, yBase)) }
}

function sanitizeContentTextPieces(raw: unknown, fallbackTitle: string, fallbackBody: string): LeagueSiteContentTextPiece[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const out: LeagueSiteContentTextPiece[] = []
    let idx = 0
    for (const item of raw.slice(0, MAX_TEXT_PIECES)) {
      if (!item || typeof item !== 'object') continue
      const p = item as Record<string, unknown>
      const pid = clip(String(p.id ?? ''), 80) || newLeagueSiteContentTextPieceId()
      const roleRaw = String(p.role ?? p.kind ?? 'paragraph').trim().toLowerCase()
      const role: 'heading' | 'paragraph' =
        roleRaw === 'heading' || roleRaw === 'header' ? 'heading' : 'paragraph'
      const text = clip(String(p.text ?? ''), MAX_PIECE_TEXT)
      const xr = Number(p.xPct)
      const yr = Number(p.yPct)
      const defaults = defaultLeagueSiteContentTextPieceLayout(idx, role)
      const xPct = Number.isFinite(xr) ? clampNum(xr, 0, 100) : defaults.xPct
      const yPct = Number.isFinite(yr) ? clampNum(yr, 0, 100) : defaults.yPct
      out.push({ id: pid, role, text, xPct, yPct })
      idx++
    }
    if (out.length > 0) return out
  }
  const migrated: LeagueSiteContentTextPiece[] = []
  let mi = 0
  if (fallbackTitle.trim()) {
    const d = defaultLeagueSiteContentTextPieceLayout(mi, 'heading')
    migrated.push({ id: newLeagueSiteContentTextPieceId(), role: 'heading', text: fallbackTitle, xPct: d.xPct, yPct: d.yPct })
    mi++
  }
  if (fallbackBody.trim()) {
    const d = defaultLeagueSiteContentTextPieceLayout(mi, 'paragraph')
    migrated.push({ id: newLeagueSiteContentTextPieceId(), role: 'paragraph', text: fallbackBody, xPct: d.xPct, yPct: d.yPct })
  }
  return migrated
}

/** Keep legacy `title` / `body` in sync for previews and older readers. */
export function syncContentDerivedFields(pieces: LeagueSiteContentTextPiece[]): { title: string; body: string } {
  const firstHead = pieces.find((p) => p.role === 'heading' && p.text.trim())
  const paras = pieces.filter((p) => p.role === 'paragraph')
  const body = clip(
    paras
      .map((p) => p.text)
      .filter((t) => t.trim().length > 0)
      .join('\n\n'),
    MAX_BODY
  )
  let title = firstHead ? clip(firstHead.text, MAX_TITLE) : ''
  if (!title) {
    const firstPara = paras.find((p) => p.text.trim())
    if (firstPara) {
      const line = firstPara.text.split('\n')[0]?.trim() ?? ''
      title = clip(line, MAX_TITLE)
    }
  }
  return { title, body }
}

const MAX_SECTIONS = 24
const MAX_TITLE = 200
const MAX_BODY = 24_000
/** Max items stored per media section (URLs/images); total gallery images are capped separately by plan in the API. */
const MAX_MEDIA = 100
const MAX_URL = 2048
const MAX_CAPTION = 280

function sanitizeMediaLayout(raw: unknown): LeagueSiteSectionMediaPlacement {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (s === 'left' || s === 'right' || s === 'behind') return s
  return 'below'
}

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
  if (!id) return null
  const type = o.type

  if (type === 'media') {
    const title = clip(String(o.title ?? ''), MAX_TITLE)
    if (!title) return null
    const itemsIn = Array.isArray(o.items) ? o.items : []
    const items: LeagueSiteMediaItem[] = []
    for (const it of itemsIn.slice(0, MAX_MEDIA)) {
      const m = sanitizeMediaItem(it)
      if (m) items.push(m)
    }
    const mediaLayout = sanitizeMediaLayout(o.mediaLayout)
    return { id, type: 'media', title, items, mediaLayout }
  }

  if (type === 'text') {
    const title = clip(String(o.title ?? ''), MAX_TITLE)
    if (!title) return null
    const body = clip(String(o.body ?? ''), MAX_BODY)
    return { id, type: 'text', title, body }
  }

  if (type === 'news') {
    const title = clip(String(o.title ?? ''), MAX_TITLE)
    if (!title) return null
    const body = clip(String(o.body ?? ''), MAX_BODY)
    const itemsIn = Array.isArray(o.items) ? o.items : []
    const items: LeagueSiteMediaItem[] = []
    for (const it of itemsIn.slice(0, MAX_MEDIA)) {
      const m = sanitizeMediaItem(it)
      if (m) items.push(m)
    }
    const mediaLayout = sanitizeMediaLayout(o.mediaLayout)
    return { id, type: 'news', title, body, items, mediaLayout }
  }

  if (type === 'content') {
    const titleRaw = clip(String(o.title ?? ''), MAX_TITLE)
    const bodyRaw = clip(String(o.body ?? ''), MAX_BODY)
    const textPieces = sanitizeContentTextPieces(o.textPieces, titleRaw, bodyRaw)
    const { title, body } = syncContentDerivedFields(textPieces)
    const surface = sanitizeContentSurface(o.surface)
    const imgRaw = o.image
    const image =
      imgRaw && typeof imgRaw === 'object' && Object.keys(imgRaw as object).length > 0 ? sanitizeContentImage(imgRaw) : null
    return { id, type: 'content', surface, title, body, image, textPieces }
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
