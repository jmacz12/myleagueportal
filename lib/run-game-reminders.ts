import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTransactionalEmail, isEmailDeliveryConfigured } from '@/lib/email/send-transactional'
import { buildGameReminderEmail } from '@/lib/game-reminder-email'
import { isProOrEnterprise, normalizeOrgPlan } from '@/lib/org-plan-tier'

const REMINDER_HOURS_BEFORE = 24
/** Daily Vercel cron on Hobby; must cover the gap between runs (dedupe via game_reminder_sends). */
const CRON_WINDOW_MS = 25 * 60 * 60 * 1000

export type RunGameRemindersResult = {
  configured: boolean
  gamesChecked: number
  gamesInWindow: number
  emailsAttempted: number
  emailsSent: number
  emailsSkipped: number
  errors: string[]
  dryRun: boolean
}

type GameRow = {
  id: string
  organization_id: string
  home_team_id: string | null
  away_team_id: string | null
  scheduled_at: string | null
  location: string | null
  status: string | null
}

type OrgRow = {
  id: string
  name: string
  slug: string
  plan: unknown
  league_timezone: string | null
  game_email_reminders_enabled?: boolean | null
  custom_domain?: string | null
  custom_domain_verified_at?: string | null
}

export async function runGameReminders(
  admin: SupabaseClient,
  options?: { dryRun?: boolean; now?: Date }
): Promise<RunGameRemindersResult> {
  const dryRun = options?.dryRun === true
  const now = options?.now ?? new Date()
  const configured = isEmailDeliveryConfigured()

  const result: RunGameRemindersResult = {
    configured,
    gamesChecked: 0,
    gamesInWindow: 0,
    emailsAttempted: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    errors: [],
    dryRun,
  }

  const horizonEnd = new Date(now.getTime() + (REMINDER_HOURS_BEFORE + 2) * 60 * 60 * 1000)
  const horizonStart = new Date(now.getTime() + (REMINDER_HOURS_BEFORE - 2) * 60 * 60 * 1000)

  const { data: games, error: gamesErr } = await admin
    .from('games')
    .select(
      'id, organization_id, home_team_id, away_team_id, scheduled_at, location, status'
    )
    .eq('status', 'scheduled')
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', horizonStart.toISOString())
    .lte('scheduled_at', horizonEnd.toISOString())

  if (gamesErr) {
    result.errors.push(gamesErr.message || 'Failed to load games')
    return result
  }

  const gameRows = (games ?? []) as GameRow[]
  result.gamesChecked = gameRows.length

  const dueGames = gameRows.filter((g) => {
    if (!g.scheduled_at) return false
    const start = new Date(g.scheduled_at).getTime()
    if (Number.isNaN(start)) return false
    const dueAt = start - REMINDER_HOURS_BEFORE * 60 * 60 * 1000
    return dueAt <= now.getTime() && dueAt > now.getTime() - CRON_WINDOW_MS
  })

  result.gamesInWindow = dueGames.length
  if (dueGames.length === 0) return result

  const orgIds = [...new Set(dueGames.map((g) => g.organization_id))]
  const orgSelectWithTz =
    'id, name, slug, plan, league_timezone, game_email_reminders_enabled, custom_domain, custom_domain_verified_at'
  const orgSelectFallback =
    'id, name, slug, plan, game_email_reminders_enabled, custom_domain, custom_domain_verified_at'

  let { data: orgData, error: orgLoadErr } = await admin
    .from('organizations')
    .select(orgSelectWithTz)
    .in('id', orgIds)

  if (orgLoadErr?.message?.includes('league_timezone')) {
    const retry = await admin.from('organizations').select(orgSelectFallback).in('id', orgIds)
    orgData = (retry.data ?? []).map((o) => ({ ...o, league_timezone: null }))
    orgLoadErr = retry.error
  }

  if (orgLoadErr) {
    result.errors.push(orgLoadErr.message || 'Failed to load organizations')
    return result
  }

  const orgRows = (orgData ?? []) as OrgRow[]

  const orgById = new Map<string, OrgRow>()
  for (const o of orgRows ?? []) {
    orgById.set(o.id as string, o)
  }

  const teamIds = [
    ...new Set(
      dueGames.flatMap((g) => [g.home_team_id, g.away_team_id].filter(Boolean) as string[])
    ),
  ]
  const { data: teams } = await admin.from('teams').select('id, name').in('id', teamIds)
  const teamNameById = new Map((teams ?? []).map((t) => [t.id as string, String(t.name || 'Team')]))

  for (const game of dueGames) {
    const org = orgById.get(game.organization_id)
    if (!org) continue
    if (!isProOrEnterprise(normalizeOrgPlan(org.plan))) continue
    if (org.game_email_reminders_enabled === false) continue

    const verifiedDomain =
      org.custom_domain_verified_at && org.custom_domain?.trim()
        ? org.custom_domain.trim().toLowerCase()
        : null

    const homeId = game.home_team_id
    const awayId = game.away_team_id
    if (!homeId || !awayId) continue

    const { data: players, error: plErr } = await admin
      .from('players')
      .select('id, full_name, email, team_id, game_reminders_opt_out')
      .eq('organization_id', game.organization_id)
      .in('team_id', [homeId, awayId])

    if (plErr) {
      result.errors.push(`game ${game.id}: ${plErr.message}`)
      continue
    }

    const { data: alreadySent } = await admin
      .from('game_reminder_sends')
      .select('player_id')
      .eq('game_id', game.id)

    const sentSet = new Set((alreadySent ?? []).map((r) => String(r.player_id)))

    for (const player of players ?? []) {
      if (player.game_reminders_opt_out === true) continue
      const email = typeof player.email === 'string' ? player.email.trim().toLowerCase() : ''
      if (!email || !email.includes('@')) continue
      const pid = String(player.id)
      if (sentSet.has(pid)) continue

      const teamId = player.team_id as string | null
      const teamName = teamId ? teamNameById.get(teamId) ?? 'Your team' : 'Your team'
      const isHome = teamId === homeId
      const opponentLabel = isHome
        ? `${teamNameById.get(awayId) ?? 'Away'} @ ${teamNameById.get(homeId) ?? 'Home'}`
        : `${teamNameById.get(awayId) ?? 'Away'} @ ${teamNameById.get(homeId) ?? 'Home'}`

      const mail = buildGameReminderEmail({
        leagueName: String(org.name || 'Your league'),
        leagueSlug: String(org.slug || ''),
        verifiedCustomDomain: verifiedDomain,
        playerName: String(player.full_name || 'Player'),
        playerEmail: email,
        teamName,
        opponentLabel,
        scheduledAt: game.scheduled_at,
        location: game.location,
        leagueTimezone: org.league_timezone,
      })

      result.emailsAttempted++

      if (dryRun) {
        result.emailsSent++
        continue
      }

      const sendRes = await sendTransactionalEmail({
        to: email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      })

      if (!sendRes.ok) {
        result.errors.push(`${email}: ${sendRes.error}`)
        continue
      }

      if (sendRes.skipped) {
        result.emailsSkipped++
        continue
      }

      const { error: insErr } = await admin.from('game_reminder_sends').insert({
        game_id: game.id,
        player_id: pid,
      })

      if (insErr && !String(insErr.message).includes('duplicate')) {
        result.errors.push(`dedupe ${pid}: ${insErr.message}`)
        continue
      }

      result.emailsSent++
    }
  }

  return result
}
