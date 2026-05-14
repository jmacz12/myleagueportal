/**
 * Shared visitor-facing copy for plan-gated **public** surfaces (league site, watch URL, team page).
 * Keep wording aligned so Basic / Pro / Enterprise feels consistent everywhere.
 */

/**
 * Compact badge next to a locked Stream tab (unlocks on **Pro** or **Enterprise**; see `isProOrEnterprise`).
 * Uses the same simple tier names as Settings and the roadmap — never “Pro+” here.
 */
export const PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE = 'Pro / Enterprise'

export const PUBLIC_LOCKED_PRO_ENTERPRISE_BADGE_TITLE =
  'Unlocks on Pro or Enterprise. Leagues on Basic still get schedule, teams, news, and join. Organizers: Dashboard → Settings to compare Basic, Pro, and Enterprise.'

/** Screen reader hint when a tab is plan-locked. */
export const PUBLIC_LOCKED_PRO_ENTERPRISE_ARIA = 'Pro or Enterprise'

/** Stream hub upsell (Basic plan): same block on league Stream tab, /league/[slug]/stream, team Stream tab. */
export const PUBLIC_STREAM_HUB_UPSELL = {
  cardTitle: 'Pro or Enterprise',
  intro:
    'On Pro or Enterprise, this tab is your public game-day hub: optional video plus a live box score that stays in sync with Dashboard → Games → scoring.',
  body:
    'Your league is on Basic — you still have schedule, teams, news, and join flows. Move up to Pro or Enterprise when you are ready for embedded streams and the full live stat tables visitors expect on game day.',
  organizerHint: 'Organizers: compare Basic, Pro, and Enterprise in Dashboard → Settings.',
} as const

/** First paragraph on `/league/[slug]/stream` when the league is on Basic (watch-only URL). */
export const PUBLIC_STREAM_WATCH_BASIC_INTRO =
  'This URL mirrors your league Stream tab. On Basic it stays locked; on Pro or Enterprise it shows the same optional video and live box score as the Stream tab.'
