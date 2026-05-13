/**
 * Demo payload for public league home (Home / News / About tabs).
 * Used by `POST /api/dev/seed-teams-players` and `scripts/push-league-site-demo.ts`.
 *
 * Art lives in `public/league-demo/vancouvarites/` — casual community gym vibe, not a broadcast package.
 */

export const EVERYDAY_LEAGUE_DEMO_IMG = '/league-demo/vancouvarites'

export function everydayLeagueContentImage(url: string, maxHeightPx = 420) {
  return {
    url,
    objectPositionX: 50,
    objectPositionY: 46,
    widthPct: 100,
    maxHeightPx,
    rotateDeg: 0,
    scale: 1,
    borderRadiusPx: 14,
    offsetX: 0,
    offsetY: 0,
  }
}

/** Plain object matching `league_site_content` draft/published JSON (parsed by `parseLeagueSitePayload` on read). */
export function everydayLeagueSiteDemoPayload() {
  const img = EVERYDAY_LEAGUE_DEMO_IMG
  return {
    heroBackgroundUrl: `${img}/vv-hero-arena.png`,
    heroTagline:
      'Weeknight runs, same community gym we’ve rented for years, and a group chat that never agrees on where to eat after.',
    heroInitials: 'VV',
    sections: [
      {
        id: 'demo-news-schedule',
        type: 'news',
        title: 'Schedule note — one Tuesday flip in March',
        mediaLayout: 'right',
        body:
          '**Court B** is booked for a school tournament on **March 11**, so our usual Tuesday slate moves to **Wednesday March 12** at the same times. If that wrecks your carpool, ping your captain and we’ll try to nudge a slot — no promises, the sheet is pretty full.\n\nPlayoff dates are still **TBD** until we know how many teams finish the regular season. We’ll vote on it at the pizza meeting.',
        items: [
          {
            url: `${img}/vv-gallery-crowd.png`,
            kind: 'image',
            caption: 'Crowd shot from last winter — thanks for the photos, Morgan',
          },
          {
            url: `${img}/vv-gallery-action.png`,
            kind: 'image',
            caption: 'Nothing fancy, just people playing hard',
          },
        ],
      },
      {
        id: 'demo-news-jerseys',
        type: 'news',
        title: 'Jerseys — bring both colours, please',
        mediaLayout: 'below',
        body:
          'We’re not the NBA; we share floors with yoga on Thursdays. **Light and dark tops** every game — if both teams show up in navy again, home team flips to white per the sheet on the fridge in the office.\n\nIf you ordered a league shirt two years ago and it still fits, you’re winning.',
        items: [
          {
            url: `${img}/vv-about-detail.png`,
            kind: 'image',
            caption: 'Ball on the floor we actually mop sometimes',
          },
        ],
      },
      {
        id: 'demo-news-organizer',
        type: 'content',
        surface: 'news',
        title: 'From the person who prints the schedule',
        body:
          'Hi — I’m the one who texts when the gym code changes. If something looks wrong on the site, tell me and I’ll fix it when I’m off work. Scores sometimes go in late because we’re all volunteers; nobody’s getting fired.\n\nThanks for filling out waivers without being asked twice.',
        image: everydayLeagueContentImage(`${img}/vv-home-spotlight.png`, 360),
        textPieces: [],
      },
      {
        id: 'demo-news-potluck',
        type: 'news',
        title: 'End-of-season potluck — sign up in the hallway',
        mediaLayout: 'below',
        body:
          'Last year someone brought a Costco sheet cake and we’re still talking about it. **April date TBD** once we know who’s in the final. Vegetarian option appreciated; nut allergy on the Drive team — label if you can.\n\nKids welcome; there’s usually a half-court shootaround in the corner.',
        items: [],
      },
      {
        id: 'demo-home-welcome',
        type: 'content',
        surface: 'home',
        title: 'Welcome — you found the right gym',
        body:
          'Vancouvarites is a **regular adult rec league**: friends-of-friends, a bit of chirping, refs who have day jobs, and games that mostly start on time.\n\nUse the tabs up top — **Schedule** for games and drop-ins, **Teams** for rosters, **News** for boring-but-useful updates. **About** is the long version if you’re new or bringing a sub.',
        image: everydayLeagueContentImage(`${img}/vv-hero-arena.png`, 400),
        textPieces: [],
      },
      {
        id: 'demo-home-howto',
        type: 'content',
        surface: 'home',
        title: 'Quick links that save a text thread',
        body:
          '**Season signup** and **drop-ins** live under Join — same league, just the pages where you actually click buttons.\n\nTeam pages have **Stream** links when captains remember to paste the YouTube URL. If it’s broken, it’s not on purpose.',
        image: everydayLeagueContentImage(`${img}/vv-gallery-crowd.png`, 340),
        textPieces: [],
      },
      {
        id: 'demo-text-heritage',
        type: 'text',
        title: 'How this league started',
        body:
          'Back in **2014** a handful of us couldn’t get court time anywhere else, so we begged a community centre for a Tuesday slot and split the rental. Word spread, divisions got bigger, and now we’re… still splitting the rental, just with spreadsheets.\n\nWe’re **not** a big organization — a few volunteers, one part-time scheduler, and a lot of patience from our partners who know we’ll be home late on game nights.',
      },
      {
        id: 'demo-text-gamenight',
        type: 'text',
        title: 'What game night actually looks like',
        body:
          'Arrive a little early if you can — parking is tight and the good benches go fast. We run **two halves**, clock stops on fouls in the last two minutes of each half because someone always asks.\n\n**Subs** on whistles; try not to yell at the refs, they’re someone’s coworker. Overtime happens sometimes; if we’re past 10pm we might flip a coin because the custodian has keys.',
      },
      {
        id: 'demo-about-values',
        type: 'content',
        surface: 'about',
        title: 'House rules, the short version',
        body:
          'Play hard, don’t be a jerk, clean up your bottles. We’re here to sweat, laugh, and not need ice baths on Wednesday morning. If you’re new, introduce yourself — we were all the person who didn’t know the gym code once.',
        image: everydayLeagueContentImage(`${img}/vv-news-playoffs.png`, 300),
        textPieces: [],
      },
      {
        id: 'demo-sec-media',
        type: 'media',
        title: 'Photos people actually sent us',
        mediaLayout: 'below',
        items: [
          {
            url: `${img}/vv-hero-arena.png`,
            kind: 'image',
            caption: 'Our gym — same lines, new tape when we remember',
          },
          {
            url: `${img}/vv-home-spotlight.png`,
            kind: 'image',
            caption: 'Hallway energy before tip',
          },
          {
            url: `${img}/vv-news-playoffs.png`,
            kind: 'image',
            caption: 'End-of-season chaos (the fun kind)',
          },
          {
            url: `${img}/vv-gallery-action.png`,
            kind: 'image',
            caption: 'Someone’s cousin took this one — pretty good',
          },
          {
            url: `${img}/vv-gallery-crowd.png`,
            kind: 'image',
            caption: 'Friends on the sideline',
          },
          {
            url: `${img}/vv-about-detail.png`,
            kind: 'image',
            caption: 'We only have two game balls; please don’t kick them',
          },
        ],
      },
    ],
  }
}
