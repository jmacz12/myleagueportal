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
  selection: 'first_upcoming_season_game' | 'first_upcoming_drop_in'
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

  return {
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
}
