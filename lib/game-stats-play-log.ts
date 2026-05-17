/** Parse shorthand play log: 2 = 2pt made, 3 = 3pt, 1 or F = FT; x2/x3/x1 = misses (ignored). */
export function parsePlayLog(raw: string): { fg2m: number; fg3m: number; ftm: number; pts: number } {
  const tokens = raw
    .trim()
    .toLowerCase()
    .split(/[\s,;|]+/)
    .filter(Boolean)
  let fg2m = 0
  let fg3m = 0
  let ftm = 0
  for (const t of tokens) {
    if (t === '2') fg2m++
    else if (t === '3') fg3m++
    else if (t === '1' || t === 'f') ftm++
  }
  const pts = fg2m * 2 + fg3m * 3 + ftm
  return { fg2m, fg3m, ftm, pts }
}
