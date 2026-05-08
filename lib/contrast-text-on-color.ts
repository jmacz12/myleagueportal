/** Readable text on top of a team hex color (jersey tiles, score chips). */
export function contrastTextOnColor(hex: string | null | undefined): string {
  if (!hex || typeof hex !== 'string') return '#ffffff'
  const h = hex.replace('#', '').trim()
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 160 ? '#111827' : '#ffffff'
}
