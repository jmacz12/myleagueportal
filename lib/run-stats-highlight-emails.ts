import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTransactionalEmail, isEmailDeliveryConfigured } from '@/lib/email/send-transactional'
import { buildStatsHighlightEmail } from '@/lib/stats-highlight-email'
import { isProOrEnterprise, normalizeOrgPlan } from '@/lib/org-plan-tier'

const CRON_WINDOW_MS = 25 * 60 * 60 * 1000

export type RunStatsHighlightEmailsResult = {
  configured: boolean
  gamesWithStatsInWindow: number
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
  home_score: number | null
  away_score: number | null
  status: string | null
}

type OrgRow = {
  id: string
  name: string
  slug: string
  plan: unknown
  league_timezone: string | null
  fan_email_stats_highlights_enabled?: boolean | null
  custom_domain?: string | null
  custom_domain_verified_at?: string | null
}

type StatRow = {
  game_id: string
  player_id: string
  pts: number | null
  players: { full_name: string | null } | { full_name: string | null }[] | null
}

export async function runStatsHighlightEmails(
  admin: SupabaseClient,
  options?: { dryRun?: boolean; now?: Date }
): Promise<RunStatsHighlightEmailsResult> {
  const dryRun = options?.dryRun === true
  const now = options?.now ?? new Date()
  const windowStart = new Date(now.getTime() - CRON_WINDOW_MS)
  const configured = isEmailDeliveryConfigured()

  const result: RunStatsHighlightEmailsResult = {
    configured,
    gamesWithStatsInWindow: 0,
    emailsAttempted: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    errors: [],
    dryRun,
  }

  const { data: statTouches, error: statErr } = await admin
    .from('player_game_stats')
    .select('game_id')
    .gte('updated_at', windowStart.toISOString())

  if (statErr) {
    result.errors.push(statErr.message || 'Failed to load player game stats')
    return result
  }

  const gameIds = [...new Set((statTouches ?? []).map((r) => String(r.game_id)))]
  if (gameIds.length === 0) return result

  const { data: games, error: gamesErr } = await admin
    .from('games')
    .select(
      'id, organization_id, home_team_id, away_team_id, scheduled_at, home_score, away_score, status'
    )
    .in('id', gameIds)
    .eq('status', 'final')

  if (gamesErr) {
    result.errors.push(gamesErr.message || 'Failed to load games')
    return result
  }

  const gameRows = (games ?? []) as GameRow[]
  result.gamesWithStatsInWindow = gameRows.length
  if (gameRows.length === 0) return result

  const orgIds = [...new Set(gameRows.map((g) => g.organization_id))]
  const orgById = await loadOrgs(admin, orgIds, result)
  if (!orgById) return result

  const teamIds = [
    ...new Set(
      gameRows.flatMap((g) => [g.home_team_id, g.away_team_id].filter(Boolean) as string[])
    ),
  ]
  const { data: teams } = await admin.from('teams').select('id, name').in('id', teamIds)
  const teamNameById = new Map((teams ?? []).map((t) => [String(t.id), String(t.name || 'Team')]))

  for (const game of gameRows) {
    const org = orgById.get(game.organization_id)
    if (!org) continue
    if (!isProOrEnterprise(normalizeOrgPlan(org.plan))) continue
    if (org.fan_email_stats_highlights_enabled === false) continue

    const homeId = game.home_team_id
    const awayId = game.away_team_id
    if (!homeId || !awayId) continue

    const verifiedDomain =
      org.custom_domain_verified_at && org.custom_domain?.trim()
        ? org.custom_domain.trim().toLowerCase()
        : null

    const { data: stats } = await admin
      .from('player_game_stats')
      .select('game_id, player_id, pts, players(full_name)')
      .eq('game_id', game.id)

    const topScorersLine = formatTopScorers((stats ?? []) as StatRow[])

    const { data: players, error: plErr } = await admin
      .from('players')
      .select('id, full_name, email, team_id, fan_email_stats_highlights_opt_out')
      .eq('organization_id', game.organization_id)
      .in('team_id', [homeId, awayId])

    if (plErr?.message?.includes('fan_email_stats_highlights_opt_out')) {
      const retry = await admin
        .from('players')
        .select('id, full_name, email, team_id')
        .eq('organization_id', game.organization_id)
        .in('team_id', [homeId, awayId])
      if (retry.error) {
        result.errors.push(`game ${game.id}: ${retry.error.message}`)
        continue
      }
      for (const player of retry.data ?? []) {
        await sendOne(admin, {
          result,
          dryRun,
          game,
          org,
          verifiedDomain,
          teamNameById,
          topScorersLine,
          player: { ...player, fan_email_stats_highlights_opt_out: false },
        })
      }
      continue
    }

    if (plErr) {
      result.errors.push(`game ${game.id}: ${plErr.message}`)
      continue
    }

    const { data: alreadySent } = await admin
      .from('stats_highlight_email_sends')
      .select('player_id')
      .eq('game_id', game.id)

    const sentSet = new Set((alreadySent ?? []).map((r) => String(r.player_id)))

    for (const player of players ?? []) {
      if (sentSet.has(String(player.id))) continue
      await sendOne(admin, {
        result,
        dryRun,
        game,
        org,
        verifiedDomain,
        teamNameById,
        topScorersLine,
        player,
      })
    }
  }

  return result
}

