import { formatGameDateTime } from '@/lib/format-game-datetime'
import { publicFanSiteOrigin } from '@/lib/public-site-origin'
import {
  gameReminderUnsubscribeApiUrl,
  gameReminderUnsubscribePageUrl,
} from '@/lib/game-reminder-unsubscribe'

export type GameReminderEmailInput = {
  playerId: string
  leagueName: string
  leagueSlug: string
  verifiedCustomDomain?: string | null
  playerName: string
  playerEmail: string
  teamName: string
  opponentLabel: string
  scheduledAt: string | null
  location: string | null
  leagueTimezone: string | null
}

export function buildGameReminderEmail(input: GameReminderEmailInput): {
  subject: string
  html: string
  text: string
  listUnsubscribeUrl: string
} {
  const when = formatGameDateTime(input.scheduledAt, input.leagueTimezone)
  const origin = publicFanSiteOrigin(input.verifiedCustomDomain)
  const scheduleUrl = `${origin}/league/${encodeURIComponent(input.leagueSlug)}?tab=schedule`
  const loc = input.location?.trim() ? input.location.trim() : 'See league schedule for location'
  const unsubscribeUrl = gameReminderUnsubscribePageUrl(input.playerId)
  const listUnsubscribeUrl = gameReminderUnsubscribeApiUrl(input.playerId)

  const subject = `Game tomorrow: ${input.opponentLabel} — ${input.leagueName}`

  const text = [
    `Hi ${input.playerName},`,
    '',
    `Reminder: you have a game tomorrow with ${input.teamName}.`,
    '',
    `Matchup: ${input.opponentLabel}`,
    `When: ${when}`,
    `Where: ${loc}`,
    '',
    `League schedule: ${scheduleUrl}`,
    '',
    `Unsubscribe from game reminders: ${unsubscribeUrl}`,
    '',
    `— ${input.leagueName} via MyLeaguePortal`,
  ].join('\n')

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Game tomorrow — ${escapeHtml(input.opponentLabel)} · ${escapeHtml(when)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffef9;border:1px solid #e5e0d6;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 22px 8px;background:#5a7a2a;color:#fff;">
              <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;opacity:0.9;">${escapeHtml(input.leagueName)}</p>
              <p style="margin:6px 0 0;font-size:20px;font-weight:700;line-height:1.25;">Game tomorrow</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 22px;color:#1a1a1a;font-size:15px;line-height:1.55;">
              <p style="margin:0 0 14px;">Hi ${escapeHtml(input.playerName)},</p>
              <p style="margin:0 0 16px;">You're on <strong>${escapeHtml(input.teamName)}</strong> for tomorrow's game.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;font-size:14px;border-collapse:collapse;">
                <tr>
                  <td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;width:72px;">Matchup</td>
                  <td style="padding:6px 0;font-weight:600;">${escapeHtml(input.opponentLabel)}</td>
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
              <p style="margin:0 0 20px;">
                <a href="${escapeHtml(scheduleUrl)}" style="display:inline-block;background:#5a7a2a;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px;">View league schedule</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 22px 18px;border-top:1px solid #ebe6dc;font-size:12px;line-height:1.5;color:#777;">
              <p style="margin:0 0 8px;">You're receiving this because you're on the roster with an email address for ${escapeHtml(input.leagueName)}.</p>
              <p style="margin:0;">
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#5a7a2a;font-weight:600;">Unsubscribe from game reminders</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-size:11px;color:#999;">MyLeaguePortal</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()

  return { subject, html, text, listUnsubscribeUrl }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
