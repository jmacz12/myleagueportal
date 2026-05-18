import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTransactionalEmail, isEmailDeliveryConfigured } from '@/lib/email/send-transactional'
import { isProOrEnterprise, normalizeOrgPlan } from '@/lib/org-plan-tier'
import {
  buildLeagueSiteNewsEmail,
  buildTeamNewsEmail,
  publicLeagueNewsUrl,
} from '@/lib/league-news-email'
import {
  headlineFromLeagueSitePublished,
  leagueSiteHasPublishableNews,
} from '@/lib/league-site-news-headline'
import { parseLeagueSitePayload } from '@/lib/league-site'
import { plainTextPreview } from '@/lib/plain-text-preview'

const CRON_WINDOW_MS = 25 * 60 * 60 * 1000

export type RunLeagueNewsEmailsResult = {
  configured: boolean
  sitePublishesInWindow: number
  teamPostsInWindow: number
  emailsAttempted: number
  emailsSent: number
  emailsSkipped: number
  errors: string[]
  dryRun: boolean
}

type OrgRow = {
  id: string
  name: string
  slug: string
  plan: unknown
  fan_email_news_publish_enabled?: boolean | null
  custom_domain?: string | null
  custom_domain_verified_at?: string | null
}

export async function runLeagueNewsEmails(
  admin: SupabaseClient,
  options?: { dryRun?: boolean; now?: Date }
): Promise<RunLeagueNewsEmailsResult> {
  const dryRun = options?.dryRun === true
  const now = options?.now ?? new Date()
  const windowStart = new Date(now.getTime() - CRON_WINDOW_MS)
  const configured = isEmailDeliveryConfigured()

  const result: RunLeagueNewsEmailsResult = {
    configured,
    sitePublishesInWindow: 0,
    teamPostsInWindow: 0,
    emailsAttempted: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    errors: [],
    dryRun,
  }

  await runLeagueSitePublishes(admin, { result, dryRun, now, windowStart })
  await runTeamNewsPosts(admin, { result, dryRun, now, windowStart })

  return result
}

async function runLeagueSitePublishes(
  admin: SupabaseClient,
  ctx: {
    result: RunLeagueNewsEmailsResult
    dryRun: boolean
    now: Date
    windowStart: Date
  }
) {
  const { result, dryRun, now, windowStart } = ctx

  let { data: siteRows, error: siteErr } = await admin
    .from('league_site_content')
    .select('organization_id, published, published_at')
    .not('published_at', 'is', null)
    .gte('published_at', windowStart.toISOString())
    .lte('published_at', now.toISOString())

  if (siteErr?.message?.includes('published_at')) {
    return
  }

  if (siteErr) {
    result.errors.push(siteErr.message || 'Failed to load league site publishes')
    return
  }

  const rows = siteRows ?? []
  result.sitePublishesInWindow = rows.length
  if (rows.length === 0) return

  const orgIds = [...new Set(rows.map((r) => String(r.organization_id)))]
  const orgById = await loadOrgs(admin, orgIds, result)
  if (!orgById) return

  for (const row of rows) {
    const orgId = String(row.organization_id)
    const org = orgById.get(orgId)
    if (!org) continue
    if (!isProOrEnterprise(normalizeOrgPlan(org.plan))) continue
    if (org.fan_email_news_publish_enabled === false) continue

    const payload = parseLeagueSitePayload(row.published)
    if (!leagueSiteHasPublishableNews(payload)) continue

    const publishedAt = String(row.published_at)
    const headline = headlineFromLeagueSitePublished(row.published)
    const preview = plainTextPreview(
      payload.sections
        .map((s) => {
          if ('body' in s && typeof s.body === 'string') return s.body
          return ''
        })
        .join(' ')
    )

    const verifiedDomain = verifiedCustomDomain(org)
    const newsUrl = publicLeagueNewsUrl(org.slug, verifiedDomain)

    const { data: alreadySent } = await admin
      .from('league_site_news_email_sends')
      .select('id')
      .eq('organization_id', orgId)
      .eq('site_updated_at', publishedAt)
      .maybeSingle()

    if (alreadySent) continue

    const loaded = await loadPlayersForOrg(admin, orgId, result)
    if (!loaded.players) continue

    let anySent = false
    for (const player of loaded.players) {
      const sent = await sendNewsEmail(admin, {
        result,
        dryRun,
        player,
        build: (p) =>
          buildLeagueSiteNewsEmail({
            playerId: p.id,
            leagueName: org.name,
            leagueSlug: org.slug,
            verifiedCustomDomain: verifiedDomain,
            playerName: p.name,
            headline,
            preview,
            newsUrl,
          }),
      })
      if (sent) anySent = true
    }

    if (!dryRun && anySent) {
      const { error } = await admin.from('league_site_news_email_sends').insert({
        organization_id: orgId,
        site_updated_at: publishedAt,
      })
      if (error && !String(error.message).includes('duplicate')) {
        result.errors.push(`site dedupe ${orgId}: ${error.message}`)
      }
    }
  }
}

