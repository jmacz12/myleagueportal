/** Normalize a watch URL for YouTube/Twitch (or any https stream page). */
export function normalizeStreamUrl(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).trim()
  try {
    const u = new URL(s.startsWith('http://') || s.startsWith('https://') ? s : `https://${s}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}
