/** Verified production sender (see docs/ROADMAP — Resend domain myleagueportal.com). */
export const DEFAULT_RESEND_FROM = 'MyLeaguePortal <reminders@myleagueportal.com>'

const FALLBACK_FROM_CANDIDATES = [
  DEFAULT_RESEND_FROM,
  'MyLeaguePortal <reminders@send.myleagueportal.com>',
] as const

/** Resend accepts `email@domain` or `Name <email@domain>`. */
export function isValidResendFromAddress(from: string): boolean {
  const s = from.trim()
  if (!s) return false
  if (/^[^\s<]+@[^\s>]+$/.test(s)) return true
  return /^.+\s<[^\s<>]+@[^\s<>]+>$/.test(s)
}

/** Strip wrapping quotes and fix common .env copy-paste issues. */
export function normalizeResendFromRaw(raw: string): string {
  let s = raw.trim()
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim()
  }
  return s.replace(/\u201c|\u201d/g, '"').replace(/\u2018|\u2019/g, "'")
}

/**
 * Pick a Resend-safe From header. Uses env when valid; otherwise known-good defaults
 * (same fallback chain as scripts/send-game-reminder-one.ts).
 */
export function resolveResendFromAddress(): string | null {
  const envRaw = process.env.RESEND_FROM?.trim() || process.env.EMAIL_FROM?.trim()
  if (envRaw) {
    const normalized = normalizeResendFromRaw(envRaw)
    if (isValidResendFromAddress(normalized)) return normalized
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return `MyLeaguePortal <${normalized}>`
    }
  }

  for (const candidate of FALLBACK_FROM_CANDIDATES) {
    if (isValidResendFromAddress(candidate)) return candidate
  }

  return null
}
