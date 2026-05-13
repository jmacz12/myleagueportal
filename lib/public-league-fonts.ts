/** Curated Google fonts for public league / join surfaces (stored as `publicFontKey` on league site JSON). */

export const PUBLIC_LEAGUE_FONT_OPTIONS = [
  { key: 'plus-jakarta', label: 'Plus Jakarta Sans', googleFamily: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
  { key: 'dm-sans', label: 'DM Sans', googleFamily: 'DM+Sans:wght@400;500;600;700' },
  { key: 'inter', label: 'Inter', googleFamily: 'Inter:wght@400;500;600;700;800' },
  { key: 'montserrat', label: 'Montserrat', googleFamily: 'Montserrat:wght@400;500;600;700;800' },
  { key: 'playfair-display', label: 'Playfair Display', googleFamily: 'Playfair+Display:wght@400;500;600;700' },
  { key: 'bebas-neue', label: 'Bebas Neue', googleFamily: 'Bebas+Neue:wght@400' },
] as const

export type PublicLeagueFontKey = (typeof PUBLIC_LEAGUE_FONT_OPTIONS)[number]['key']

const ALLOWED_KEYS = new Set<string>(PUBLIC_LEAGUE_FONT_OPTIONS.map((o) => o.key))

export function sanitizePublicFontKey(raw: unknown): string | null {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s || !ALLOWED_KEYS.has(s)) return null
  return s
}

/** Serif stack for MyLeaguePortal Original poster layout headings (no extra font request). */
export const PORTAL_ORIGINAL_HEADING_SERIF_STACK =
  'Georgia, "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif'

/** League body font + serif display for section titles / tabs in the Original layout. */
export function resolvePortalOriginalHeadingFontStack(key: string | null | undefined): string {
  return `${PORTAL_ORIGINAL_HEADING_SERIF_STACK}, ${resolvePublicLeagueFontStack(key)}`
}

export function resolvePublicLeagueFontStack(key: string | null | undefined): string {
  const k = key || 'plus-jakarta'
  switch (k) {
    case 'dm-sans':
      return '"DM Sans", system-ui, sans-serif'
    case 'inter':
      return '"Inter", system-ui, sans-serif'
    case 'montserrat':
      return '"Montserrat", system-ui, sans-serif'
    case 'playfair-display':
      return '"Playfair Display", Georgia, serif'
    case 'bebas-neue':
      return '"Bebas Neue", "Arial Narrow", sans-serif'
    case 'plus-jakarta':
    default:
      return '"Plus Jakarta Sans", system-ui, sans-serif'
  }
}

/** Returns a Google Fonts CSS URL, or null when the font is already loaded globally (Plus Jakarta). */
export function googleFontStylesheetHref(key: string | null | undefined): string | null {
  const k = key || 'plus-jakarta'
  if (k === 'plus-jakarta') return null
  const opt = PUBLIC_LEAGUE_FONT_OPTIONS.find((o) => o.key === k)
  if (!opt) return null
  return `https://fonts.googleapis.com/css2?family=${opt.googleFamily}&display=swap`
}
