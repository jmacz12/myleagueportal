import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SEED_PREFIX = '[SEED]'

/** Rich TEXT / NEWS / media demo — reads like an established Vancouver league. */
function richDemoLeagueSiteJson() {
  return {
    heroBackgroundUrl:
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1920&q=80',
    heroTagline:
      'Compete weekly on Vancouver hardwood—rosters, rivalries, and pickup runs in one league home.',
    heroInitials: 'VV',
    sections: [
      {
        id: 'demo-text-heritage',
        type: 'text',
        title: 'Twelve years on the hardwood',
        body:
          'Since 2014, Vancouvarites has been the after-work home for players who still hear sneakers squeak in their sleep. We grew from a Tuesday night run at a community gym to a full divisional league with certified officials, digital stats for organizers, and a crowd that knows when to foul tactically and when to let the rookie shoot.\n\nOur mission never changed: competitive basketball that respects jobs, families, and knees. Every season we rebalance divisions, run captains’ meetings, and keep a standing sportsmanship rule — play hard, argue the call once, then sprint back on defense.',
      },
      {
        id: 'demo-news-winter',
        type: 'news',
        title: 'Winter 2026 — Power rankings & playoff picture',
        body:
          'Power rankings update every Tuesday after scores are locked. Playoff seeds freeze on March 1 — tiebreakers are head-to-head, then point differential within the division. The championship weekend is booked for April 4–5; higher seeds get choice of bench side.\n\nJersey compliance: single-colour tops must match your roster photo by Week 6. Spirit wear is welcome on Fan Night (Feb 14) where we also collect donations for local youth clinics.',
      },
      {
        id: 'demo-text-culture',
        type: 'text',
        title: 'How we run game night',
        body:
          'Doors open 30 minutes before tip. Captains exchange lineup cards at the scorer’s table; clocks start on the jump regardless of late arrivals. We run 12-minute stop-clock halves with team fouls resetting each half.\n\nSubstitutions are horn-request on dead balls. Overtime is 3 minutes sudden death until a winner is declared — we’ve had triple-OT classics twice in league history, both decided by a corner three you’ll pretend you meant to take.',
      },
      {
        id: 'demo-news-alumni',
        type: 'news',
        title: 'Alumni weekend & hall-of-fame banners',
        body:
          'Mark your calendar: Alumni Weekend returns March 21–22 with Saturday pickup drafts and a Sunday brunch awards brunch at the east-side courtside cafe. We’ll unveil two new rafter banners — long-time scorer Jamie Okonkwo and organizer-volunteer Priya Nandakumar — plus a surprise highlight reel pulled from years of cell-phone clips.\n\nIf you played in our 2017–2019 era, we still have your grainy footage. Email the league inbox if you want it buried forever.',
      },
      {
        id: 'demo-sec-media',
        type: 'media',
        title: 'Around the league',
        items: [
          {
            url: 'https://images.unsplash.com/photo-1519861537823-943991f648fd?auto=format&fit=crop&w=800&q=80',
            kind: 'image',
            caption: 'Tip-off energy — Winter ’24 finals',
          },
          {
            url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80',
            kind: 'image',
            caption: 'Packed gym on rivalry night',
          },
          {
            url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80',
            kind: 'image',
            caption: 'Baseline attack vs zone',
          },
          {
            url: 'https://images.unsplash.com/photo-1515523110820-721ae40296e9?auto=format&fit=crop&w=800&q=80',
            kind: 'image',
            caption: 'Team huddle — overtime prep',
          },
        ],
      },
    ],
  }
}

const PORTAL_TEAM_NAMES = [
  `${SEED_PREFIX} Kitsilano Knights`,
  `${SEED_PREFIX} Main St Motion`,
  `${SEED_PREFIX} False Creek Forge`,
  `${SEED_PREFIX} Commercial Drive`,
  `${SEED_PREFIX} Riley Park Rebels`,
  `${SEED_PREFIX} Trout Lake Tempo`,
  `${SEED_PREFIX} Cambie Crossover`,
  `${SEED_PREFIX} Fraserhood Flight`,
]

const PORTAL_TEAM_COLORS = ['#b91c1c', '#1d4ed8', '#0d9488', '#ca8a04', '#7c3aed', '#db2777', '#ea580c', '#4d7c0f']

/** Total 25 players across 8 teams */
const PLAYERS_PER_TEAM = [4, 4, 3, 3, 3, 3, 3, 2]

const FIRST_NAMES = [
  'Alex',
  'Jordan',
  'Sam',
  'Riley',
  'Casey',
  'Taylor',
  'Morgan',
  'Jamie',
  'Quinn',
  'Avery',
  'Drew',
  'Blake',
  'Cameron',
  'Skyler',
  'Logan',
  'Emerson',
  'Reese',
  'Finley',
  'Hayden',
  'Parker',
  'Rowan',
  'Sydney',
  'Marley',
  'Tatum',
  'Shannon',
]

