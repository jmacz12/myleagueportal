import { formatGameDateTime } from '@/lib/format-game-datetime'
import { getPublicSiteOrigin, publicFanSiteOrigin } from '@/lib/public-site-origin'
import { createFanAlertUnsubscribeToken } from '@/lib/fan-alert-unsubscribe-token'
import { buildTransactionalEmailHtml, escapeHtml } from '@/lib/transactional-email-layout'

export type RegistrationOpensEmailInput = {
  playerId: string
  leagueName: string
  leagueSlug: string
  verifiedCustomDomain?: string | null
  playerName: string
  seasonName: string
  opensAtIso: string | null
  closesAtIso: string | null
  leagueTimezone: string | null
}

export function registrationOpensUnsubscribePageUrl(playerId: string): string {
  const token = createFanAlertUnsubscribeToken('registration_opens', playerId)
  return `${getPublicSiteOrigin()}/unsubscribe/registration-opens?token=${encodeURIComponent(token)}`
}

export function registrationOpensUnsubscribeApiUrl(playerId: string): string {
  const token = createFanAlertUnsubscribeToken('registration_opens', playerId)
  return `${getPublicSiteOrigin()}/api/registration-opens/unsubscribe?token=${encodeURIComponent(token)}`
}

export function buildRegistrationOpensEmail(input: RegistrationOpensEmailInput): {
  subject: string
  html: string
  text: string
  listUnsubscribeUrl: string
} {
  const origin = publicFanSiteOrigin(input.verifiedCustomDomain)
  const registerUrl = `${origin}/join/${encodeURIComponent(input.leagueSlug)}/register`
  const whenOpens = input.opensAtIso
    ? formatGameDateTime(input.opensAtIso, input.leagueTimezone)
    : 'now'
  const closesLine = input.closesAtIso
    ? `Registration closes ${formatGameDateTime(input.closesAtIso, input.leagueTimezone)}.`
    : ''
  const unsubscribeUrl = registrationOpensUnsubscribePageUrl(input.playerId)
  const listUnsubscribeUrl = registrationOpensUnsubscribeApiUrl(input.playerId)

  const subject = `Registration open: ${input.seasonName} — ${input.leagueName}`

  const text = [
    `Hi ${input.playerName},`,
    '',
    `Online registration for ${input.seasonName} is now open (${whenOpens}).`,
    closesLine,
    '',
    `Sign up: ${registerUrl}`,
    '',
    `Unsubscribe from registration alerts: ${unsubscribeUrl}`,
    '',
    `— ${input.leagueName} via MyLeaguePortal`,
  ]
    .filter(Boolean)
    .join('\n')

  const bodyHtml = `
              <p style="margin:0 0 14px;">Hi ${escapeHtml(input.playerName)},</p>
              <p style="margin:0 0 16px;">
                Online registration for <strong>${escapeHtml(input.seasonName)}</strong> is now open.
              </p>
              <p style="margin:0 0 18px;font-size:14px;color:#444;">
                ${escapeHtml(whenOpens)}${closesLine ? ` · ${escapeHtml(closesLine)}` : ''}
              </p>
              <p style="margin:0 0 20px;">
                <a href="${escapeHtml(registerUrl)}" style="display:inline-block;background:#5a7a2a;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">Register for the season</a>
              </p>`

  const footerHtml = `
              <p style="margin:0 0 8px;">You're receiving this because you're on the roster with an email for ${escapeHtml(input.leagueName)}.</p>
              <p style="margin:0;">
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#5a7a2a;font-weight:600;">Unsubscribe from registration alerts</a>
              </p>`

  const html = buildTransactionalEmailHtml({
    preheader: `${input.seasonName} registration is open`,
    headerBandLabel: input.leagueName,
    headerTitle: 'Season registration is open',
    bodyHtml,
    footerHtml,
  })

  return { subject, html, text, listUnsubscribeUrl }
}
