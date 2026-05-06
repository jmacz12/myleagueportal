/**
 * Season public signup timing — mirrors drop-in “when signups open” modes.
 * Stored fields: signup_opens_mode, signup_opens_days_before, online_registration_*.
 */

export type SeasonSignupMode = 'open_now' | 'closed' | 'scheduled' | 'custom'

export type SeasonSignupFields = {
  allow_online_registration?: boolean | null
  signup_opens_mode?: string | null
  signup_opens_days_before?: number | null
  start_date?: string | null
  online_registration_opens_at?: string | null
  online_registration_closes_at?: string | null
}

/** Calendar anchor at local noon; subtract whole days (same idea as drop-in “days before”). */
export function computeScheduledSignupOpensIso(
  startDateYmd: string | null | undefined,
  daysBefore: number
): string | null {
  if (!startDateYmd || typeof startDateYmd !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateYmd.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const day = Number(m[3])
  const anchor = new Date(y, mo - 1, day, 12, 0, 0, 0)
  if (Number.isNaN(anchor.getTime())) return null
  const opens = new Date(anchor)
  const d = Number.isFinite(daysBefore) ? Math.min(365, Math.max(1, Math.floor(daysBefore))) : 3
  opens.setDate(opens.getDate() - d)
  return opens.toISOString()
}

export function inferSignupMode(season: SeasonSignupFields): SeasonSignupMode {
  const m = season.signup_opens_mode as SeasonSignupMode | undefined
  if (m === 'open_now' || m === 'closed' || m === 'scheduled' || m === 'custom') return m
  if (!season.allow_online_registration) return 'closed'
  if (season.online_registration_opens_at) return 'custom'
  return 'open_now'
}

/** Effective opens instant for joins (scheduled is derived from season start date). */
export function effectiveSignupOpensAtIso(season: SeasonSignupFields): string | null {
  const mode = inferSignupMode(season)
  if (mode === 'scheduled' && season.start_date != null && season.signup_opens_days_before != null) {
    return computeScheduledSignupOpensIso(season.start_date, season.signup_opens_days_before)
  }
  if (mode === 'custom') return season.online_registration_opens_at ?? null
  if (mode === 'open_now') return null
  if (mode === 'closed') return null
  return season.online_registration_opens_at ?? null
}

export function isSeasonRegistrationWindowOpen(season: SeasonSignupFields): boolean {
  if (!season.allow_online_registration) return false
  const now = Date.now()
  const opensIso = effectiveSignupOpensAtIso(season)
  if (opensIso) {
    const t = new Date(opensIso).getTime()
    if (now < t) return false
  }
  if (season.online_registration_closes_at) {
    const t = new Date(season.online_registration_closes_at).getTime()
    if (now > t) return false
  }
  return true
}

export function buildSeasonSignupRowFromMode(
  mode: SeasonSignupMode,
  opts: {
    start_date: string | null | undefined
    signup_opens_days_before?: number | string | null | undefined
    customOpensIso: string | null
    closesIso: string | null
  }
): Record<string, unknown> {
  const allow = mode !== 'closed'
  const rawDays = opts.signup_opens_days_before
  const daysNum =
    typeof rawDays === 'string' ? parseInt(rawDays, 10) : rawDays != null ? Number(rawDays) : 3
  const days = Number.isFinite(daysNum) ? Math.min(365, Math.max(1, Math.floor(daysNum))) : 3

  let opens_at: string | null = null
  let days_before: number | null = null

  if (mode === 'scheduled') {
    days_before = days
    opens_at = computeScheduledSignupOpensIso(opts.start_date ?? null, days_before)
  } else if (mode === 'custom') {
    opens_at = opts.customOpensIso
  } else {
    opens_at = null
    days_before = null
  }

  return {
    allow_online_registration: allow,
    signup_opens_mode: mode,
    signup_opens_days_before: mode === 'scheduled' ? days_before : null,
    online_registration_opens_at: opens_at,
    online_registration_closes_at: opts.closesIso,
  }
}