const LAST_NAMES = [
  'Nguyen',
  'Patel',
  'Okonkwo',
  'Caruso',
  'Singh',
  'Martinez',
  'Okafor',
  'Kim',
  'Brooks',
  'Reid',
  'Cho',
  'Silva',
  'Tan',
  'Youssef',
  'Park',
  'Andersen',
  'Liu',
  'Walsh',
  'Ahmed',
  'Costa',
  'Ng',
  'Petrov',
  'Grant',
  'Ellis',
  'Morales',
]

async function deleteSeedDropinsForOrg(organizationId: string) {
  const { data: seedSessions } = await supabaseAdmin
    .from('dropin_sessions')
    .select('id')
    .eq('organization_id', organizationId)
    .like('name', `${SEED_PREFIX}%`)

  const ids = (seedSessions || []).map((s) => s.id).filter(Boolean)
  if (ids.length === 0) return
  await supabaseAdmin.from('dropin_registrations').delete().in('session_id', ids)
  await supabaseAdmin.from('dropin_sessions').delete().in('id', ids)
}

/**
 * Development only: seed teams/players and optional rich league site + portal demo.
 *
 *   curl -X POST http://localhost:3000/api/dev/seed-teams-players \
 *     -H "Content-Type: application/json" \
 *     -d "{\"slug\":\"vancouvarites\",\"replace\":true,\"fullPortalDemo\":true}"
 *
 * `fullPortalDemo`: max **8** seed teams, **25** total roster players, season registration window opened,
 * **[SEED]** drop-in sessions with sample registrations, and rich TEXT/NEWS league home content.
 * Implies league site demo content (same as `withLeagueSiteDemo`).
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  let slug = ''
  let replace = false
  let withLeagueSiteDemo = false
  let fullPortalDemo = false
  try {
    const body = await req.json()
    slug = typeof body.slug === 'string' ? body.slug : ''
    replace = body.replace === true
    withLeagueSiteDemo = body.withLeagueSiteDemo === true
    fullPortalDemo = body.fullPortalDemo === true
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (fullPortalDemo) {
    withLeagueSiteDemo = true
  }

  if (!slug.trim()) {
    return NextResponse.json(
      { error: 'Body must include { "slug": "your-league-slug", ... }' },
      { status: 400 }
    )
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug.trim())
    .single()

  if (orgErr || !org) {
    return NextResponse.json(
      {
        error: `No organization with slug "${slug.trim()}". Copy the slug from Dashboard → Settings.`,
      },
      { status: 404 }
    )
  }

  if (fullPortalDemo && !replace) {
    const { count } = await supabaseAdmin
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .like('name', `${SEED_PREFIX}%`)
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            '[SEED] demo teams already exist for this org. Re-run with replace: true to wipe prior seed teams/players and refresh the portal demo.',
        },
        { status: 400 }
      )
    }
  }

  if (replace) {
    const { data: seedTeams } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('organization_id', org.id)
      .like('name', `${SEED_PREFIX}%`)

    const seedTeamIds = (seedTeams || []).map((t) => t.id)
    if (seedTeamIds.length > 0) {
      await supabaseAdmin.from('players').delete().in('team_id', seedTeamIds)
      await supabaseAdmin.from('teams').delete().in('id', seedTeamIds)
    }
  }

  if (fullPortalDemo) {
    await deleteSeedDropinsForOrg(org.id)
  }

  let seasonId: string | null = null

  const { data: activeSeason } = await supabaseAdmin
    .from('seasons')
    .select('id')
    .eq('organization_id', org.id)
    .eq('type', 'season')
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeSeason?.id) {
    seasonId = activeSeason.id
  } else {
    const { data: anySeason } = await supabaseAdmin
      .from('seasons')
      .select('id')
      .eq('organization_id', org.id)
      .eq('type', 'season')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (anySeason?.id) {
      seasonId = anySeason.id
    }
  }

  if (!seasonId) {
    const start = new Date()
    const end = new Date()
    end.setMonth(end.getMonth() + 5)

    let insertRow: Record<string, unknown> = {
      name: `${SEED_PREFIX} Demo season`,
      type: 'season',
      organization_id: org.id,
      is_active: true,
      allow_online_registration: false,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    }

    let { data: newSeason, error: seasonErr } = await supabaseAdmin
      .from('seasons')
      .insert(insertRow)
      .select('id')
      .single()

    if (seasonErr && String(seasonErr.message || '').includes('allow_online_registration')) {
      delete insertRow.allow_online_registration
      const retry = await supabaseAdmin.from('seasons').insert(insertRow).select('id').single()
      newSeason = retry.data
      seasonErr = retry.error
    }

    if (seasonErr || !newSeason) {
      return NextResponse.json(
        {
          error:
            seasonErr?.message ||
            'Could not create a demo season. Add a competitive season in Dashboard → Seasons, then run again.',
        },
        { status: 500 }
      )
    }
    seasonId = newSeason.id
  }

  const stamp = `${Date.now()}`

  if (fullPortalDemo && seasonId) {
    const opens = new Date(Date.now() - 72 * 3600 * 1000).toISOString()
    const closes = new Date(Date.now() + 160 * 24 * 3600 * 1000).toISOString()
    const up: Record<string, unknown> = {
      allow_online_registration: true,
      online_registration_opens_at: opens,
      online_registration_closes_at: closes,
    }
    const { error: regWinErr } = await supabaseAdmin.from('seasons').update(up).eq('id', seasonId)
    if (regWinErr && String(regWinErr.message || '').includes('online_registration')) {
      await supabaseAdmin.from('seasons').update({ allow_online_registration: true }).eq('id', seasonId)
    }
  }

  const teamsOut: { id: string; name: string }[] = []

  if (fullPortalDemo) {
    for (let t = 0; t < PORTAL_TEAM_NAMES.length; t++) {
      const { data: row, error } = await supabaseAdmin
        .from('teams')
        .insert({
          name: PORTAL_TEAM_NAMES[t],
          color: PORTAL_TEAM_COLORS[t % PORTAL_TEAM_COLORS.length],
          season_id: seasonId,
          organization_id: org.id,
        })
        .select('id')
        .single()
      if (error || !row) {
        return NextResponse.json({ error: error?.message || 'Failed to create seed team' }, { status: 500 })
      }
      teamsOut.push({ id: row.id, name: PORTAL_TEAM_NAMES[t] })
    }

    let playerIdx = 0
    const playerRows: Record<string, unknown>[] = []
    for (let ti = 0; ti < teamsOut.length; ti++) {
      const count = PLAYERS_PER_TEAM[ti] ?? 0
      for (let j = 0; j < count; j++) {
        const fn = FIRST_NAMES[playerIdx % FIRST_NAMES.length]
        const ln = LAST_NAMES[playerIdx % LAST_NAMES.length]
        const full_name = `${fn} ${ln}`
        const positions = [['Guard'], ['Forward'], ['Center']][playerIdx % 3]
        playerRows.push({
          full_name,
          email: `seed.portal.${stamp}.${playerIdx}@example.test`,
          phone: null,
          jersey_number: 10 + ((playerIdx * 3) % 55),
          positions,
          organization_id: org.id,
          season_id: seasonId,
          team_id: teamsOut[ti].id,
          status: 'active',
        })
        playerIdx++
      }
    }

    const { error: playersErr } = await supabaseAdmin.from('players').insert(playerRows)
    if (playersErr) {
      await supabaseAdmin.from('teams').delete().in(
        'id',
        teamsOut.map((x) => x.id)
      )
      return NextResponse.json({ error: playersErr.message }, { status: 500 })
    }

    const sessionSpecs = [
      { daysFromNow: 4, hour: 18, minute: 45, fee: 15, max: 18, label: 'East Van — Evening run' },
      { daysFromNow: 11, hour: 19, minute: 0, fee: 12, max: 20, label: 'Midweek pickup — division neutral' },
      { daysFromNow: 18, hour: 10, minute: 30, fee: 10, max: 22, label: 'Sunday morning shootaround' },
      { daysFromNow: 25, hour: 20, minute: 15, fee: 18, max: 16, label: 'Lights-out late slot' },
    ]

    const regSplit = [4, 5, 5, 5]
    let regNameIdx = 0

    for (let si = 0; si < sessionSpecs.length; si++) {
      const spec = sessionSpecs[si]
      const start = new Date()
      start.setDate(start.getDate() + spec.daysFromNow)
      start.setHours(spec.hour, spec.minute, 0, 0)

      const { data: sess, error: sesErr } = await supabaseAdmin
        .from('dropin_sessions')
        .insert({
          organization_id: org.id,
          name: `${SEED_PREFIX} ${spec.label}`,
          scheduled_at: start.toISOString(),
          max_players: spec.max,
          fee_amount: spec.fee,
          payment_method: 'cash_or_etransfer',
          etransfer_info: null,
          allow_signups: true,
          status: 'upcoming',
          signup_opens: 'immediately',
          signup_opens_days_before: null,
          signup_opens_at: null,
          is_recurring: false,
          recurring_frequency: null,
          recurring_until: null,
          location: '[SEED] Demo venue — safe to delete in Dashboard → Drop-ins',
        })
        .select('id')
        .single()

      if (sesErr || !sess) {
        console.warn('[seed] dropin session insert:', sesErr?.message)
        continue
      }

      const nReg = regSplit[si] ?? 3
      const batch = []
      for (let r = 0; r < nReg; r++) {
        const fn = FIRST_NAMES[regNameIdx % FIRST_NAMES.length]
        const ln = LAST_NAMES[(regNameIdx + 3) % LAST_NAMES.length]
        regNameIdx++
        batch.push({
          session_id: sess.id,
          organization_id: org.id,
          full_name: `${fn} ${ln}`,
          email: `seed.dropin.${stamp}.${si}.${r}@example.test`,
          positions: [],
          waiver_accepted: true,
          is_guest: false,
          checked_in: false,
          payment_status: 'unpaid',
        })
      }
      await supabaseAdmin.from('dropin_registrations').insert(batch)
    }
  } else {
    const redName = `${SEED_PREFIX} Red Hots`
    const blueName = `${SEED_PREFIX} Blue Notes`

    const { data: redTeam, error: redErr } = await supabaseAdmin
      .from('teams')
      .insert({
        name: redName,
        color: '#b91c1c',
        season_id: seasonId,
        organization_id: org.id,
      })
      .select('id')
      .single()

    if (redErr || !redTeam) {
      return NextResponse.json({ error: redErr?.message || 'Failed to create Red Hots team' }, { status: 500 })
    }

    const { data: blueTeam, error: blueErr } = await supabaseAdmin
      .from('teams')
      .insert({
        name: blueName,
        color: '#1d4ed8',
        season_id: seasonId,
        organization_id: org.id,
      })
      .select('id')
      .single()

    if (blueErr || !blueTeam) {
      await supabaseAdmin.from('teams').delete().eq('id', redTeam.id)
      return NextResponse.json({ error: blueErr?.message || 'Failed to create Blue Notes team' }, { status: 500 })
    }

    teamsOut.push({ id: redTeam.id, name: redName }, { id: blueTeam.id, name: blueName })

    const redRoster = [
      { full_name: 'Alex Carter', jersey_number: 7, positions: ['Guard'] as string[] },
      { full_name: 'Jordan Lee', jersey_number: 23, positions: ['Forward'] as string[] },
      { full_name: 'Sam Rivera', jersey_number: 11, positions: ['Center'] as string[] },
      { full_name: 'Casey Morgan', jersey_number: null, positions: ['Guard'] as string[] },
    ]

    const blueRoster = [
      { full_name: 'Riley Brooks', jersey_number: 3, positions: ['Guard'] as string[] },
      { full_name: 'Taylor Kim', jersey_number: 14, positions: ['Forward'] as string[] },
      { full_name: 'Morgan Patel', jersey_number: 21, positions: ['Forward'] as string[] },
    ]

    const redRows = redRoster.map((p, i) => ({
      full_name: p.full_name,
      email: `seed.red.${stamp}.${i}@example.test`,
      phone: null,
      jersey_number: p.jersey_number,
      positions: p.positions,
      organization_id: org.id,
      season_id: seasonId,
      team_id: redTeam.id,
      status: 'active',
    }))

    const blueRows = blueRoster.map((p, i) => ({
      full_name: p.full_name,
      email: `seed.blue.${stamp}.${i}@example.test`,
      phone: null,
      jersey_number: p.jersey_number,
      positions: p.positions,
      organization_id: org.id,
      season_id: seasonId,
      team_id: blueTeam.id,
      status: 'active',
    }))

    const { error: playersErr } = await supabaseAdmin.from('players').insert([...redRows, ...blueRows])

    if (playersErr) {
      await supabaseAdmin.from('teams').delete().in('id', [redTeam.id, blueTeam.id])
      return NextResponse.json({ error: playersErr.message }, { status: 500 })
    }
  }

  let leagueSiteDemo = false
  if (withLeagueSiteDemo) {
    const payload = richDemoLeagueSiteJson()
    const { error: siteErr } = await supabaseAdmin.from('league_site_content').upsert(
      {
        organization_id: org.id,
        draft: payload,
        published: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    )
    leagueSiteDemo = !siteErr
    if (siteErr) {
      console.warn('[seed-teams-players] league_site_content upsert:', siteErr.message)
    }
  }

  const teamHint = teamsOut.map((t) => t.name).join(', ')

  return NextResponse.json({
    ok: true,
    message: fullPortalDemo
      ? `Portal demo: ${teamsOut.length} teams (25 roster players max seed), season signup window opened, TEXT/NEWS league home, [SEED] drop-ins with registrations. Visit /league/${slug.trim()}, /join/${slug.trim()}, /join/${slug.trim()}/dropins. Delete [SEED] rows from dashboard when done.`
      : `Open /league/${slug.trim()} — seed teams: ${teamHint}. Remove later from Dashboard → Teams / Players if you like.`,
    season_id: seasonId,
    teams: teamsOut,
    league_site_demo: leagueSiteDemo,
    full_portal_demo: fullPortalDemo,
  })
}