async function runTeamNewsPosts(
  admin: SupabaseClient,
  ctx: {
    result: RunLeagueNewsEmailsResult
    dryRun: boolean
    now: Date
    windowStart: Date
  }
) {
  const { result, dryRun, now, windowStart } = ctx

  const { data: posts, error: postErr } = await admin
    .from('team_news_posts')
    .select('id, organization_id, team_id, title, body, created_at')
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', now.toISOString())

  if (postErr) {
    result.errors.push(postErr.message || 'Failed to load team news posts')
    return
  }

  const postRows = posts ?? []
  result.teamPostsInWindow = postRows.length
  if (postRows.length === 0) return

  const orgIds = [...new Set(postRows.map((p) => String(p.organization_id)))]
  const orgById = await loadOrgs(admin, orgIds, result)
  if (!orgById) return

  const teamIds = [...new Set(postRows.map((p) => String(p.team_id)))]
  const { data: teams } = await admin.from('teams').select('id, name').in('id', teamIds)
  const teamNameById = new Map((teams ?? []).map((t) => [String(t.id), String(t.name || 'Team')]))

  for (const post of postRows) {
    const org = orgById.get(String(post.organization_id))
    if (!org) continue
    if (!isProOrEnterprise(normalizeOrgPlan(org.plan))) continue
    if (org.fan_email_news_publish_enabled === false) continue

    const teamId = String(post.team_id)
    const teamName = teamNameById.get(teamId) ?? 'Your team'
    const headline = String(post.title || 'Team news').trim().slice(0, 120)
    const preview = plainTextPreview(String(post.body || ''))
    const verifiedDomain = verifiedCustomDomain(org)
    const newsUrl = publicLeagueNewsUrl(org.slug, verifiedDomain, teamId)

    const { data: alreadySent } = await admin
      .from('team_news_email_sends')
      .select('player_id')
      .eq('post_id', post.id)

    const sentSet = new Set((alreadySent ?? []).map((r) => String(r.player_id)))

    const { data: players, error: plErr } = await admin
      .from('players')
      .select('id, full_name, email, fan_email_news_publish_opt_out')
      .eq('organization_id', org.id)
      .eq('team_id', teamId)

    if (plErr?.message?.includes('fan_email_news_publish_opt_out')) {
      const retry = await admin
        .from('players')
        .select('id, full_name, email')
        .eq('organization_id', org.id)
        .eq('team_id', teamId)
      if (retry.error) {
        result.errors.push(`post ${post.id}: ${retry.error.message}`)
        continue
      }
      for (const player of retry.data ?? []) {
        if (sentSet.has(String(player.id))) continue
        await sendNewsEmail(admin, {
          result,
          dryRun,
          player: {
            id: String(player.id),
            name: String(player.full_name || 'Player'),
            email: player.email,
            optOut: false,
          },
          build: (p) =>
            buildTeamNewsEmail({
              playerId: p.id,
              leagueName: org.name,
              leagueSlug: org.slug,
              verifiedCustomDomain: verifiedDomain,
              playerName: p.name,
              teamName,
              headline,
              preview,
              newsUrl,
            }),
          onSent: async (playerId) => {
            if (dryRun) return
            const { error } = await admin.from('team_news_email_sends').insert({
              post_id: post.id,
              player_id: playerId,
            })
            if (error && !String(error.message).includes('duplicate')) {
              result.errors.push(`team news dedupe ${playerId}: ${error.message}`)
            }
          },
        })
      }
      continue
    }

    if (plErr) {
      result.errors.push(`post ${post.id}: ${plErr.message}`)
      continue
    }

    for (const player of players ?? []) {
      const pid = String(player.id)
      if (sentSet.has(pid)) continue
      await sendNewsEmail(admin, {
        result,
        dryRun,
        player: {
          id: pid,
          name: String(player.full_name || 'Player'),
          email: player.email,
          optOut: player.fan_email_news_publish_opt_out === true,
        },
        build: (p) =>
          buildTeamNewsEmail({
            playerId: p.id,
            leagueName: org.name,
            leagueSlug: org.slug,
            verifiedCustomDomain: verifiedDomain,
            playerName: p.name,
            teamName,
            headline,
            preview,
            newsUrl,
          }),
        onSent: async (playerId) => {
          if (dryRun) return
          const { error } = await admin.from('team_news_email_sends').insert({
            post_id: post.id,
            player_id: playerId,
          })
          if (error && !String(error.message).includes('duplicate')) {
            result.errors.push(`team news dedupe ${playerId}: ${error.message}`)
          }
        },
      })
    }
  }
}

