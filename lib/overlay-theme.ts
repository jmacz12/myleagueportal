/** Parse #RGB hex for gradients / overlays (stream score bug). */
export function hexToRgb(hex: string | null | undefined): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== 'string') return null
  const h = hex.replace('#', '').trim()
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgba(hex: string | null | undefined, alpha: number): string {
  const c = hexToRgb(hex)
  if (!c) return `rgba(15, 23, 42, ${alpha})`
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`
}
