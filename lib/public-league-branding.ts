import type { LeagueAppearanceMode } from '@/lib/leagueTheme'
import type { LeagueThemeChoiceId } from '@/lib/league-theme-choice'

/** Default public look for Basic leagues (MyLeaguePortal Original house shell + lockup). */
export const BASIC_PUBLIC_PRIMARY_COLOR = '#5a7a2a'
export const BASIC_PUBLIC_THEME_PRESET: LeagueThemeChoiceId = 'portal_original'
export const BASIC_PUBLIC_APPEARANCE_MODE: LeagueAppearanceMode = 'light'

export type PublicOrgThemeRow = {
  plan?: string | null
  primary_color?: string | null
  league_theme_preset?: string | null
  league_appearance_mode?: string | null
}

export function sanitizeLeagueAppearanceMode(raw: unknown): LeagueAppearanceMode {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return s === 'dark' ? 'dark' : 'light'
}

/**
 * Theme inputs for public league surfaces. Basic always uses house branding on the live site.
 */
export function getPublicThemeInputsForOrg(org: PublicOrgThemeRow): {
  primaryColor: string | null
  presetId: string | undefined
  appearanceMode: LeagueAppearanceMode
  usePlatformBranding: boolean
  suppressCustomHero: boolean
} {
  const plan = String(org.plan || 'basic').toLowerCase()
  if (plan === 'basic') {
    return {
      primaryColor: BASIC_PUBLIC_PRIMARY_COLOR,
      presetId: BASIC_PUBLIC_THEME_PRESET,
      appearanceMode: BASIC_PUBLIC_APPEARANCE_MODE,
      usePlatformBranding: true,
      suppressCustomHero: true,
    }
  }
  return {
    primaryColor: org.primary_color ?? null,
    presetId: org.league_theme_preset ?? undefined,
    appearanceMode: sanitizeLeagueAppearanceMode(org.league_appearance_mode),
    usePlatformBranding: false,
    suppressCustomHero: false,
  }
}