async function loadOrgs(
  admin: SupabaseClient,
  orgIds: string[],
  result: RunLeagueNewsEmailsResult
): Promise<Map<string, OrgRow> | null> {
  const selectWithFlag =
    'id, name, slug, plan, fan_email_news_publish_enabled, custom_domain, custom_domain_verified_at'
  const selectFallback = 'id, name, slug, plan, custom_domain, custom_domain_verified_at'

  let { data, error } = await admin.from('organizations').select(selectWithFlag).in('id', orgIds)

  if (error?.message?.includes('fan_email_news_publish_enabled')) {
    const retry = await admin.from('organizations').select(selectFallback).in('id', orgIds)
    data = (retry.data ?? []).map((o) => ({ ...o, fan_email_news_publish_enabled: true }))
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

async function loadPlayersForOrg(
  admin: SupabaseClient,
  orgId: string,
  result: RunLeagueNewsEmailsResult
): Promise<{ players: PlayerRow[]; error?: boolean } | { players: null; error: true }> {
  const { data, error } = await admin
    .from('players')
    .select('id, full_name, email, fan_email_news_publish_opt_out')
    .eq('organization_id', orgId)

  if (error?.message?.includes('fan_email_news_publish_opt_out')) {
    const retry = await admin.from('players').select('id, full_name, email').eq('organization_id', orgId)
    if (retry.error) {
      result.errors.push(`org ${orgId}: ${retry.error.message}`)
      return { players: null, error: true }
    }
    return {
      players: (retry.data ?? []).map((p) => ({
        id: String(p.id),
        name: String(p.full_name || 'Player'),
        email: p.email,
        optOut: false,
      })),
    }
  }

  if (error) {
    result.errors.push(`org ${orgId}: ${error.message}`)
    return { players: null, error: true }
  }

  return {
    players: (data ?? []).map((p) => ({
      id: String(p.id),
      name: String(p.full_name || 'Player'),
      email: p.email,
      optOut: p.fan_email_news_publish_opt_out === true,
    })),
  }
}

type PlayerRow = {
  id: string
  name: string
  email: string | null
  optOut: boolean
}

function verifiedCustomDomain(org: OrgRow): string | null {
  return org.custom_domain_verified_at && org.custom_domain?.trim()
    ? org.custom_domain.trim().toLowerCase()
    : null
}

async function sendNewsEmail(
  admin: SupabaseClient,
  ctx: {
    result: RunLeagueNewsEmailsResult
    dryRun: boolean
    player: PlayerRow
    build: (p: { id: string; name: string }) => ReturnType<typeof buildLeagueSiteNewsEmail>
    onSent?: (playerId: string) => Promise<void>
  }
): Promise<boolean> {
  void admin
  const { result, dryRun, player, build, onSent } = ctx
  if (player.optOut) return false
  const email = typeof player.email === 'string' ? player.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) return false

  const mail = build({ id: player.id, name: player.name })
  result.emailsAttempted++

  if (dryRun) {
    result.emailsSent++
    return true
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
    return false
  }

  if (sendRes.skipped) {
    result.emailsSkipped++
    return false
  }

  if (onSent) await onSent(player.id)
  result.emailsSent++
  return true
}
