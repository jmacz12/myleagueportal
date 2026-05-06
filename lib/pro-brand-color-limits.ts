export const PRO_BRAND_COLOR_CHANGES_PER_MONTH = 5

export function proBrandColorChangesRemaining(org: {
  plan?: string | null
  brand_color_change_count?: number | null
  brand_color_change_period_start?: string | null
}): number | null {
  if (String(org.plan || '').toLowerCase() !== 'pro') return null
  const periodStart = org.brand_color_change_period_start
    ? new Date(org.brand_color_change_period_start as string)
    : null
  const now = new Date()
  const needsReset =
    !periodStart ||
    periodStart.getUTCFullYear() !== now.getUTCFullYear() ||
    periodStart.getUTCMonth() !== now.getUTCMonth()
  const currentCount = needsReset ? 0 : Number(org.brand_color_change_count || 0)
  return Math.max(0, PRO_BRAND_COLOR_CHANGES_PER_MONTH - currentCount)
}
