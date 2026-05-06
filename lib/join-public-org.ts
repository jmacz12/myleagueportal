import type { SupabaseClient } from '@supabase/supabase-js'

/** Normalize dynamic route slug (Next may pass string | string[]). */
export function normalizeJoinSlugParam(raw: unknown): string {
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' ? v.trim() : ''
}

function isMissingColumnOrSchemaError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const m = String(error.message || '').toLowerCase()
  const c = String(error.code || '')
  return (
    c === '42703' ||
    m.includes('does not exist') ||
    m.includes('column') && m.includes('schema') ||
    m.includes('could not find')
  )
}

const ORG_SELECT_ATTEMPTS = [
  'id, name, slug, primary_color, logo_url, news_banner, news_banner_color, league_timezone, league_theme_preset, league_appearance_mode, plan',
  'id, name, slug, primary_color, logo_url, news_banner, news_banner_color, league_theme_preset, league_appearance_mode, plan',
  'id, name, slug, primary_color, logo_url, news_banner, news_banner_color, league_theme_preset, plan',
  'id, name, slug, primary_color, logo_url, news_banner, news_banner_color, plan',
] as const

export type PublicHubOrganization = {
  id: string
  name: string
  slug: string
  primary_color: string | null
  logo_url: string | null
  news_banner: string | null
  news_banner_color: string | null
  league_timezone: string | null
  league_theme_preset: string | null
  league_appearance_mode: string | null
  plan: string | null
}

function coerceHubOrg(row: Record<string, unknown>): PublicHubOrganization {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    primary_color: row.primary_color != null ? String(row.primary_color) : null,
    logo_url: row.logo_url != null ? String(row.logo_url) : null,
    news_banner: row.news_banner != null ? String(row.news_banner) : null,
    news_banner_color: row.news_banner_color != null ? String(row.news_banner_color) : null,
    league_timezone: row.league_timezone != null ? String(row.league_timezone) : null,
    league_theme_preset: row.league_theme_preset != null ? String(row.league_theme_preset) : 'classic',
    league_appearance_mode: row.league_appearance_mode != null ? String(row.league_appearance_mode) : 'light',
    plan: row.plan != null ? String(row.plan) : 'basic',
  }
}

/**
 * Load organization for public join/league APIs. Tries narrower selects when the DB
 * is behind migrations, and falls back to case-insensitive slug match.
 */
export async function fetchOrganizationForPublicJoin(
  supabase: SupabaseClient,
  slug: string
): Promise<PublicHubOrganization | null> {
  if (!slug) return null

  const minimal = ORG_SELECT_ATTEMPTS[ORG_SELECT_ATTEMPTS.length - 1]

  for (const sel of ORG_SELECT_ATTEMPTS) {
    const { data, error } = await supabase.from('organizations').select(sel).eq('slug', slug).maybeSingle()

    if (data && typeof data === 'object') {
      return coerceHubOrg(data as unknown as Record<string, unknown>)
    }
    if (error && isMissingColumnOrSchemaError(error)) {
      continue
    }
    if (error) {
      return null
    }
    break
  }

  const { data: ciRows, error: ciErr } = await supabase
    .from('organizations')
    .select(minimal)
    .ilike('slug', slug)
    .limit(2)

  if (ciErr || !ciRows || ciRows.length !== 1) {
    return null
  }

  return coerceHubOrg(ciRows[0] as unknown as Record<string, unknown>)
}
