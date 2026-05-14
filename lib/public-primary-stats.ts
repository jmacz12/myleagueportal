/**
 * Organizers pick **five** stats for **Pro** public fan surfaces (stream box score, public team season table).
 * **Basic** leagues do not show per-player stat columns on those public surfaces. **Enterprise** shows every column.
 * The five chosen stats always render **first** (left); remaining stats follow in canonical order (Pro: locked).
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

/** Primary picks first (left), then remaining stats in `PUBLIC_PRIMARY_STAT_ORDER` (for Pro locked tail + Enterprise full row). */
export function orderedFanStatColumns(primary: PublicPrimaryStatKey[]): PublicPrimaryStatKey[] {
  const head = normalizePublicPrimaryStatKeys(primary)
  const used = new Set(head)
  const tail = PUBLIC_PRIMARY_STAT_ORDER.filter((k) => !used.has(k))
  return [...head, ...tail]
}
