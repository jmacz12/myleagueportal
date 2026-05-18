import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTransactionalEmail, isEmailDeliveryConfigured } from '@/lib/email/send-transactional'
import { buildDropinReminderEmail } from '@/lib/dropin-reminder-email'
import { isProOrEnterprise, normalizeOrgPlan } from '@/lib/org-plan-tier'

const REMINDER_HOURS_BEFORE = 24
const CRON_WINDOW_MS = 25 * 60 * 60 * 1000

export type RunDropinRemindersResult = {
  configured: boolean
  sessionsChecked: number
  sessionsInWindow: number
  emailsAttempted: number
  emailsSent: number
  emailsSkipped: number
  errors: string[]
  dryRun: boolean
}

type SessionRow = {
  id: string
  organization_id: string
  scheduled_at: string
  name: string | null
  location: string | null
  status: string | null
}

type OrgRow = {
  id: string
  name: string
  slug: string
  plan: unknown
  league_timezone: string | null
  fan_email_dropin_reminders_enabled?: boolean | null
  custom_domain?: string | null
  custom_domain_verified_at?: string | null
}

export async function runDropinReminders(
  admin: SupabaseClient,
  options?: { dryRun?: boolean; now?: Date }
): Promise<RunDropinRemindersResult> {
  const dryRun = options?.dryRun === true
  const now = options?.now ?? new Date()
  const configured = isEmailDeliveryConfigured()

  const result: RunDropinRemindersResult = {
    configured,
    sessionsChecked: 0,
    sessionsInWindow: 0,
    emailsAttempted: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    errors: [],
    dryRun,
  }

  const horizonEnd = new Date(now.getTime() + (REMINDER_HOURS_BEFORE + 2) * 60 * 60 * 1000)
  const horizonStart = new Date(now.getTime() + (REMINDER_HOURS_BEFORE - 2) * 60 * 60 * 1000)

  const { data: sessions, error: sessionsErr } = await admin
    .from('dropin_sessions')
    .select('id, organization_id, scheduled_at, name, location, status')
    .eq('status', 'upcoming')
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', horizonStart.toISOString())
    .lte('scheduled_at', horizonEnd.toISOString())

  if (sessionsErr) {
    result.errors.push(sessionsErr.message || 'Failed to load drop-in sessions')
    return result
  }

  const sessionRows = (sessions ?? []) as SessionRow[]
  result.sessionsChecked = sessionRows.length

  const dueSessions = sessionRows.filter((s) => {
    if (!s.scheduled_at) return false
    const start = new Date(s.scheduled_at).getTime()
    if (Number.isNaN(start)) return false
    const dueAt = start - REMINDER_HOURS_BEFORE * 60 * 60 * 1000
    return dueAt <= now.getTime() && dueAt > now.getTime() - CRON_WINDOW_MS
  })

  result.sessionsInWindow = dueSessions.length
  if (dueSessions.length === 0) return result

  const orgIds = [...new Set(dueSessions.map((s) => s.organization_id))]
  const orgSelectWithTz =
    'id, name, slug, plan, league_timezone, fan_email_dropin_reminders_enabled, custom_domain, custom_domain_verified_at'
  const orgSelectFallback =
    'id, name, slug, plan, fan_email_dropin_reminders_enabled, custom_domain, custom_domain_verified_at'

  let { data: orgData, error: orgLoadErr } = await admin.from('organizations').select(orgSelectWithTz).in('id', orgIds)

  if (orgLoadErr?.message?.includes('league_timezone')) {
    const retry = await admin.from('organizations').select(orgSelectFallback).in('id', orgIds)
    orgData = (retry.data ?? []).map((o) => ({ ...o, league_timezone: null }))
    orgLoadErr = retry.error
  }

  if (orgLoadErr?.message?.includes('fan_email_dropin_reminders_enabled')) {
    const retry = await admin
      .from('organizations')
      .select('id, name, slug, plan, league_timezone, custom_domain, custom_domain_verified_at')
      .in('id', orgIds)
    orgData = (retry.data ?? []).map((o) => ({
      ...o,
      fan_email_dropin_reminders_enabled: true,
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

  for (const session of dueSessions) {
    const org = orgById.get(session.organization_id)
    if (!org) continue
    if (!isProOrEnterprise(normalizeOrgPlan(org.plan))) continue
    if (org.fan_email_dropin_reminders_enabled === false) continue

    const verifiedDomain =
      org.custom_domain_verified_at && org.custom_domain?.trim()
        ? org.custom_domain.trim().toLowerCase()
        : null

    const { data: registrations, error: regErr } = await admin
      .from('dropin_registrations')
      .select('id, full_name, email, is_waitlist, dropin_reminder_opt_out')
      .eq('session_id', session.id)
      .eq('is_guest', false)

    if (regErr?.message?.includes('dropin_reminder_opt_out')) {
      const retry = await admin
        .from('dropin_registrations')
        .select('id, full_name, email, is_waitlist')
        .eq('session_id', session.id)
        .eq('is_guest', false)
      if (retry.error) {
        result.errors.push(`session ${session.id}: ${retry.error.message}`)
        continue
      }
      for (const reg of retry.data ?? []) {
        await sendDropinOne(admin, {
          result,
          dryRun,
          session,
          org,
          verifiedDomain,
          reg: { ...reg, dropin_reminder_opt_out: false },
        })
      }
      continue
    }

    if (regErr) {
      result.errors.push(`session ${session.id}: ${regErr.message}`)
      continue
    }

    const { data: alreadySent } = await admin
      .from('dropin_reminder_sends')
      .select('registration_id')
      .eq('session_id', session.id)

    const sentSet = new Set((alreadySent ?? []).map((r) => String(r.registration_id)))

    for (const reg of registrations ?? []) {
      if (sentSet.has(String(reg.id))) continue
      await sendDropinOne(admin, {
        result,
        dryRun,
        session,
        org,
        verifiedDomain,
        reg,
      })
    }
  }

  return result
}

async function sendDropinOne(
  admin: SupabaseClient,
  ctx: {
    result: RunDropinRemindersResult
    dryRun: boolean
    session: SessionRow
    org: OrgRow
    verifiedDomain: string | null
    reg: {
      id: string
      full_name: string | null
      email: string | null
      is_waitlist?: boolean | null
      dropin_reminder_opt_out?: boolean | null
    }
  }
) {
  const { result, dryRun, session, org, verifiedDomain, reg } = ctx

  if (reg.dropin_reminder_opt_out === true) return
  const email = typeof reg.email === 'string' ? reg.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) return

  const mail = buildDropinReminderEmail({
    registrationId: String(reg.id),
    leagueName: String(org.name || 'Your league'),
    leagueSlug: String(org.slug || ''),
    verifiedCustomDomain: verifiedDomain,
    playerName: String(reg.full_name || 'Player'),
    sessionName: String(session.name || 'Drop-in session'),
    scheduledAt: session.scheduled_at,
    location: session.location,
    leagueTimezone: org.league_timezone,
    isWaitlist: reg.is_waitlist === true,
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

  const { error: insErr } = await admin.from('dropin_reminder_sends').insert({
    session_id: session.id,
    registration_id: reg.id,
  })

  if (insErr && !String(insErr.message).includes('duplicate')) {
    if (!String(insErr.message).includes('dropin_reminder_sends')) {
      result.errors.push(`dedupe ${reg.id}: ${insErr.message}`)
      return
    }
  }

  result.emailsSent++
}
