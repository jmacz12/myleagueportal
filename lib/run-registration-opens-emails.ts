import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTransactionalEmail, isEmailDeliveryConfigured } from '@/lib/email/send-transactional'
import { buildRegistrationOpensEmail } from '@/lib/registration-opens-email'
import { isProOrEnterprise, normalizeOrgPlan } from '@/lib/org-plan-tier'
import {
  effectiveSignupOpensAtIso,
  inferSignupMode,
  type SeasonSignupFields,
} from '@/lib/seasonSignup'

/** Daily Vercel cron; must cover gap between runs. */
const CRON_WINDOW_MS = 25 * 60 * 60 * 1000

export type RunRegistrationOpensEmailsResult = {
  configured: boolean
  seasonsChecked: number
  seasonsInWindow: number
  emailsAttempted: number
  emailsSent: number
  emailsSkipped: number
  errors: string[]
  dryRun: boolean
}

type SeasonRow = SeasonSignupFields & {
  id: string
  organization_id: string
  name: string | null
}

type OrgRow = {
  id: string
  name: string
  slug: string
  plan: unknown
  league_timezone: string | null
  fan_email_registration_opens_enabled?: boolean | null
  custom_domain?: string | null
  custom_domain_verified_at?: string | null
}

export async function runRegistrationOpensEmails(
  admin: SupabaseClient,
  options?: { dryRun?: boolean; now?: Date }
): Promise<RunRegistrationOpensEmailsResult> {
  const dryRun = options?.dryRun === true
  const now = options?.now ?? new Date()
  const configured = isEmailDeliveryConfigured()

  const result: RunRegistrationOpensEmailsResult = {
    configured,
    seasonsChecked: 0,
    seasonsInWindow: 0,
    emailsAttempted: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    errors: [],
    dryRun,
  }

  const { data: seasons, error: seasonsErr } = await admin
    .from('seasons')
    .select(
      'id, organization_id, name, allow_online_registration, signup_opens_mode, signup_opens_days_before, start_date, online_registration_opens_at, online_registration_closes_at'
    )
    .eq('allow_online_registration', true)

  if (seasonsErr) {
    result.errors.push(seasonsErr.message || 'Failed to load seasons')
    return result
  }

  const seasonRows = (seasons ?? []) as SeasonRow[]
  result.seasonsChecked = seasonRows.length

  const dueSeasons = seasonRows.filter((s) => {
    const mode = inferSignupMode(s)
    if (mode === 'open_now' || mode === 'closed') return false
    const opensIso = effectiveSignupOpensAtIso(s)
    if (!opensIso) return false
    const opensAt = new Date(opensIso).getTime()
    if (Number.isNaN(opensAt)) return false
    return opensAt <= now.getTime() && opensAt > now.getTime() - CRON_WINDOW_MS
  })

  result.seasonsInWindow = dueSeasons.length
  if (dueSeasons.length === 0) return result

  const orgIds = [...new Set(dueSeasons.map((s) => s.organization_id))]
  const orgSelectWithTz =
    'id, name, slug, plan, league_timezone, fan_email_registration_opens_enabled, custom_domain, custom_domain_verified_at'
  const orgSelectFallback =
    'id, name, slug, plan, fan_email_registration_opens_enabled, custom_domain, custom_domain_verified_at'

  let { data: orgData, error: orgLoadErr } = await admin.from('organizations').select(orgSelectWithTz).in('id', orgIds)

  if (orgLoadErr?.message?.includes('league_timezone')) {
    const retry = await admin.from('organizations').select(orgSelectFallback).in('id', orgIds)
    orgData = (retry.data ?? []).map((o) => ({ ...o, league_timezone: null }))
    orgLoadErr = retry.error
  }

  if (orgLoadErr?.message?.includes('fan_email_registration_opens_enabled')) {
    const retry = await admin
      .from('organizations')
      .select('id, name, slug, plan, league_timezone, custom_domain, custom_domain_verified_at')
      .in('id', orgIds)
    orgData = (retry.data ?? []).map((o) => ({
      ...o,
      fan_email_registration_opens_enabled: true,
    }))
    orgLoadErr = retry.error
  }

  if (orgLoadErr) {
    result.errors.push(orgLoadErr.message || 'Failed to load organizations')
    return result
  }

  const orgById = new Map<string, OrgRow>()
  for (const o of (orgData ?? []) as OrgRow[]) {
    orgById.set(o.id, o)
  }

  for (const season of dueSeasons) {
    const org = orgById.get(season.organization_id)
    if (!org) continue
    if (!isProOrEnterprise(normalizeOrgPlan(org.plan))) continue
    if (org.fan_email_registration_opens_enabled === false) continue

    const verifiedDomain =
      org.custom_domain_verified_at && org.custom_domain?.trim()
        ? org.custom_domain.trim().toLowerCase()
        : null

    const opensIso = effectiveSignupOpensAtIso(season)

    const { data: players, error: plErr } = await admin
      .from('players')
      .select('id, full_name, email, fan_email_registration_opens_opt_out')
      .eq('organization_id', season.organization_id)

    if (plErr?.message?.includes('fan_email_registration_opens_opt_out')) {
      const retry = await admin
        .from('players')
        .select('id, full_name, email')
        .eq('organization_id', season.organization_id)
      if (retry.error) {
        result.errors.push(`season ${season.id}: ${retry.error.message}`)
        continue
      }
      for (const player of retry.data ?? []) {
        await sendOne(admin, {
          result,
          dryRun,
          season,
          org,
          verifiedDomain,
          opensIso,
          player: { ...player, fan_email_registration_opens_opt_out: false },
        })
      }
      continue
    }

    if (plErr) {
      result.errors.push(`season ${season.id}: ${plErr.message}`)
      continue
    }

    const { data: alreadySent } = await admin
      .from('registration_opens_email_sends')
      .select('player_id')
      .eq('season_id', season.id)

    const sentSet = new Set((alreadySent ?? []).map((r) => String(r.player_id)))

    for (const player of players ?? []) {
      if (sentSet.has(String(player.id))) continue
      await sendOne(admin, {
        result,
        dryRun,
        season,
        org,
        verifiedDomain,
        opensIso,
        player,
      })
    }
  }

  return result
}

