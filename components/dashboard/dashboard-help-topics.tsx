'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { DashboardHelpSection } from '@/components/dashboard/DashboardHelpSection'

export type DashboardHelpTopic =
  | 'overview'
  | 'seasons'
  | 'teams'
  | 'players'
  | 'games'
  | 'live-scoring'
  | 'stats'
  | 'league-site'
  | 'settings'

type HelpTopicMeta = {
  title: string
  subtitle: string
  titleId: string
  body: ReactNode
}

const bodyText = { margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 } as const

export function getDashboardHelpTopic(topic: DashboardHelpTopic): HelpTopicMeta {
  return HELP_TOPICS[topic]
}

const HELP_TOPICS: Record<DashboardHelpTopic, HelpTopicMeta> = {
  overview: {
    title: 'Overview guide',
    subtitle: 'Your league home base in the dashboard.',
    titleId: 'help-overview-title',
    body: (
      <>
        <DashboardHelpSection title="What you see here">
          <p style={bodyText}>
            Player, team, and season counts at a glance. When you have an upcoming league game, a shortcut appears here.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Where to go next">
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Seasons & Teams</strong> — build your league structure
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Players</strong> — roster and assignments
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Games</strong> — schedule and score league games
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Drop-ins</strong> — pickup sessions without a full season
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>League website</strong> — your public fan page
            </li>
          </ul>
        </DashboardHelpSection>
        <DashboardHelpSection title="Share with players">
          <p style={bodyText}>
            Copy registration and public links from{' '}
            <Link href="/dashboard/settings" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              Settings
            </Link>{' '}
            or open your site from{' '}
            <Link href="/dashboard/league-site" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              League website
            </Link>
            .
          </p>
        </DashboardHelpSection>
      </>
    ),
  },
  seasons: {
    title: 'Seasons guide',
    subtitle: 'Competitive league seasons with teams and a schedule.',
    titleId: 'help-seasons-title',
    body: (
      <>
        <DashboardHelpSection title="Seasons vs drop-ins">
          <p style={bodyText}>
            <strong style={{ color: 'var(--text-primary)' }}>Seasons</strong> are for structured league play (teams, games,
            standings). For open pickup nights, use{' '}
            <Link href="/dashboard/dropin" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              Drop-ins
            </Link>
            .
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Creating a season">
          <p style={bodyText}>
            Set dates, mark one season as active, and choose when online sign-up opens (immediately, on a schedule, or a custom
            date).
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="By plan">
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Basic</strong> — 1 active season
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Pro</strong> — up to 3 active seasons
            </li>
            <li>
              <strong style={{ color: 'var(--text-primary)' }}>Enterprise</strong> — unlimited seasons
            </li>
          </ul>
        </DashboardHelpSection>
      </>
    ),
  },
  teams: {
    title: 'Teams guide',
    subtitle: 'Rosters, colors, and public team pages.',
    titleId: 'help-teams-title',
    body: (
      <>
        <DashboardHelpSection title="Teams live in seasons">
          <p style={bodyText}>
            Each team belongs to a season. Create a season first, then add teams (or use quick-create for several at once).
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Public team pages">
          <p style={bodyText}>
            Fans see Overview, Schedule, Stats, and more. From a team&apos;s public page, use <strong>Manage team</strong> for
            logo, news, stream links, and jersey polls.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Jersey polls" badge="Pro">
          <p style={bodyText}>
            On <strong>Pro</strong> or <strong>Enterprise</strong>, open a poll so players pick jersey numbers on the public
            team page. <strong>First save wins</strong> on each number. Use the <strong>Jersey polls</strong> tab here or{' '}
            <strong>Manage team → Logo &amp; poll</strong>.
          </p>
        </DashboardHelpSection>
      </>
    ),
  },
  players: {
    title: 'Players guide',
    subtitle: 'Your league roster in one place.',
    titleId: 'help-players-title',
    body: (
      <>
        <DashboardHelpSection title="Managing players">
          <p style={bodyText}>
            Search and filter by season or team. Assign players to teams, update contact info, and remove players who left the
            league.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Game reminder emails" badge="Pro">
          <p style={bodyText}>
            On <strong>Pro</strong> or <strong>Enterprise</strong>, turn on reminders in{' '}
            <Link href="/dashboard/settings?tab=league" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              Settings
            </Link>
            , then opt individual players in or out from this list (players need an email on file).
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Jersey polls" badge="Pro">
          <p style={bodyText}>
            Jersey number polls are opened from{' '}
            <Link href="/dashboard/teams" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              Teams
            </Link>{' '}
            or each team&apos;s public <strong>Manage team</strong> panel. Players vote while signed in on the team page.
          </p>
        </DashboardHelpSection>
      </>
    ),
  },
  games: {
    title: 'Games guide',
    subtitle: 'Schedule league games and run drop-in nights.',
    titleId: 'help-games-title',
    body: (
      <>
        <DashboardHelpSection title="Two tabs">
          <p style={bodyText}>
            <strong style={{ color: 'var(--text-primary)' }}>League games</strong> — season matchups with home/away teams,
            scoring, and standings. <strong style={{ color: 'var(--text-primary)' }}>Drop-in sessions</strong> — quick access
            to pickup sessions (full tools are under{' '}
            <Link href="/dashboard/dropin" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              Drop-ins
            </Link>
            ).
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="On game day">
          <p style={bodyText}>
            Open a game to enter scores and player stats. Tap a game in the list to open <strong>Live scoring</strong>. Live
            games can show on your public <strong>Stream</strong> tab when you&apos;re on Pro or Enterprise.
          </p>
        </DashboardHelpSection>
      </>
    ),
  },
  'live-scoring': {
    title: 'Live scoring guide',
    subtitle: 'Record stats and the scoreboard during a game.',
    titleId: 'help-live-scoring-title',
    body: (
      <>
        <DashboardHelpSection title="Before the game">
          <p style={bodyText}>
            Set the five <strong>on-court</strong> players for each team (tap a slot to pick a jersey, or use{' '}
            <strong>Fill first 5</strong>). Only players in those slots count for quick stat taps and for{' '}
            <strong>minutes played</strong>.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Recording stats">
          <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>
              Tap a stat button (<strong>2PT</strong>, <strong>3PT</strong>, <strong>AST</strong>, etc.) at the bottom
            </li>
            <li>Tap the jersey number of the player on court</li>
            <li>
              Points on the scoreboard update automatically from made baskets and free throws
            </li>
          </ol>
          <p style={{ ...bodyText, marginTop: '10px' }}>
            Use <strong>Undo</strong> if you tapped the wrong player or stat.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Substitutions">
          <p style={bodyText}>
            Under <strong>BENCH</strong>, tap the incoming player&apos;s jersey, then tap the on-court number they replace.
            Substitutions are saved with the current quarter and clock so minutes stay accurate.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Quarter & clock">
          <p style={bodyText}>
            Set the quarter (Q1–Q4) and game clock. <strong>Start</strong> runs the timer; <strong>Pause</strong> stops it and
            syncs immediately. The clock and score update your public fan page while the game is live.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Minutes played">
          <p style={bodyText}>
            Minutes accrue for whoever is in the five on-court slots while the clock is running. Keep the clock and subs
            accurate for the best box score.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="End game">
          <p style={bodyText}>
            Tap <strong>End Game</strong> when you&apos;re done. You can open <strong>Game highlights</strong> afterward. Copy the{' '}
            <strong>Public watch link</strong> at the bottom so fans can follow on your league Stream tab.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Fans watching" badge="Pro">
          <p style={bodyText}>
            On <strong>Pro</strong> or <strong>Enterprise</strong>, fans see live scores and the full box score on your league&apos;s{' '}
            <strong>Stream</strong> tab (plus video if you added a stream URL). Set minutes per quarter under{' '}
            <Link href="/dashboard/games" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              Games
            </Link>{' '}
            if your league uses something other than 10-minute quarters.
          </p>
        </DashboardHelpSection>
      </>
    ),
  },
  stats: {
    title: 'Stats guide',
    subtitle: 'Leaders and box scores after games are played.',
    titleId: 'help-stats-title',
    body: (
      <>
        <DashboardHelpSection title="Games vs Stats">
          <p style={bodyText}>
            <strong style={{ color: 'var(--text-primary)' }}>Games</strong> is for scheduling and entering results.{' '}
            <strong style={{ color: 'var(--text-primary)' }}>Stats</strong> is for reviewing what happened — season leaders and
            per-game box scores.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Getting data in">
          <p style={bodyText}>
            Stats populate when you score games from the Games tab. Pick a season to see leaders; open a game for full box
            score detail.
          </p>
        </DashboardHelpSection>
      </>
    ),
  },
  'league-site': {
    title: 'League website guide',
    subtitle: 'Your public home for fans and players.',
    titleId: 'help-league-site-title',
    body: (
      <>
        <DashboardHelpSection title="Public league page">
          <p style={bodyText}>
            Fans see schedule, standings, teams, news, and (on Pro or Enterprise) live stream tools. Copy your public URL here
            or open <strong>Edit website</strong> to change layout and content on the live page.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Website editors">
          <p style={bodyText}>
            Invite helpers who can edit the public site without full dashboard access. They sign in and use{' '}
            <strong>Edit website</strong> on your league page.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Custom domain" badge="Pro">
          <p style={bodyText}>
            On <strong>Pro</strong> or <strong>Enterprise</strong>, connect your own domain in Settings so fans visit your
            brand, not only the default MyLeaguePortal link.
          </p>
        </DashboardHelpSection>
      </>
    ),
  },
  settings: {
    title: 'Settings guide',
    subtitle: 'League profile, plan, branding, and legal.',
    titleId: 'help-settings-title',
    body: (
      <>
        <DashboardHelpSection title="Plan">
          <p style={bodyText}>
            View your plan, upgrade to Pro or Enterprise, or open the billing portal. Some leagues have complimentary access
            with no Stripe charge.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="League & appearance">
          <p style={bodyText}>
            League name, timezone, registration links, logo, theme, and optional news banner (Pro or Enterprise). Brand colors
            have per-plan limits.
          </p>
        </DashboardHelpSection>
        <DashboardHelpSection title="Custom domain & waivers">
          <p style={bodyText}>
            Connect a custom fan-site hostname (Pro or Enterprise). Upload waiver PDFs used during player registration and
            drop-in sign-up.
          </p>
        </DashboardHelpSection>
      </>
    ),
  },
}
