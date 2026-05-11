export const PRO_BRAND_COLOR_CHANGES_PER_MONTH = 5

/** Shown next to the Pro monthly brand-color counter (presets/fonts do not consume the cap). */
export const PRO_BRAND_COLOR_COUNTER_HELPER =
  'Changing the main brand color uses one of your monthly edits. Switching theme style or font does not.'

/**
 * Remaining Pro brand-color edits this UTC month.
 *
 * When `brand_color_change_period_start` is null we still trust `brand_color_change_count`
 * (older rows or partial writes). Previously we treated null period as “reset”, which forced
 * the displayed remaining count to stay at 5/5 forever.
 */
export function proBrandColorChangesRemaining(org: {
  plan?: string | null
  brand_color_change_count?: number | null
  brand_color_change_period_start?: string | null
}): number | null {
  if (String(org.plan || '').toLowerCase() !== 'pro') return null
  const raw = Number(org.brand_color_change_count || 0)
  const periodStart = org.brand_color_change_period_start
    ? new Date(org.brand_color_change_period_start as string)
    : null
  const now = new Date()

  let usedThisMonth = raw
  if (
    periodStart &&
    !Number.isNaN(periodStart.getTime()) &&
    (periodStart.getUTCFullYear() !== now.getUTCFullYear() ||
      periodStart.getUTCMonth() !== now.getUTCMonth())
  ) {
    // Period marker is from a prior UTC month — usage counter is stale until next save resets it
    usedThisMonth = 0
  }

  return Math.max(0, PRO_BRAND_COLOR_CHANGES_PER_MONTH - usedThisMonth)
}
