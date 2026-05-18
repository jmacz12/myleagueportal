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
        error: 'On Basic your signup link stays as-is. Upgrade to Pro to change it.',
      }
    }
    if (nameChanged && count >= 1) {
      return {
        ok: false,
        error: 'On Basic you get one league name change, and it is already used. Upgrade to change the name again.',
      }
    }
    return { ok: true }
  }

  if (plan === 'pro' || plan === 'enterprise') {
    if (slugChanged) {
      return {
        ok: false,
        error:
          'Your registration link stays the same so players always know where to sign up. Contact support if it must change.',
      }
    }
    const cooldownDays =
      plan === 'enterprise' ? ENTERPRISE_LEAGUE_IDENTITY_COOLDOWN_DAYS : PRO_LEAGUE_IDENTITY_COOLDOWN_DAYS
    if (nameChanged && lastValid) {
      const eligible = new Date(lastValid.getTime() + cooldownDays * MS_PER_DAY)
      if (Date.now() < eligible.getTime()) {
        const tier = plan === 'enterprise' ? 'Enterprise' : 'Pro'
        return {
          ok: false,
          error: `You can change the league name again on ${eligible.toLocaleDateString(undefined, { dateStyle: 'medium' })}. (${tier}: ${cooldownDays} days between name changes.)`,
          nextEligibleAt: eligible.toISOString(),
        }
      }
    }
    return { ok: true }
  }

  if (slugChanged) {
    return {
      ok: false,
      error: 'On Basic your signup link stays as-is. Upgrade to Pro to change it.',
    }
  }
  if (nameChanged && count >= 1) {
    return {
      ok: false,
      error: 'On Basic you get one league name change, and it is already used. Upgrade to change the name again.',
    }
  }
  return { ok: true }
}

export type LeagueIdentityUiHint = {
  /** User may edit league name */
  canEditName: boolean
  /** Registration slug is read-only in Settings (set at signup). */
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
        helperText: 'You already used your one Basic name change. Upgrade to rename again.',
      }
    }
    return {
      canEditName: true,
      canEditSlug: false,
      helperText: 'Basic: one league name change. Your registration link stays fixed.',
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
          helperText: `Try again on ${dateStr}. (${cooldownDays} days between league name changes on ${plan === 'enterprise' ? 'Enterprise' : 'Pro'}.)`,
        }
      }
    }
    const tier = plan === 'enterprise' ? 'Enterprise' : 'Pro'
    const cadence = plan === 'enterprise' ? '30 days' : '90 days'
    return {
      canEditName: true,
      canEditSlug: false,
      helperText: `${tier}: change the league name once every ${cadence}. Registration link is locked.`,
    }
  }

  return {
    canEditName: count < 1,
    canEditSlug: false,
    helperText: 'Basic: one league name change. Registration link is locked.',
  }
}
