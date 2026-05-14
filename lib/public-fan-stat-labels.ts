/**
 * Public fan-facing stat column labels — template-aware for non-basketball leagues.
 * Underlying totals still use the platform game stat row; only headers / helper copy differ.
 */

import { PRIMARY_STAT_LABELS, type PublicPrimaryStatKey } from '@/lib/public-primary-stats'
import { DEFAULT_SPORT_TEMPLATE_ID, normalizeSportTemplateId, sportTemplateById } from '@/lib/sport-templates'

const NON_BASKETBALL_FAN_LABELS: Record<PublicPrimaryStatKey, string> = {
  min: 'MIN',
  pts: 'PTS',
  fg2m: '2-pt',
  fg3m: '3-pt',
  ftm: 'FT',
  ast: 'AST',
  reb: 'REB',
  stl: 'STL',
  blk: 'BLK',
  tov: 'TOV',
  pf: 'PF',
}

/** Table headers on public team Stats — basketball keeps classic box abbreviations (2PM, 3PM, FTM). */
export function fanStatLabelForTemplate(templateId: unknown, key: PublicPrimaryStatKey): string {
  if (normalizeSportTemplateId(templateId) === DEFAULT_SPORT_TEMPLATE_ID) {
    return PRIMARY_STAT_LABELS[key]
  }
  return NON_BASKETBALL_FAN_LABELS[key]
}

export function headlineFanStatsForTemplate(
  primary: PublicPrimaryStatKey[],
  templateId: unknown
): { key: PublicPrimaryStatKey; label: string }[] {
  return primary.map((key) => ({ key, label: fanStatLabelForTemplate(templateId, key) }))
}

/** Helper line under “Season stats” for non-basketball templates (null for basketball). */
export function publicFanStatFootnoteForTemplate(templateId: unknown): string | null {
  const id = normalizeSportTemplateId(templateId)
  if (id === DEFAULT_SPORT_TEMPLATE_ID) return null
  const name = sportTemplateById(id).name
  return `${name}: columns match live game scoring — 2-pt and 3-pt follow the scorekeeper buckets (not only literal basketball shots).`
}
