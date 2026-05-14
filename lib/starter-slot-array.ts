/** Fixed 5 starter slots per side (null = empty); matches `games.home_starter_slot_ids` / `away_starter_slot_ids`. */

export function parseStarterSlotArray(raw: unknown): (string | null)[] {
  const base: (string | null)[] = [null, null, null, null, null]
  if (!Array.isArray(raw)) return base
  for (let i = 0; i < 5; i++) {
    const v = raw[i]
    if (v === null || v === undefined || v === '') base[i] = null
    else if (typeof v === 'string' && v.length > 0) base[i] = v
    else base[i] = null
  }
  return base
}

export function starterSlotArraysEqual(a: unknown, b: unknown): boolean {
  const pa = parseStarterSlotArray(a)
  const pb = parseStarterSlotArray(b)
  for (let i = 0; i < 5; i++) {
    if (pa[i] !== pb[i]) return false
  }
  return true
}
