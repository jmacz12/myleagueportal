const DEFAULT_BRAND = '#5a7a2a'

export interface ThemePreset {
  id: string
  name: string
  description: string
  pageBg: string
  surfaceBg: string
  surfaceBorder: string
  heading: string
  body: string
  muted: string
  accent: string
  accentSoftBg: string
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function normalizeHex(input: string | null | undefined): string {
  const raw = (input || '').trim()
  const m = raw.match(/^#?([0-9a-fA-F]{6})$/)
  if (!m) return DEFAULT_BRAND
  return `#${m[1].toLowerCase()}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHex(hex).slice(1)
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return { h: h / 6, s, l }
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p: number, q: number, tRaw: number): number => {
    let t = tRaw
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  }
}

function shiftHue(hex: string, degrees: number, satBoost = 0, lightBoost = 0): string {
  const { r, g, b } = hexToRgb(hex)
  const hsl = rgbToHsl(r, g, b)
  const h = ((hsl.h * 360 + degrees + 360) % 360) / 360
  const s = clamp(hsl.s + satBoost, 0, 1)
  const l = clamp(hsl.l + lightBoost, 0, 1)
  const rgb = hslToRgb(h, s, l)
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

function mix(a: string, b: string, amount: number): string {
  const t = clamp(amount, 0, 1)
  const c1 = hexToRgb(a)
  const c2 = hexToRgb(b)
  return rgbToHex(c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t)
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}

function readableText(bg: string): string {
  const { r, g, b } = hexToRgb(bg)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? '#1a1a0a' : '#ffffff'
}

export function getThemePresets(brandColor: string | null | undefined): ThemePreset[] {
  const accent = normalizeHex(brandColor)
  const accentCool = shiftHue(accent, 48, 0.08, 0.02)
  const accentDeep = shiftHue(accent, 180, 0.02, -0.14)
  const accentVivid = shiftHue(accent, 112, 0.16, -0.05)
  const accentSoft = shiftHue(accent, -58, -0.14, 0.1)
  return [
    {
      id: 'preset-1',
      name: 'Classic',
      description: 'Clean and balanced default style',
      pageBg: mix(accent, '#ffffff', 0.9),
      surfaceBg: '#ffffff',
      surfaceBorder: mix(accent, '#c4b18c', 0.78),
      heading: '#1a1a0a',
      body: mix('#3e3a2f', accent, 0.16),
      muted: mix('#8f8570', accent, 0.2),
      accent,
      accentSoftBg: mix(accent, '#ffffff', 0.88),
    },
    {
      id: 'preset-2',
      name: 'Fresh',
      description: 'Cool tones with a brighter feel',
      pageBg: mix(accentCool, '#eaf4ff', 0.82),
      surfaceBg: mix('#ffffff', accentCool, 0.04),
      surfaceBorder: mix(accentCool, '#9fc2ef', 0.34),
      heading: '#1a1a0a',
      body: mix('#334155', accentCool, 0.24),
      muted: mix('#64748b', accentCool, 0.32),
      accent: mix(accentCool, '#0f172a', 0.06),
      accentSoftBg: mix(accentCool, '#ffffff', 0.76),
    },
    {
      id: 'preset-3',
      name: 'Bold',
      description: 'Stronger contrast and deeper accents',
      pageBg: mix(accentDeep, '#f2f3f8', 0.68),
      surfaceBg: '#ffffff',
      surfaceBorder: mix(accentDeep, '#7584b6', 0.22),
      heading: mix('#0f172a', accentDeep, 0.34),
      body: mix('#334155', accentDeep, 0.34),
      muted: mix('#64748b', accentDeep, 0.42),
      accent: mix(accentDeep, '#020617', 0.16),
      accentSoftBg: mix(accentDeep, '#ffffff', 0.66),
    },
    {
      id: 'preset-4',
      name: 'Modern',
      description: 'Vivid accents with crisp neutrals',
      pageBg: mix(accentVivid, '#f7f7ff', 0.78),
      surfaceBg: '#ffffff',
      surfaceBorder: mix(accentVivid, '#a8a3ff', 0.22),
      heading: mix('#1f2937', accentVivid, 0.22),
      body: mix('#374151', accentVivid, 0.3),
      muted: mix('#6b7280', accentVivid, 0.38),
      accent: mix(accentVivid, '#111827', 0.04),
      accentSoftBg: mix(accentVivid, '#ffffff', 0.68),
    },
    {
      id: 'preset-5',
      name: 'Soft',
      description: 'Gentle, low-contrast minimal palette',
      pageBg: mix(accentSoft, '#f8f8f6', 0.9),
      surfaceBg: '#ffffff',
      surfaceBorder: mix(accentSoft, '#cfd3c7', 0.26),
      heading: '#111827',
      body: mix('#374151', accentSoft, 0.16),
      muted: mix('#6b7280', accentSoft, 0.26),
      accent: mix(accentSoft, '#111827', 0.06),
      accentSoftBg: mix(accentSoft, '#ffffff', 0.84),
    },
  ]
}

export function resolveThemePreset(
  brandColor: string | null | undefined,
  presetId: string | null | undefined
): ThemePreset {
  const presets = getThemePresets(brandColor)
  return presets.find((p) => p.id === presetId) || presets[0]
}

/** Dark public hero, sticky bar, and section bands derived from the active preset (organizer brand + preset id). */
export interface PublicHeroTheme {
  heroGradient: string
  heroGlow: string
  heroTitle: string
  heroSubtitle: string
  heroPlaceholderBg: string
  heroPlaceholderBorder: string
  heroPlaceholderColor: string
  stickyBackground: string
  stickyBorder: string
  bandAltBg: string
  footerBarBg: string
  footerBarText: string
}

export function publicHeroThemeFromPreset(preset: ThemePreset): PublicHeroTheme {
  const ac = preset.accent
  const deep1 = mix('#06060a', ac, 0.42)
  const deep2 = mix('#100c18', ac, 0.34)
  const deep3 = mix('#030308', ac, 0.26)
  const glow = mix(ac, '#ffffff', 0.14)
  return {
    heroGradient: `linear-gradient(152deg, ${deep1} 0%, ${deep2} 52%, ${deep3} 100%)`,
    heroGlow: `radial-gradient(880px 480px at 88% 0%, ${withAlpha(glow, 0.42)} 0%, transparent 55%)`,
    heroTitle: mix('#f4f1e8', preset.accentSoftBg, 0.22),
    heroSubtitle: withAlpha(mix('#e8e4d8', ac, 0.12), 0.78),
    heroPlaceholderBg: mix('#14141c', ac, 0.28),
    heroPlaceholderBorder: mix(ac, '#ffffff', 0.35),
    heroPlaceholderColor: mix('#f8f4ea', ac, 0.2),
    stickyBackground: withAlpha(mix(preset.surfaceBg, preset.pageBg, 0.35), 0.94),
    stickyBorder: withAlpha(preset.surfaceBorder, 0.88),
    bandAltBg: mix(preset.pageBg, preset.heading, 0.045),
    footerBarBg: mix(deep2, ac, 0.1),
    footerBarText: withAlpha('#f5f2ea', 0.74),
  }
}

export function contrastTextForAccent(accent: string): string {
  return readableText(accent)
}
