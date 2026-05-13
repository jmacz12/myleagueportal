/**
 * Pro league public theme: exactly six named choices. Fresh + Modern are retired;
 * Bright uses the former Fresh palette; Midnight is the dark (formerly "mode") look.
 */

export const LEAGUE_THEME_CHOICE_ORDER = [
  'portal_original',
  'classic',
  'bold',
  'soft',
  'bright',
  'midnight',
] as const

export type LeagueThemeChoiceId = (typeof LEAGUE_THEME_CHOICE_ORDER)[number]

export const LEAGUE_THEME_CHOICE_META: Record<
  LeagueThemeChoiceId,
  { name: string; description: string }
> = {
  portal_original: {
    name: 'MyLeaguePortal Original',
    description: 'Cream shell and house green — matches marketing and dashboard (not your brand color)',
  },
  classic: {
    name: 'Classic',
    description: 'Clean, balanced default derived from your brand color',
  },
  bold: {
    name: 'Bold',
    description: 'Stronger contrast and deeper accents',
  },
  soft: {
    name: 'Soft',
    description: 'Gentle, low-contrast minimal palette',
  },
  bright: {
    name: 'Bright',
    description: 'Cool, daylight energy (open and airy)',
  },
  midnight: {
    name: 'Midnight',
    description: 'Dark page shell with light type for night viewing',
  },
}

type InternalPresetRowId = 'preset-1' | 'preset-2' | 'preset-3' | 'preset-5'

/** Maps each public choice (except portal_original) to the internal preset row id from `getThemePresets()`. */
export const INTERNAL_PRESET_ID_BY_CHOICE: Record<
  Exclude<LeagueThemeChoiceId, 'portal_original'>,
  InternalPresetRowId
> = {
  classic: 'preset-1',
  bold: 'preset-3',
  soft: 'preset-5',
  bright: 'preset-2',
  midnight: 'preset-1',
}

const CANONICAL = new Set<string>(LEAGUE_THEME_CHOICE_ORDER)

function sanitizeMode(raw: unknown): 'light' | 'dark' {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return s === 'dark' ? 'dark' : 'light'
}

/** Legacy slug → base choice when appearance is light (not midnight). */
function legacyPresetToBaseChoice(p: string): LeagueThemeChoiceId {
  if (p === 'preset-2' || p === 'fresh') return 'bright'
  if (p === 'preset-3') return 'bold'
  if (p === 'preset-5') return 'soft'
  if (p === 'preset-4' || p === 'modern') return 'bold'
  if (p === 'preset-1' || p === '') return 'classic'
  return 'classic'
}

/**
 * Normalize DB / API value to one of six theme choices.
 * Dark appearance maps light presets to `midnight`, except `portal_original` (always light shell).
 */
export function normalizeLeagueThemePresetId(rawPreset: unknown, rawMode?: unknown): LeagueThemeChoiceId {
  const p = typeof rawPreset === 'string' ? rawPreset.trim().toLowerCase() : ''
  const mode = sanitizeMode(rawMode)

  if (CANONICAL.has(p)) {
    const c = p as LeagueThemeChoiceId
    if (c === 'midnight') return 'midnight'
    if (c === 'portal_original') return 'portal_original'
    if (mode === 'dark') return 'midnight'
    return c
  }

  const base = legacyPresetToBaseChoice(p)
  if (mode === 'dark') return 'midnight'
  return base
}

export function appearanceModeForChoice(choice: LeagueThemeChoiceId): 'light' | 'dark' {
  return choice === 'midnight' ? 'dark' : 'light'
}

export function isLeagueThemeChoiceId(value: string): value is LeagueThemeChoiceId {
  return CANONICAL.has(value)
}
