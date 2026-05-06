import type { LeagueSitePayload } from '@/lib/league-site'

/** Total gallery images allowed across all media sections (photos only; video links do not count). */
export function maxGalleryImagesForPlan(plan: string | null | undefined): number {
  const p = String(plan ?? 'basic').toLowerCase()
  if (p === 'enterprise') return 100
  if (p === 'pro') return 30
  return 12
}

export function countGalleryImages(payload: LeagueSitePayload): number {
  let n = 0
  for (const s of payload.sections) {
    if (s.type === 'media') {
      for (const it of s.items) {
        if (it.kind === 'image') n++
      }
    }
  }
  return n
}
