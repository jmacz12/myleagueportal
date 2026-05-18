import { parseLeagueSitePayload, type LeagueSitePayload } from '@/lib/league-site'

/** First meaningful headline from published league site JSON for email subject lines. */
export function headlineFromLeagueSitePublished(raw: unknown): string {
  const payload = parseLeagueSitePayload(raw)
  for (const section of payload.sections) {
    if (section.type === 'news' || section.type === 'content') {
      const t = String(section.title || '').trim()
      if (t) return t.slice(0, 120)
    }
    if (section.type === 'text') {
      const t = String(section.title || '').trim()
      if (t) return t.slice(0, 120)
    }
  }
  const tagline = String(payload.heroTagline || '').trim()
  if (tagline) return tagline.slice(0, 120)
  return 'League news update'
}

export function leagueSiteHasPublishableNews(payload: LeagueSitePayload): boolean {
  if (payload.sections.length === 0) return false
  return payload.sections.some((s) => {
    if (s.type === 'news' || s.type === 'text') {
      return Boolean(String(s.title || '').trim() || String(s.body || '').trim())
    }
    if (s.type === 'content') {
      return Boolean(String(s.title || '').trim() || String(s.body || '').trim())
    }
    return s.type === 'media' || s.type === 'cta'
  })
}
