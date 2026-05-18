import { formatGameDateTime } from '@/lib/format-game-datetime'
import { getPublicSiteOrigin, publicFanSiteOrigin } from '@/lib/public-site-origin'
import { createFanAlertUnsubscribeToken } from '@/lib/fan-alert-unsubscribe-token'
import { buildTransactionalEmailHtml, escapeHtml } from '@/lib/transactional-email-layout'

export type StatsHighlightEmailInput = {
  playerId: string
  leagueName: string
  leagueSlug: string
  verifiedCustomDomain?: string | null
  playerName: string
  teamName: string
  opponentLabel: string
  scheduledAt: string | null
  homeScore: number
  awayScore: number
  leagueTimezone: string | null
  gameId: string
  topScorersLine: string
}

export function statsHighlightUnsubscribePageUrl(playerId: string): string {
  const token = createFanAlertUnsubscribeToken('stats_highlight', playerId)
  return `${getPublicSiteOrigin()}/unsubscribe/stats-highlights?token=${encodeURIComponent(token)}`
}

export function statsHighlightUnsubscribeApiUrl(playerId: string): string {
  const token = createFanAlertUnsubscribeToken('stats_highlight', playerId)
  return `${getPublicSiteOrigin()}/api/stats-highlights/unsubscribe?token=${encodeURIComponent(token)}`
}

export function buildStatsHighlightEmail(input: StatsHighlightEmailInput): {
  subject: string
  html: string
  text: string
  listUnsubscribeUrl: string
} {
  const origin = publicFanSiteOrigin(input.verifiedCustomDomain)
  const boxScoreUrl = `${origin}/league/${encodeURIComponent(input.leagueSlug)}?tab=stream&game=${encodeURIComponent(input.gameId)}`
  const when = input.scheduledAt
    ? formatGameDateTime(input.scheduledAt, input.leagueTimezone)
    : 'Recent game'
  const scoreLine = `${input.homeScore}–${input.awayScore}`
  const unsubscribeUrl = statsHighlightUnsubscribePageUrl(input.playerId)
  const listUnsubscribeUrl = statsHighlightUnsubscribeApiUrl(input.playerId)

  const subject = `Final: ${input.opponentLabel} (${scoreLine}) — ${input.leagueName}`

  const text = [
    `Hi ${input.playerName},`,
    '',
    `Final — ${input.opponentLabel}`,
    `${when} · ${scoreLine}`,
    input.topScorersLine ? `Top scorers: ${input.topScorersLine}` : '',
    '',
    `Box score: ${boxScoreUrl}`,
    '',
    `Unsubscribe from stats highlights: ${unsubscribeUrl}`,
    '',
    `— ${input.leagueName} via MyLeaguePortal`,
  ]
    .filter(Boolean)
    .join('\n')

  const bodyHtml = `
              <p style="margin:0 0 14px;">Hi ${escapeHtml(input.playerName)},</p>
              <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#1a1a1a;">Final — ${escapeHtml(input.opponentLabel)}</p>
              <p style="margin:0 0 6px;font-size:14px;color:#444;">${escapeHtml(when)} · <strong>${escapeHtml(scoreLine)}</strong></p>
              ${
                input.topScorersLine
                  ? `<p style="margin:0 0 18px;font-size:13px;color:#555;">Top scorers: ${escapeHtml(input.topScorersLine)}</p>`
                  : '<p style="margin:0 0 18px;"></p>'
              }
              <p style="margin:0 0 20px;">
                <a href="${escapeHtml(boxScoreUrl)}" style="display:inline-block;background:#5a7a2a;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">View box score</a>
              </p>`

  const footerHtml = `
              <p style="margin:0 0 8px;">You're receiving this because you play for ${escapeHtml(input.teamName)} in ${escapeHtml(input.leagueName)}.</p>
              <p style="margin:0;">
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#5a7a2a;font-weight:600;">Unsubscribe from stats highlights</a>
              </p>`

  const html = buildTransactionalEmailHtml({
    preheader: `Final ${scoreLine} — ${input.opponentLabel}`,
    headerBandLabel: input.leagueName,
    headerTitle: 'Game final + stats',
    bodyHtml,
    footerHtml,
  })

  return { subject, html, text, listUnsubscribeUrl }
}
