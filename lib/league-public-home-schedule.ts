/**
 * Server-safe helpers for public league home schedule highlights.
 * Used by GET /api/join/[slug]/sessions — deterministic selection.
 */

export type PublicScheduleItemType = 'season_game' | 'drop_in'

export type PublicJoinScheduleItem = {
  id: string
  source_id: string
  type: PublicScheduleItemType
  name: string
  scheduled_at: string
  location_label?: string | null
  fee_amount?: number | null
  is_user_playing?: boolean
  is_recurring?: boolean
  /** Season games only (from public sessions API). */
  game_status?: string | null
  home_score?: number | null
  away_score?: number | null
}

export type LeagueFeaturedGamePayload = {
  type: PublicScheduleItemType
  source_id: string
  name: string
  scheduled_at: string
  location_label: string | null
  fee_amount: number | null
  is_user_playing: boolean
  is_recurring: boolean
  /** Why this row was chosen (analytics / future CMS override). */
  selection: 'first_upcoming_season_game' | 'first_upcoming_drop_in' | 'most_recent_final'
  /** Season games only: scheduled | live | final */
  game_status?: string | null
  home_score?: number | null
  away_score?: number | null
}

export function pickFeaturedPublicScheduleItem(
  items: PublicJoinScheduleItem[],
): LeagueFeaturedGamePayload | null {
  if (!items.length) return null
  const sorted = [...items].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  )
  const firstSeason = sorted.find((x) => x.type === 'season_game')
  const pick = firstSeason ?? sorted[0]
  if (!pick) return null

  const base: LeagueFeaturedGamePayload = {
    type: pick.type,
    source_id: pick.source_id,
    name: pick.name,
    scheduled_at: pick.scheduled_at,
    location_label: pick.location_label ?? null,
    fee_amount: typeof pick.fee_amount === 'number' ? pick.fee_amount : null,
    is_user_playing: !!pick.is_user_playing,
    is_recurring: !!pick.is_recurring,
    selection: firstSeason ? 'first_upcoming_season_game' : 'first_upcoming_drop_in',
  }
  if (pick.type === 'season_game') {
    base.game_status = pick.game_status ?? null
    base.home_score = typeof pick.home_score === 'number' ? pick.home_score : null
    base.away_score = typeof pick.away_score === 'number' ? pick.away_score : null
  }
  return base
}