function formatTopScorers(rows: StatRow[]): string {
  const withPts = rows
    .map((r) => {
      const rel = r.players
      const name =
        rel && !Array.isArray(rel)
          ? String(rel.full_name || 'Player')
          : Array.isArray(rel) && rel[0]
            ? String(rel[0].full_name || 'Player')
            : 'Player'
      return { name, pts: Number(r.pts ?? 0) }
    })
    .filter((r) => r.pts > 0)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 3)

  if (withPts.length === 0) return 'Box score posted'
  return withPts.map((r) => `${r.name} ${r.pts}`).join(', ')
}

async function loadOrgs(
  admin: SupabaseClient,
  orgIds: string[],
  result: RunStatsHighlightEmailsResult
): Promise<Map<string, OrgRow> | null> {
  const selectWithTz =
    'id, name, slug, plan, league_timezone, fan_email_stats_highlights_enabled, custom_domain, custom_domain_verified_at'
  const selectFallback =
    'id, name, slug, plan, fan_email_stats_highlights_enabled, custom_domain, custom_domain_verified_at'

  let { data, error } = await admin.from('organizations').select(selectWithTz).in('id', orgIds)

  if (error?.message?.includes('league_timezone')) {
    const retry = await admin.from('organizations').select(selectFallback).in('id', orgIds)
    data = (retry.data ?? []).map((o) => ({ ...o, league_timezone: null }))
    error = retry.error
  }

  if (error?.message?.includes('fan_email_stats_highlights_enabled')) {
    const retry = await admin
      .from('organizations')
      .select('id, name, slug, plan, league_timezone, custom_domain, custom_domain_verified_at')
      .in('id', orgIds)
    data = (retry.data ?? []).map((o) => ({ ...o, fan_email_stats_highlights_enabled: true }))
    error = retry.error
  }

  if (error) {
    result.errors.push(error.message || 'Failed to load organizations')
    return null
  }

  const map = new Map<string, OrgRow>()
  for (const o of (data ?? []) as OrgRow[]) {
    map.set(o.id, {
      ...o,
      name: String(o.name || 'Your league'),
      slug: String(o.slug || ''),
    })
  }
  return map
}

async function sendOne(
  admin: SupabaseClient,
  ctx: {
    result: RunStatsHighlightEmailsResult
    dryRun: boolean
    game: GameRow
    org: OrgRow
    verifiedDomain: string | null
    teamNameById: Map<string, string>
    topScorersLine: string
    player: {
      id: string
      full_name: string | null
      email: string | null
      team_id: string | null
      fan_email_stats_highlights_opt_out?: boolean | null
    }
  }
) {
  const { result, dryRun, game, org, verifiedDomain, teamNameById, topScorersLine, player } = ctx

  if (player.fan_email_stats_highlights_opt_out === true) return
  const email = typeof player.email === 'string' ? player.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) return

  const teamId = player.team_id as string | null
  const teamName = teamId ? teamNameById.get(teamId) ?? 'Your team' : 'Your team'
  const homeName = teamNameById.get(String(game.home_team_id)) ?? 'Home'
  const awayName = teamNameById.get(String(game.away_team_id)) ?? 'Away'
  const opponentLabel = `${awayName} @ ${homeName}`

  const mail = buildStatsHighlightEmail({
    playerId: String(player.id),
    leagueName: org.name,
    leagueSlug: org.slug,
    verifiedCustomDomain: verifiedDomain,
    playerName: String(player.full_name || 'Player'),
    teamName,
    opponentLabel,
    scheduledAt: game.scheduled_at,
    homeScore: Number(game.home_score ?? 0),
    awayScore: Number(game.away_score ?? 0),
    leagueTimezone: org.league_timezone,
    gameId: game.id,
    topScorersLine,
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

  const { error: insErr } = await admin.from('stats_highlight_email_sends').insert({
    game_id: game.id,
    player_id: player.id,
  })

  if (insErr && !String(insErr.message).includes('duplicate')) {
    if (!String(insErr.message).includes('stats_highlight_email_sends')) {
      result.errors.push(`dedupe ${player.id}: ${insErr.message}`)
      return
    }
  }

  result.emailsSent++
}
