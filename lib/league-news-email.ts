import { getPublicSiteOrigin, publicFanSiteOrigin } from '@/lib/public-site-origin'
import { createFanAlertUnsubscribeToken } from '@/lib/fan-alert-unsubscribe-token'
import { buildTransactionalEmailHtml, escapeHtml } from '@/lib/transactional-email-layout'

export type LeagueNewsEmailInput = {
  playerId: string
  leagueName: string
  leagueSlug: string
  verifiedCustomDomain?: string | null
  playerName: string
  headline: string
  preview: string
  newsUrl: string
}

export function leagueNewsUnsubscribePageUrl(playerId: string): string {
  const token = createFanAlertUnsubscribeToken('news_publish', playerId)
  return `${getPublicSiteOrigin()}/unsubscribe/league-news?token=${encodeURIComponent(token)}`
}

export function leagueNewsUnsubscribeApiUrl(playerId: string): string {
  const token = createFanAlertUnsubscribeToken('news_publish', playerId)
  return `${getPublicSiteOrigin()}/api/league-news/unsubscribe?token=${encodeURIComponent(token)}`
}

export function buildLeagueSiteNewsEmail(input: LeagueNewsEmailInput): {
  subject: string
  html: string
  text: string
  listUnsubscribeUrl: string
} {
  return buildNewsEmail({ ...input, subjectPrefix: 'League news' })
}

export type TeamNewsEmailInput = LeagueNewsEmailInput & {
  teamName: string
}

export function buildTeamNewsEmail(input: TeamNewsEmailInput): {
  subject: string
  html: string
  text: string
  listUnsubscribeUrl: string
} {
  return buildNewsEmail({
    ...input,
    subjectPrefix: `${input.teamName} news`,
    headline: input.headline,
  })
}

function buildNewsEmail(
  input: LeagueNewsEmailInput & { subjectPrefix: string }
): {
  subject: string
  html: string
  text: string
  listUnsubscribeUrl: string
} {
  const unsubscribeUrl = leagueNewsUnsubscribePageUrl(input.playerId)
  const listUnsubscribeUrl = leagueNewsUnsubscribeApiUrl(input.playerId)
  const subject = `${input.subjectPrefix}: ${input.headline} — ${input.leagueName}`
  const preview = input.preview.trim().slice(0, 280)

  const text = [
    `Hi ${input.playerName},`,
    '',
    `${input.headline}`,
    preview ? preview : '',
    '',
    `Read more: ${input.newsUrl}`,
    '',
    `Unsubscribe from news alerts: ${unsubscribeUrl}`,
    '',
    `— ${input.leagueName} via MyLeaguePortal`,
  ]
    .filter(Boolean)
    .join('\n')

  const bodyHtml = `
              <p style="margin:0 0 14px;">Hi ${escapeHtml(input.playerName)},</p>
              <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#1a1a1a;">${escapeHtml(input.headline)}</p>
              ${
                preview
                  ? `<p style="margin:0 0 18px;font-size:14px;color:#444;line-height:1.5;">${escapeHtml(preview)}</p>`
                  : '<p style="margin:0 0 18px;"></p>'
              }
              <p style="margin:0 0 20px;">
                <a href="${escapeHtml(input.newsUrl)}" style="display:inline-block;background:#5a7a2a;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">Read on the league site</a>
              </p>`

  const footerHtml = `
              <p style="margin:0 0 8px;">You're receiving this because you're on the roster with an email for ${escapeHtml(input.leagueName)}.</p>
              <p style="margin:0;">
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#5a7a2a;font-weight:600;">Unsubscribe from news alerts</a>
              </p>`

  const html = buildTransactionalEmailHtml({
    preheader: input.headline,
    headerBandLabel: input.leagueName,
    headerTitle: 'New league news',
    bodyHtml,
    footerHtml,
  })

  return { subject, html, text, listUnsubscribeUrl }
}

export function publicLeagueNewsUrl(
  leagueSlug: string,
  verifiedCustomDomain?: string | null,
  teamId?: string | null
): string {
  const origin = publicFanSiteOrigin(verifiedCustomDomain)
  if (teamId) {
    return `${origin}/league/${encodeURIComponent(leagueSlug)}/teams/${encodeURIComponent(teamId)}?tab=news`
  }
  return `${origin}/league/${encodeURIComponent(leagueSlug)}?tab=news`
}
