/**
 * Organizers pick **five** stats to show on **Basic/Pro** public fan surfaces (stream box score,
 * public team season table). All other tracked stats stay recorded but appear **locked** until **Enterprise**.
 */

export const PUBLIC_PRIMARY_STAT_ORDER = [
  'min',
  'pts',
  'fg2m',
  'fg3m',
  'ftm',
  'ast',
  'reb',
  'stl',
  'blk',
  'tov',
  'pf',
] as const

export type PublicPrimaryStatKey = (typeof PUBLIC_PRIMARY_STAT_ORDER)[number]

export const PRIMARY_STAT_LABELS: Record<PublicPrimaryStatKey, string> = {
  min: 'MIN',
  pts: 'PTS',
  fg2m: '2PM',
  fg3m: '3PM',
  ftm: 'FTM',
  ast: 'AST',
  reb: 'REB',
  stl: 'STL',
  blk: 'BLK',
  tov: 'TOV',
  pf: 'PF',
}

/** Default when org has not customized (matches product default: minutes, scoring, ball control). */
export const DEFAULT_PUBLIC_PRIMARY_STAT_KEYS: readonly [
  PublicPrimaryStatKey,
  PublicPrimaryStatKey,
  PublicPrimaryStatKey,
  PublicPrimaryStatKey,
  PublicPrimaryStatKey,
] = ['min', 'pts', 'fg3m', 'tov', 'pf']

const ALLOWED = new Set<string>(PUBLIC_PRIMARY_STAT_ORDER)

/** Returns exactly five distinct allowed keys (pads from defaults). */
export function normalizePublicPrimaryStatKeys(raw: unknown): PublicPrimaryStatKey[] {
  const arr = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const out: PublicPrimaryStatKey[] = []
  for (const item of arr) {
    const k = String(item ?? '').trim()
    if (!ALLOWED.has(k) || seen.has(k)) continue
    seen.add(k)
    out.push(k as PublicPrimaryStatKey)
    if (out.length >= 5) break
  }
  for (const d of DEFAULT_PUBLIC_PRIMARY_STAT_KEYS) {
    if (out.length >= 5) break
    if (!seen.has(d)) {
      seen.add(d)
      out.push(d)
    }
  }
  return out.slice(0, 5) as PublicPrimaryStatKey[]
}

export function headlineStatsForPro(primary: PublicPrimaryStatKey[]): { key: PublicPrimaryStatKey; label: string }[] {
  return primary.map((key) => ({ key, label: PRIMARY_STAT_LABELS[key] }))
}