async function sendOne(
  admin: SupabaseClient,
  ctx: {
    result: RunRegistrationOpensEmailsResult
    dryRun: boolean
    season: SeasonRow
    org: OrgRow
    verifiedDomain: string | null
    opensIso: string | null
    player: {
      id: string
      full_name: string | null
      email: string | null
      fan_email_registration_opens_opt_out?: boolean | null
    }
  }
) {
  const { result, dryRun, season, org, verifiedDomain, opensIso, player } = ctx

  if (player.fan_email_registration_opens_opt_out === true) return
  const email = typeof player.email === 'string' ? player.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) return

  const mail = buildRegistrationOpensEmail({
    playerId: String(player.id),
    leagueName: String(org.name || 'Your league'),
    leagueSlug: String(org.slug || ''),
    verifiedCustomDomain: verifiedDomain,
    playerName: String(player.full_name || 'Player'),
    seasonName: String(season.name || 'Season'),
    opensAtIso: opensIso,
    closesAtIso: season.online_registration_closes_at ?? null,
    leagueTimezone: org.league_timezone,
  })

  result.emailsAttempted++

  if (dryRun) {
    result.emailsSent++
    return
  }

  const sendRes = await sendTransactionalEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    listUnsubscribeUrl: mail.listUnsubscribeUrl,
  })

  if (!sendRes.ok) {
    result.errors.push(`${email}: ${sendRes.error}`)
    return
  }

  if (sendRes.skipped) {
    result.emailsSkipped++
    return
  }

  const { error: insErr } = await admin.from('registration_opens_email_sends').insert({
    season_id: season.id,
    player_id: player.id,
  })

  if (insErr && !String(insErr.message).includes('duplicate')) {
    if (!String(insErr.message).includes('registration_opens_email_sends')) {
      result.errors.push(`dedupe ${player.id}: ${insErr.message}`)
      return
    }
  }

  result.emailsSent++
}
