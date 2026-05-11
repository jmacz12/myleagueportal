/** League display name + registration URL slug change limits by plan (Settings). */

export const PRO_LEAGUE_IDENTITY_COOLDOWN_DAYS = 90
export const ENTERPRISE_LEAGUE_IDENTITY_COOLDOWN_DAYS = 30

const MS_PER_DAY = 86_400_000

export type LeagueIdentityPolicyResult =
  | { ok: true }
  | { ok: false; error: string; nextEligibleAt?: string }

export function normalizeLeagueNameInput(s: unknown): string {
  return typeof s === 'string' ? s.trim() : ''
}

export function normalizeLeagueSlugInput(s: unknown): string {
  return typeof s === 'string' ? s.trim().toLowerCase() : ''
}

function normalizeName(s: unknown): string {
  return normalizeLeagueNameInput(s)
}

function normalizeSlug(s: unknown): string {
  return normalizeLeagueSlugInput(s)
}

/** True when incoming name or slug differs from stored identity (after normalization). */
export function leagueIdentityFieldsChanged(params: {
  storedName: string | null | undefined
  storedSlug: string | null | undefined
  incomingName: unknown
  incomingSlug: unknown
}): boolean {
  return (
    normalizeLeagueNameInput(params.incomingName) !== normalizeLeagueNameInput(params.storedName) ||
    normalizeLeagueSlugInput(params.incomingSlug) !== normalizeLeagueSlugInput(params.storedSlug)
  )
}

/**
 * Enforces limits when league name or slug **change** vs stored row.
 * Non-changes always pass (caller still saves other profile fields).
 */
export function evaluateLeagueIdentityChange(params: {
  plan: string | null | undefined
  storedName: string | null | undefined
  storedSlug: string | null | undefined
  incomingName: unknown
  incomingSlug: unknown
  changeCount: number | null | undefined
  lastChangedAt: string | null | undefined
}): LeagueIdentityPolicyResult {
  const plan = String(params.plan || 'basic').toLowerCase()
  const curName = normalizeName(params.storedName)
  const curSlug = normalizeSlug(params.storedSlug)
  const nextName = normalizeName(params.incomingName)
  const nextSlug = normalizeSlug(params.incomingSlug)
  const nameChanged = nextName !== curName
  const slugChanged = nextSlug !== curSlug

  if (!nameChanged && !slugChanged) return { ok: true }

  const count = Number(params.changeCount ?? 0)
  const last = params.lastChangedAt ? new Date(params.lastChangedAt) : null
  const lastValid = last && !Number.isNaN(last.getTime()) ? last : null

  if (plan === 'basic') {
    if (slugChanged) {
      return {
        ok: false,
        error:
          'Custom registration URLs are a Pro feature. Upgrade to change your league URL, or keep your current link.',
      }
    }
    if (nameChanged && count >= 1) {
      return {
        ok: false,
        error:
          'Basic includes one league name change for the life of your league. Upgrade to Pro or Enterprise to rename again.',
      }
    }
    return { ok: true }
  }

  if (plan === 'pro' || plan === 'enterprise') {
    const cooldownDays =
      plan === 'enterprise' ? ENTERPRISE_LEAGUE_IDENTITY_COOLDOWN_DAYS : PRO_LEAGUE_IDENTITY_COOLDOWN_DAYS
    if (lastValid) {
      const eligible = new Date(lastValid.getTime() + cooldownDays * MS_PER_DAY)
      if (Date.now() < eligible.getTime()) {
        const tier = plan === 'enterprise' ? 'Enterprise' : 'Pro'
        return {
          ok: false,
          error: `You can change your league name or URL again after ${eligible.toLocaleDateString(undefined, { dateStyle: 'medium' })} (${cooldownDays}-day cooldown on ${tier}).`,
          nextEligibleAt: eligible.toISOString(),
        }
      }
    }
    return { ok: true }
  }

  if (slugChanged) {
    return {
      ok: false,
      error:
        'Custom registration URLs are a Pro feature. Upgrade to change your league URL, or keep your current link.',
    }
  }
  if (nameChanged && count >= 1) {
    return {
      ok: false,
      error:
        'Basic includes one league name change for the life of your league. Upgrade to Pro or Enterprise to rename again.',
    }
  }
  return { ok: true }
}

export type LeagueIdentityUiHint = {
  /** User may edit league name */
  canEditName: boolean
  /** User may edit registration slug (Pro+ only; Basic never via UI) */
  canEditSlug: boolean
  helperText: string
}

export function leagueIdentityUiHint(params: {
  plan: string | null | undefined
  changeCount: number | null | undefined
  lastChangedAt: string | null | undefined
}): LeagueIdentityUiHint {
  const plan = String(params.plan || 'basic').toLowerCase()
  const count = Number(params.changeCount ?? 0)
  const last = params.lastChangedAt ? new Date(params.lastChangedAt) : null
  const lastValid = last && !Number.isNaN(last.getTime()) ? last : null

  if (plan === 'basic') {
    if (count >= 1) {
      return {
        canEditName: false,
        canEditSlug: false,
        helperText:
          'Basic allows one name change, and you already used it. Upgrade to rename again or to set a custom sign-up link.',
      }
    }
    return {
      canEditName: true,
      canEditSlug: false,
      helperText: 'Basic: one free name change for your league. Custom sign-up link is on Pro and up.',
    }
  }

  if (plan === 'pro' || plan === 'enterprise') {
    const cooldownDays =
      plan === 'enterprise' ? ENTERPRISE_LEAGUE_IDENTITY_COOLDOWN_DAYS : PRO_LEAGUE_IDENTITY_COOLDOWN_DAYS
    if (lastValid) {
      const eligible = new Date(lastValid.getTime() + cooldownDays * MS_PER_DAY)
      if (Date.now() < eligible.getTime()) {
        const dateStr = eligible.toLocaleDateString(undefined, { dateStyle: 'medium' })
        return {
          canEditName: false,
          canEditSlug: false,
          helperText: `You can change the name and link again on ${dateStr} (${cooldownDays}-day wait on ${plan === 'enterprise' ? 'Enterprise' : 'Pro'}).`,
        }
      }
    }
    const tier = plan === 'enterprise' ? 'Enterprise' : 'Pro'
    const cadence = plan === 'enterprise' ? 'every 30 days' : 'every 90 days'
    return {
      canEditName: true,
      canEditSlug: true,
      helperText: `${tier}: update league name and sign-up link up to once ${cadence}.`,
    }
  }

  return {
    canEditName: count < 1,
    canEditSlug: false,
    helperText: 'Basic: one name change. Upgrade to change more often or customize your link.',
  }
}
