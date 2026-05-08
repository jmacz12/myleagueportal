/**
 * Canonical origin for URLs shared with fans (clipboard, dashboard copy buttons).
 * Production default is www.myleagueportal.com; override with NEXT_PUBLIC_PUBLIC_SITE_URL (no trailing slash).
 */
export function getPublicSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return 'https://www.myleagueportal.com'
}
