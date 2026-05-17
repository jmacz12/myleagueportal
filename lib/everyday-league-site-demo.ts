/**
 * Showcase payload for public league home (Home / News / About tabs).
 * Used by `POST /api/dev/seed-teams-players` and `scripts/push-league-site-demo.ts`.
 *
 * Local art: `public/league-demo/vancouvarites/` — plus remote placeholder images for sponsor-style variety.
 */

export const EVERYDAY_LEAGUE_DEMO_IMG = '/league-demo/vancouvarites'

/** High-quality placeholder (no API key) — stable seed = same image every load. */
const PL = (seed: string, w: number, h: number) => `https://picsum.photos/seed/${seed}/${w}/${h}`

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

/** Plain object matching `league_site_content` draft/published JSON (parsed by `parseLeagueSitePayload` on read). Max 24 sections. */
export function everydayLeagueSiteDemoPayload() {
  const img = EVERYDAY_LEAGUE_DEMO_IMG
  return {
    heroBackgroundUrl: `${img}/vv-hero-arena.png`,
    heroTagline:
      'Premier adult basketball in Vancouver — broadcast-ready stats, team pages sponsors love, and a league home that looks as serious as the play on the floor.',
    heroInitials: 'VV',
    publicFontKey: 'dm-sans',
    sections: [
      // —— Home tab (content / button block / section break only) — 8 blocks ——
      {
        id: 'demo-home-hero-story',
        type: 'content',
        surface: 'home',
        title: 'Welcome to the Vancouvarites',
        body:
          'We are an **18-team** winter league with **two divisions**, certified scorekeepers, and a digital home fans actually use.\n\nWhether you are here to **register**, follow **standings**, or explore **partner opportunities**, this page is the single source of truth — no PDFs lost in group chat.',
        image: everydayLeagueContentImage(`${img}/vv-home-spotlight.png`, 440),
        textPieces: [],
      },
      {
        id: 'demo-home-div-season',
        type: 'divider',
        surface: 'home',
        variant: 'line',
        label: '2026 winter session',
      },
      {
        id: 'demo-home-cta-register',
        type: 'cta',
        surface: 'home',
        title: 'Join the next session',
        body:
          'Online registration is open through the league portal. Captains: roster caps apply — add alternates early so we can balance divisions before week three.',
        buttonLabel: 'Open season registration',
        buttonHref: '/join/vancouvarites/register',
      },
      {
        id: 'demo-home-midseason',
        type: 'content',
        surface: 'home',
        title: 'Game nights that feel like an event',
        body:
          '**Two 20-minute halves**, running clock until the final two minutes of each half. **Pro-style score table** on the Stream tab when your game is live — friends and family watch from anywhere.\n\nPost-game, captains get a **PDF-free** recap link they can forward to sponsors.',
        image: everydayLeagueContentImage(PL('vvhome-courtenergy', 1200, 700), 400),
        textPieces: [],
      },
      {
        id: 'demo-home-div-space',
        type: 'divider',
        surface: 'home',
        variant: 'space',
        label: '',
      },
      {
        id: 'demo-home-cta-sponsor',
        type: 'cta',
        surface: 'home',
        title: 'Partner with a league people follow',
        body:
          'Logo placement on team pages, shout-outs on stream nights, and a **digital sponsor row** on this league home. We send a simple one-pager — no long contracts for local businesses.',
        buttonLabel: 'Request sponsor kit',
        buttonHref: 'mailto:sponsors@example.com?subject=Vancouvarites%20sponsorship',
      },
      {
        id: 'demo-home-partner-visual',
        type: 'content',
        surface: 'home',
        title: 'Proud to spotlight our community partners',
        body:
          'From **physio** to **pizza after overtime**, our partners keep fees reasonable and the gym lights on. Scroll the **About** tab for the full partner gallery.',
        image: everydayLeagueContentImage(PL('vvpartner-wall', 1400, 780), 360),
        textPieces: [],
      },
      {
        id: 'demo-home-cta-store',
        type: 'cta',
        surface: 'home',
        title: 'League apparel — ships in Canada',
        body:
          'Replica warm-ups and fan tees ship from our print partner. A portion supports the **youth night** fund at the end of the season.',
        buttonLabel: 'Browse league store',
        buttonHref: 'https://example.com/vancouvarites-gear',
      },

      // —— News tab — 8 blocks ——
      {
        id: 'demo-news-schedule',
        type: 'news',
        title: 'Schedule release — division realignment for February',
        mediaLayout: 'right',
        body:
          '**Division A** picks up two cross-town matchups previously listed as TBD. **Division B** start times on **Thursday Feb 6** shift **15 minutes later** so we clear youth programming — same venue, new tip windows on your calendar export.\n\nPlayoff seeding locks **Feb 23**. Tie-breakers: head-to-head, then point differential.',
        items: [
          {
            url: `${img}/vv-gallery-action.png`,
            kind: 'image',
            caption: 'Division A — week 6',
          },
          {
            url: `${img}/vv-gallery-crowd.png`,
            kind: 'image',
            caption: 'Sideline energy, commercial shoot',
          },
        ],
      },
      {
        id: 'demo-news-power',
        type: 'news',
        title: 'Power rankings — who is controlling the paint?',
        mediaLayout: 'below',
        body:
          '1) **False Creek Forge** — best defensive rating in the league. 2) **Kitsilano Knights** — top offensive efficiency when their full roster travels. 3) **Riley Park Rebels** — clutch free-throw crew in one-possession games.\n\nAgree? Disagree? Tag us when you share the standings screenshot.',
        items: [
          {
            url: PL('vvnews-rankings', 900, 560),
            kind: 'image',
            caption: 'Graphic: efficiency leaders (sample)',
          },
        ],
      },
      {
        id: 'demo-news-commissioner',
        type: 'content',
        surface: 'news',
        title: 'From the commissioner’s desk',
        body:
          'Thank you for the **99% on-time starts** last month — that is a culture thing, and it matters for our **broadcast volunteers**.\n\nReminder: **zero tolerance** for verbal abuse of officials. One automatic suspension template is live in the handbook link on **About**.',
        image: everydayLeagueContentImage(`${img}/vv-news-playoffs.png`, 340),
        textPieces: [],
      },
      {
        id: 'demo-news-div',
        type: 'divider',
        surface: 'news',
        variant: 'line',
        label: 'League updates',
      },
      {
        id: 'demo-news-safety',
        type: 'news',
        title: 'Facility & safety — concussion protocol refresh',
        mediaLayout: 'left',
        body:
          'We adopted the **2026 community league concussion checklist** — captains must confirm they have read it before playoffs. AED location maps are posted at **both** gym entrances.\n\nIce is available in the trainer room — please do not block the hallway during turnover between games.',
        items: [
          {
            url: `${img}/vv-about-detail.png`,
            kind: 'image',
            caption: 'Trainer room — first aid + ice',
          },
        ],
      },
      {
        id: 'demo-news-cta-media',
        type: 'cta',
        surface: 'news',
        title: 'Got a highlight clip?',
        body:
          'We feature **fan-submitted photos** on this page and in the year-end reel. Send a link or file — include team name and date in the subject line.',
        buttonLabel: 'Email league media',
        buttonHref: 'mailto:media@example.com?subject=Highlight%20submission',
      },
      {
        id: 'demo-news-sponsors',
        type: 'news',
        title: 'Thank you to our 2026 court-side partners',
        mediaLayout: 'behind',
        body:
          '**Coast Physio** — recovery lounge passes for playoff teams. **Main St Pizza** — post-game slices on rivalry nights. **Harbour Insurance** — liability coverage education night (free for captains).\n\nAsk us about **mid-season** sponsor additions — we still have **two** digital slots on team pages.',
        items: [
          {
            url: PL('vvsponsor-hero', 1200, 720),
            kind: 'image',
            caption: 'Partner night — sample visual',
          },
        ],
      },
      {
        id: 'demo-news-allstar',
        type: 'news',
        title: 'All-Star Saturday — save the date',
        mediaLayout: 'below',
        body:
          '**March 15** — skills challenge, three-point contest, and a **legends** half-court game with alumni refs. Tickets are donation-based; proceeds fund **youth clinic** scholarships.\n\nNominate players via your captain by **March 1** — one nominee per team per event.',
        items: [],
      },

      // —— About tab — 8 blocks ——
      {
        id: 'demo-about-mission-text',
        type: 'text',
        title: 'Mission & values',
        body:
          'Vancouvarites exists to run **competitive, respectful, well-organized** adult basketball in Vancouver.\n\nWe believe in **transparent scheduling**, **accessible stats**, and **local partnerships** that keep registration costs fair. We are volunteer-led with professional standards.',
      },
      {
        id: 'demo-about-gallery',
        type: 'media',
        title: 'Through the years — community moments',
        mediaLayout: 'below',
        items: [
          {
            url: `${img}/vv-hero-arena.png`,
            kind: 'image',
            caption: 'Opening night — 2019',
          },
          {
            url: `${img}/vv-gallery-crowd.png`,
            kind: 'image',
            caption: 'Playoffs — standing room',
          },
          {
            url: PL('vvabout-archive', 1000, 660),
            kind: 'image',
            caption: 'Championship weekend — sample archive',
          },
          {
            url: `${img}/vv-home-spotlight.png`,
            kind: 'image',
            caption: 'Team captains summit',
          },
        ],
      },
      {
        id: 'demo-about-values-canvas',
        type: 'content',
        surface: 'about',
        title: 'How we govern the league',
        body:
          '**Elected board** (3-year terms) · **Finance committee** publishes a quarterly summary · **Competition committee** handles protests within **48 hours**.\n\nWe use this website for **all** official announcements — if it is not here, it is not binding.',
        image: everydayLeagueContentImage(PL('vvabout-governance', 1100, 640), 320),
        textPieces: [],
      },
      {
        id: 'demo-about-div-partners',
        type: 'divider',
        surface: 'about',
        variant: 'line',
        label: 'Partner gallery',
      },
      {
        id: 'demo-about-sponsor-logos',
        type: 'media',
        title: 'Sponsor logos — digital placements',
        mediaLayout: 'below',
        items: [
          { url: PL('vvlogo-s1', 320, 160), kind: 'image', caption: 'Coast Physio — gold' },
          { url: PL('vvlogo-s2', 320, 160), kind: 'image', caption: 'Main St Pizza — silver' },
          { url: PL('vvlogo-s3', 320, 160), kind: 'image', caption: 'Harbour Insurance — silver' },
          { url: PL('vvlogo-s4', 320, 160), kind: 'image', caption: 'North Shore Coffee — bronze' },
        ],
      },
      {
        id: 'demo-about-conduct',
        type: 'text',
        title: 'Code of conduct (summary)',
        body:
          '**Respect** opponents, officials, staff, and fans. **No harassment** online or in person. **Uniform compliance** — home team wears light unless otherwise posted.\n\nViolations are reviewed by the board; sanctions may include **suspension** or **expulsion** without refund in egregious cases.',
      },
      {
        id: 'demo-about-cta-volunteer',
        type: 'cta',
        surface: 'about',
        title: 'Volunteer with us',
        body:
          'We need **score table** and **shot clock** operators for playoff weekends. Training is one evening — we feed you pizza and list you in the program as **League Crew**.',
        buttonLabel: 'Email volunteer lead',
        buttonHref: 'mailto:volunteers@example.com?subject=Playoff%20volunteer',
      },
      {
        id: 'demo-about-alumni',
        type: 'content',
        surface: 'about',
        title: 'Alumni night & youth clinic',
        body:
          'Each season closes with an **alumni scrimmage** and a **free youth clinic** for neighbourhood kids. Sponsors fund equipment — if your company wants naming rights for the clinic, reach out via the **sponsor kit** button on Home.',
        image: everydayLeagueContentImage(`${img}/vv-gallery-action.png`, 380),
        textPieces: [],
      },
    ],
  }
}
