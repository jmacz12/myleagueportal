import { formatGameDateTime } from '@/lib/format-game-datetime'
import { getPublicSiteOrigin, publicFanSiteOrigin } from '@/lib/public-site-origin'
import { createFanAlertUnsubscribeToken } from '@/lib/fan-alert-unsubscribe-token'
import { buildTransactionalEmailHtml, escapeHtml } from '@/lib/transactional-email-layout'

export type DropinReminderEmailInput = {
  registrationId: string
  leagueName: string
  leagueSlug: string
  verifiedCustomDomain?: string | null
  playerName: string
  sessionName: string
  scheduledAt: string | null
  location: string | null
  leagueTimezone: string | null
  isWaitlist: boolean
}

export function dropinReminderUnsubscribePageUrl(registrationId: string): string {
  const token = createFanAlertUnsubscribeToken('dropin_reminder', registrationId)
  return `${getPublicSiteOrigin()}/unsubscribe/dropin-reminders?token=${encodeURIComponent(token)}`
}

export function dropinReminderUnsubscribeApiUrl(registrationId: string): string {
  const token = createFanAlertUnsubscribeToken('dropin_reminder', registrationId)
  return `${getPublicSiteOrigin()}/api/dropin-reminders/unsubscribe?token=${encodeURIComponent(token)}`
}

export function buildDropinReminderEmail(input: DropinReminderEmailInput): {
  subject: string
  html: string
  text: string
  listUnsubscribeUrl: string
} {
  const origin = publicFanSiteOrigin(input.verifiedCustomDomain)
  const dropinsUrl = `${origin}/join/${encodeURIComponent(input.leagueSlug)}/dropins`
  const when = formatGameDateTime(input.scheduledAt, input.leagueTimezone)
  const loc = input.location?.trim() ? input.location.trim() : 'See drop-in page for location'
  const waitlistNote = input.isWaitlist
    ? 'You are on the waitlist — the organizer may move you to the roster if a spot opens.'
    : ''
  const unsubscribeUrl = dropinReminderUnsubscribePageUrl(input.registrationId)
  const listUnsubscribeUrl = dropinReminderUnsubscribeApiUrl(input.registrationId)

  const subject = `Drop-in tomorrow: ${input.sessionName} — ${input.leagueName}`

  const text = [
    `Hi ${input.playerName},`,
    '',
    `Reminder: your drop-in session is tomorrow.`,
    '',
    `Session: ${input.sessionName}`,
    `When: ${when}`,
    `Where: ${loc}`,
    waitlistNote,
    '',
    `Drop-in page: ${dropinsUrl}`,
    '',
    `Unsubscribe from drop-in reminders: ${unsubscribeUrl}`,
    '',
    `— ${input.leagueName} via MyLeaguePortal`,
  ]
    .filter(Boolean)
    .join('\n')

  const bodyHtml = `
              <p style="margin:0 0 14px;">Hi ${escapeHtml(input.playerName)},</p>
              <p style="margin:0 0 16px;">Your drop-in session is tomorrow.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-size:14px;border-collapse:collapse;">
                <tr>
                  <td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;width:72px;">Session</td>
                  <td style="padding:6px 0;font-weight:600;">${escapeHtml(input.sessionName)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;">When</td>
                  <td style="padding:6px 0;">${escapeHtml(when)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;">Where</td>
                  <td style="padding:6px 0;">${escapeHtml(loc)}</td>
                </tr>
              </table>
              ${waitlistNote ? `<p style="margin:0 0 16px;font-size:14px;color:#666;">${escapeHtml(waitlistNote)}</p>` : ''}
              <p style="margin:0 0 20px;">
                <a href="${escapeHtml(dropinsUrl)}" style="display:inline-block;background:#5a7a2a;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">View drop-ins</a>
              </p>`

  const footerHtml = `
              <p style="margin:0 0 8px;">You're receiving this because you signed up for this drop-in with this email address.</p>
              <p style="margin:0;">
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#5a7a2a;font-weight:600;">Unsubscribe from drop-in reminders</a>
              </p>`

  const html = buildTransactionalEmailHtml({
    preheader: `Drop-in tomorrow — ${input.sessionName}`,
    headerBandLabel: input.leagueName,
    headerTitle: 'Drop-in tomorrow',
    bodyHtml,
    footerHtml,
  })

  return { subject, html, text, listUnsubscribeUrl }
}
