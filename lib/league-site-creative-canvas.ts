/**
 * Creative block stage: shared between public `LeagueSiteSectionBlock` and `LeagueSiteCreativeBlockCanvas`
 * so % text positions use the same vertical extent.
 */
export const LEAGUE_SITE_CREATIVE_CANVAS_MIN_HEIGHT = 'min(520px, max(300px, 40vh))' as const

export const LEAGUE_SITE_CREATIVE_STAGE_MIN_PX = 240
export const LEAGUE_SITE_CREATIVE_STAGE_MAX_PX = 920

function clampStagePx(n: number): number {
  if (!Number.isFinite(n)) return 400
  return Math.round(Math.max(LEAGUE_SITE_CREATIVE_STAGE_MIN_PX, Math.min(LEAGUE_SITE_CREATIVE_STAGE_MAX_PX, n)))
}

/** Resolved CSS `min-height` for the creative stage (photo + % text grid). */
export function leagueSiteCreativeStageMinHeightCss(
  creativeStageMinPx: number | null | undefined,
  hasImage: boolean
): string {
  if (!hasImage) return '260px'
  if (creativeStageMinPx != null && Number.isFinite(creativeStageMinPx)) {
    return `${clampStagePx(creativeStageMinPx)}px`
  }
  return LEAGUE_SITE_CREATIVE_CANVAS_MIN_HEIGHT
}
