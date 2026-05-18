import { buildDropinReminderEmail } from '@/lib/dropin-reminder-email'
import { buildGameReminderEmail } from '@/lib/game-reminder-email'
import { buildLeagueSiteNewsEmail, buildTeamNewsEmail, publicLeagueNewsUrl } from '@/lib/league-news-email'
import { buildRegistrationOpensEmail } from '@/lib/registration-opens-email'
import { buildStatsHighlightEmail } from '@/lib/stats-highlight-email'

export const FAN_EMAIL_TEST_KINDS = [
  'game_reminder',
  'registration_opens',
  'dropin_reminder',
  'league_news',
  'team_news',
  'stats_highlight',
] as const

export type FanEmailTestKind = (typeof FAN_EMAIL_TEST_KINDS)[number]

export const FAN_EMAIL_TEST_KIND_LABELS: Record<FanEmailTestKind, string> = {
  game_reminder: 'Game reminder (24h before)',
  registration_opens: 'Registration opens',
  dropin_reminder: 'Drop-in reminder (24h before)',
  league_news: 'League website news',
  team_news: 'Team news post',
  stats_highlight: 'Stats highlight (final game)',
}

export type FanEmailTestOrg = {
  leagueName: string
  leagueSlug: string
  leagueTimezone: string | null
  verifiedCustomDomain?: string | null
}

const TEST_PLAYER_ID = '00000000-0000-4000-8000-000000000001'
const TEST_REGISTRATION_ID = '00000000-0000-4000-8000-000000000002'

function sampleIso(daysFromNow: number, hourUtc = 20): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysFromNow)
  d.setUTCHours(hourUtc, 0, 0, 0)
  return d.toISOString()
}

export function buildFanEmailTestMessage(
  kind: FanEmailTestKind,
  org: FanEmailTestOrg
): { subject: string; html: string; text: string } {
  const leagueName = org.leagueName || 'Your league'
  const leagueSlug = org.leagueSlug || 'your-league'
  const tz = org.leagueTimezone
  const domain = org.verifiedCustomDomain ?? null
  const recipientName = 'Preview recipient'

  let mail: { subject: string; html: string; text: string }

  switch (kind) {
    case 'game_reminder':
      mail = buildGameReminderEmail({
        playerId: TEST_PLAYER_ID,
        leagueName,
        leagueSlug,
        verifiedCustomDomain: domain,
        playerName: recipientName,
        playerEmail: 'preview@example.com',
        teamName: 'Sample Home Team',
        opponentLabel: 'Sample Away Team @ Sample Home Team',
        scheduledAt: sampleIso(1),
        location: 'Main Gym — Court 2',
        leagueTimezone: tz,
      })
      break
    case 'registration_opens':
      mail = buildRegistrationOpensEmail({
        playerId: TEST_PLAYER_ID,
        leagueName,
        leagueSlug,
        verifiedCustomDomain: domain,
        playerName: recipientName,
        seasonName: 'Summer 2026',
        opensAtIso: sampleIso(0),
        closesAtIso: sampleIso(14),
        leagueTimezone: tz,
      })
      break
    case 'dropin_reminder':
      mail = buildDropinReminderEmail({
        registrationId: TEST_REGISTRATION_ID,
        leagueName,
        leagueSlug,
        verifiedCustomDomain: domain,
        playerName: recipientName,
        sessionName: 'Thursday open run',
        scheduledAt: sampleIso(1, 18),
        location: 'Community centre',
        leagueTimezone: tz,
        isWaitlist: false,
      })
      break
    case 'league_news':
      mail = buildLeagueSiteNewsEmail({
        playerId: TEST_PLAYER_ID,
        leagueName,
        leagueSlug,
        verifiedCustomDomain: domain,
        playerName: recipientName,
        headline: 'Summer registration is live',
        preview:
          'This is sample league news copy — your real publish alert uses the headline and text from your published website.',
        newsUrl: publicLeagueNewsUrl(leagueSlug, domain),
      })
      break
    case 'team_news':
      mail = buildTeamNewsEmail({
        playerId: TEST_PLAYER_ID,
        leagueName,
        leagueSlug,
        verifiedCustomDomain: domain,
        playerName: recipientName,
        teamName: 'Sample Home Team',
        headline: 'Practice moved to 7pm',
        preview:
          'This is sample team news — your real alert uses the title and body from the team manager post.',
        newsUrl: publicLeagueNewsUrl(leagueSlug, domain, '00000000-0000-4000-8000-000000000099'),
      })
      break
    case 'stats_highlight':
      mail = buildStatsHighlightEmail({
        playerId: TEST_PLAYER_ID,
        leagueName,
        leagueSlug,
        verifiedCustomDomain: domain,
        playerName: recipientName,
        teamName: 'Sample Home Team',
        opponentLabel: 'Sample Away Team @ Sample Home Team',
        scheduledAt: sampleIso(-1),
        homeScore: 78,
        awayScore: 72,
        leagueTimezone: tz,
        gameId: '00000000-0000-4000-8000-000000000088',
        topScorersLine: 'Alex Rivera 24, Jordan Lee 18, Sam Kim 15',
      })
      break
    default: {
      const _exhaustive: never = kind
      throw new Error(`Unknown test kind: ${_exhaustive}`)
    }
  }

  const testBanner =
    '<p style="margin:0 0 16px;padding:10px 12px;background:#fff8e6;border:1px solid #e8d48a;border-radius:8px;font-size:13px;color:#5c4a00;"><strong>Test email</strong> — sent from Dashboard → Settings → Email notifications. Unsubscribe links are disabled for tests.</p>'

  return {
    subject: `[TEST] ${mail.subject}`,
    html: mail.html.replace(
      '<td style="padding:20px 22px;color:#1a1a1a;font-size:15px;line-height:1.55;">',
      `<td style="padding:20px 22px;color:#1a1a1a;font-size:15px;line-height:1.55;">${testBanner}`
    ),
    text: `[TEST — organizer preview]\n\n${mail.text}`,
  }
}

export function isFanEmailTestKind(value: unknown): value is FanEmailTestKind {
  return typeof value === 'string' && (FAN_EMAIL_TEST_KINDS as readonly string[]).includes(value)
}
