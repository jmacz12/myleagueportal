import { formatGameDateTime } from '@/lib/format-game-datetime'
import { publicFanSiteOrigin } from '@/lib/public-site-origin'

export type GameReminderEmailInput = {
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
} {
  const when = formatGameDateTime(input.scheduledAt, input.leagueTimezone)
  const origin = publicFanSiteOrigin(input.verifiedCustomDomain)
  const scheduleUrl = `${origin}/league/${encodeURIComponent(input.leagueSlug)}?tab=schedule`
  const loc = input.location?.trim() ? input.location.trim() : 'See league schedule for location'

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
    `— ${input.leagueName} via MyLeaguePortal`,
  ].join('\n')

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 520px;">
  <p>Hi ${escapeHtml(input.playerName)},</p>
  <p><strong>Game tomorrow</strong> — you're on <strong>${escapeHtml(input.teamName)}</strong>.</p>
  <table style="margin: 16px 0; border-collapse: collapse; font-size: 14px;">
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Matchup</td><td><strong>${escapeHtml(input.opponentLabel)}</strong></td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">When</td><td>${escapeHtml(when)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Where</td><td>${escapeHtml(loc)}</td></tr>
  </table>
  <p><a href="${escapeHtml(scheduleUrl)}" style="display: inline-block; background: #5a7a2a; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: 600;">View league schedule</a></p>
  <p style="font-size: 12px; color: #888; margin-top: 24px;">${escapeHtml(input.leagueName)} · MyLeaguePortal</p>
</body>
</html>`.trim()

  return { subject, html, text }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
