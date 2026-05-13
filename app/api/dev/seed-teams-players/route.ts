import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { seedSeasonGamesWithStats } from '@/lib/dev-seed-season-games'
import { everydayLeagueSiteDemoPayload } from '@/lib/everyday-league-site-demo'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SEED_PREFIX = '[SEED]'

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

/** Professional demo depth: 10 players per team across 8 teams. */
const PLAYERS_PER_TEAM = [10, 10, 10, 10, 10, 10, 10, 10]

const POSITION_SETS = [
  ['Guard'],
  ['Forward'],
  ['Center'],
  ['Guard', 'Forward'],
  ['Forward', 'Center'],
  ['Guard', 'Center'],
]

/** Stable abstract marks per franchise (256²) — reads clean next to rostered players. */
const TEAM_LOGO_URLS = [
  'https://picsum.photos/seed/vvbrand-knights/256/256',
  'https://picsum.photos/seed/vvbrand-motion/256/256',
  'https://picsum.photos/seed/vvbrand-forge/256/256',
  'https://picsum.photos/seed/vvbrand-drive/256/256',
  'https://picsum.photos/seed/vvbrand-rebels/256/256',
  'https://picsum.photos/seed/vvbrand-tempo/256/256',
  'https://picsum.photos/seed/vvbrand-crossover/256/256',
  'https://picsum.photos/seed/vvbrand-flight/256/256',
]

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
 *     -d "{\"slug\":\"vancouvarites\",\"replace\":true,\"fullPortalDemo\":true,\"withGamesAndStats\":true,\"previewPublicTier\":\"enterprise\"}"
 *
 * `fullPortalDemo`: max **8** seed teams, **80** total roster players, season registration window opened,
 * **[SEED]** drop-in sessions with sample registrations, and rich TEXT/NEWS league home content.
 * Implies league site demo content (same as `withLeagueSiteDemo`).
 *
 * `withGamesAndStats`: after teams/players, inserts **final** round-robin `games` + `player_game_stats`
 * so `/league/[slug]/teams/[id]` shows record, rank, and stat columns (use `previewPublicTier` to preview Pro/Enterprise).
 *
 * `previewPublicTier`: optional `"pro"` | `"enterprise"` — **dev only** sets `organizations.plan` for this org
 * so the public team page tier gates render (revert in Dashboard / Supabase when done).
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  let slug = ''
  let replace = false
  let withLeagueSiteDemo = false
  let fullPortalDemo = false
  let withGamesAndStats = false
  let previewPublicTier: 'pro' | 'enterprise' | null = null
  let cleanupSeedNames = false
  let targetTeamName = ''
  let renameTeamTo = ''
  let enrichTeam = false
  try {
    const body = await req.json()
    slug = typeof body.slug === 'string' ? body.slug : ''
    replace = body.replace === true
    withLeagueSiteDemo = body.withLeagueSiteDemo === true
    fullPortalDemo = body.fullPortalDemo === true
    withGamesAndStats = body.withGamesAndStats === true
    cleanupSeedNames = body.cleanupSeedNames === true
    targetTeamName = typeof body.targetTeamName === 'string' ? body.targetTeamName.trim() : ''
    renameTeamTo = typeof body.renameTeamTo === 'string' ? body.renameTeamTo.trim() : ''
    enrichTeam = body.enrichTeam === true
    const pt = body.previewPublicTier
    if (pt === 'pro' || pt === 'enterprise') previewPublicTier = pt
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

  if (cleanupSeedNames) {
    const { data: seedTeams } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('organization_id', org.id)
      .like('name', `${SEED_PREFIX}%`)

    let renamed = 0
    for (const row of seedTeams || []) {
      const clean = String(row.name || '').replace(SEED_PREFIX, '').trim()
      if (!clean) continue
      const { error } = await supabaseAdmin
        .from('teams')
        .update({ name: clean })
        .eq('id', row.id)
      if (!error) renamed++
    }

    return NextResponse.json({
      ok: true,
      message: `Removed ${SEED_PREFIX} prefix from ${renamed} team name(s).`,
      renamedTeams: renamed,
    })
  }

  if (enrichTeam && targetTeamName) {
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, season_id')
      .eq('organization_id', org.id)
      .eq('name', targetTeamName)
      .maybeSingle()
    if (!team?.id) {
      return NextResponse.json({ error: `Team not found: ${targetTeamName}` }, { status: 404 })
    }

    if (renameTeamTo) {
      await supabaseAdmin.from('teams').update({ name: renameTeamTo }).eq('id', team.id)
    }

    const { data: existingPlayers } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('team_id', team.id)

    const existingCount = (existingPlayers || []).length
    const targetCount = 10
    if (existingCount < targetCount) {
      const stamp = `${Date.now()}`
      const addRows: Record<string, unknown>[] = []
      for (let i = existingCount; i < targetCount; i++) {
        const fn = FIRST_NAMES[i % FIRST_NAMES.length]
        const ln = LAST_NAMES[(i + 5) % LAST_NAMES.length]
        const full = `${fn} ${ln}`
        addRows.push({
          full_name: full,
          email: `seed.enrich.${stamp}.${i}@example.test`,
          phone: null,
          jersey_number: 3 + i,
          positions: POSITION_SETS[i % POSITION_SETS.length],
          avatar_url: `https://i.pravatar.cc/256?u=${encodeURIComponent(full)}`,
          organization_id: org.id,
          season_id: team.season_id,
          team_id: team.id,
          status: 'active',
        })
      }
      let ins = await supabaseAdmin.from('players').insert(addRows)
      if (ins.error && String(ins.error.message || '').includes('avatar_url')) {
        const fallback = addRows.map((r) => {
          const x = { ...r }
          delete (x as { avatar_url?: string }).avatar_url
          return x
        })
        ins = await supabaseAdmin.from('players').insert(fallback)
      }
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
    }

    const { data: players } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('team_id', team.id)
      .order('full_name', { ascending: true })
    const playerIds = (players || []).map((p) => p.id)

    const { data: finalGames } = await supabaseAdmin
      .from('games')
      .select('id')
      .eq('organization_id', org.id)
      .eq('season_id', team.season_id)
      .eq('status', 'final')
      .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)

    if (!finalGames || finalGames.length === 0) {
      const { data: opp } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('organization_id', org.id)
        .eq('season_id', team.season_id)
        .neq('id', team.id)
        .limit(1)
        .maybeSingle()
      if (opp?.id) {
        const gDate = new Date()
        gDate.setDate(gDate.getDate() - 3)
        const { data: created } = await supabaseAdmin
          .from('games')
          .insert({
            organization_id: org.id,
            season_id: team.season_id,
            home_team_id: team.id,
            away_team_id: opp.id,
            scheduled_at: gDate.toISOString(),
            status: 'final',
            home_score: 82,
            away_score: 76,
            location: 'Vancouver Arena Court 1',
          })
          .select('id')
          .single()
        if (created?.id) {
          finalGames?.push({ id: created.id })
        }
      }
    }

    for (const g of finalGames || []) {
      const { data: existingStats } = await supabaseAdmin
        .from('player_game_stats')
        .select('player_id')
        .eq('game_id', g.id)
        .in('player_id', playerIds)
      const existingSet = new Set((existingStats || []).map((s) => s.player_id))
      const rows: Record<string, unknown>[] = []
      for (let i = 0; i < Math.min(8, playerIds.length); i++) {
        const pid = playerIds[i]
        if (existingSet.has(pid)) continue
        rows.push({
          game_id: g.id,
          player_id: pid,
          organization_id: org.id,
          pts: 7 + ((i * 3) % 16),
          reb: 2 + ((i * 2) % 8),
          ast: 1 + ((i * 2) % 6),
          stl: i % 3,
          blk: i % 2,
          tov: i % 4,
          pf: 1 + (i % 3),
        })
      }
      if (rows.length > 0) {
        const { error } = await supabaseAdmin.from('player_game_stats').insert(rows)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    const { count } = await supabaseAdmin
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)

    return NextResponse.json({
      ok: true,
      message: `Team enriched: ${renameTeamTo || targetTeamName}`,
      teamId: team.id,
      players: count ?? 0,
      gamesTouched: (finalGames || []).length,
    })
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
      const { data: gh } = await supabaseAdmin.from('games').select('id').in('home_team_id', seedTeamIds)
      const { data: ga } = await supabaseAdmin.from('games').select('id').in('away_team_id', seedTeamIds)
      const gameIdSet = new Set<string>()
      for (const g of gh || []) if (g.id) gameIdSet.add(g.id)
      for (const g of ga || []) if (g.id) gameIdSet.add(g.id)
      const gameIds = [...gameIdSet]
      if (gameIds.length > 0) {
        await supabaseAdmin.from('player_game_stats').delete().in('game_id', gameIds)
        await supabaseAdmin.from('games').delete().in('id', gameIds)
      }
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

    const insertRow: Record<string, unknown> = {
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
      const streamSlug = PORTAL_TEAM_NAMES[t]
        .replace(SEED_PREFIX, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
      const { data: row, error } = await supabaseAdmin
        .from('teams')
        .insert({
          name: PORTAL_TEAM_NAMES[t],
          color: PORTAL_TEAM_COLORS[t % PORTAL_TEAM_COLORS.length],
          logo_url: TEAM_LOGO_URLS[t % TEAM_LOGO_URLS.length],
          stream_url: `https://www.youtube.com/watch?v=M7lc1UVf-VE&team=${streamSlug}`,
          house_rules:
            'Be on time when you can. Bring two jersey colours. Subs on whistles. Help drag out the garbage cans if you’re last game — the staff are cool to us.',
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
        const positions = POSITION_SETS[playerIdx % POSITION_SETS.length]
        playerRows.push({
          full_name,
          email: `seed.portal.${stamp}.${playerIdx}@example.test`,
          phone: null,
          jersey_number: 10 + ((playerIdx * 3) % 55),
          positions,
          avatar_url: `https://i.pravatar.cc/256?u=${encodeURIComponent(full_name)}`,
          organization_id: org.id,
          season_id: seasonId,
          team_id: teamsOut[ti].id,
          status: 'active',
        })
        playerIdx++
      }
    }

    let { error: playersErr } = await supabaseAdmin.from('players').insert(playerRows)
    if (playersErr && String(playersErr.message || '').includes('avatar_url')) {
      const fallbackRows = playerRows.map((row) => {
        const next = { ...row }
        delete (next as { avatar_url?: string }).avatar_url
        return next
      })
      const retry = await supabaseAdmin.from('players').insert(fallbackRows)
      playersErr = retry.error
    }
    if (playersErr) {
      await supabaseAdmin.from('teams').delete().in(
        'id',
        teamsOut.map((x) => x.id)
      )
      return NextResponse.json({ error: playersErr.message }, { status: 500 })
    }

    const { data: seededPlayers } = await supabaseAdmin
      .from('players')
      .select('id, team_id, full_name')
      .eq('organization_id', org.id)
      .in(
        'team_id',
        teamsOut.map((x) => x.id)
      )

    const playersByTeam = new Map<string, { id: string; full_name: string }[]>()
    for (const row of seededPlayers || []) {
      if (!row.team_id) continue
      const list = playersByTeam.get(row.team_id) || []
      list.push({ id: row.id, full_name: row.full_name || 'Player' })
      playersByTeam.set(row.team_id, list)
    }

    const now = Date.now()
    const newsRows: Record<string, unknown>[] = []
    const eventRows: Record<string, unknown>[] = []
    for (let ti = 0; ti < teamsOut.length; ti++) {
      const team = teamsOut[ti]
      const baseTitle = team.name.replace(SEED_PREFIX, '').trim()
      newsRows.push(
        {
          organization_id: org.id,
          team_id: team.id,
          season_id: seasonId,
          title: `${baseTitle} — practice this week?`,
          body: `Hey ${baseTitle} folks — we’re trying to grab the small gym **Thursday ~8pm** for a light shootaround. Reply in the thread if you can make it (no pressure). Bring a reversible if you have one.`,
          pinned: true,
        },
        {
          organization_id: org.id,
          team_id: team.id,
          season_id: seasonId,
          title: `${baseTitle} — carpool from the SkyTrain?`,
          body: `Posting this for the people who always ask last minute: two of us drive from **Commercial** most game nights. DM if you want a seat — gas money optional but snacks appreciated.`,
          pinned: false,
        }
      )

      for (let ei = 0; ei < 4; ei++) {
        const starts = new Date(now + (ti * 2 + ei * 4 + 2) * 24 * 3600 * 1000)
        starts.setHours(19 + (ei % 2), 0, 0, 0)
        const ends = new Date(starts.getTime() + 90 * 60 * 1000)
        eventRows.push({
          organization_id: org.id,
          team_id: team.id,
          season_id: seasonId,
          title: ei % 2 === 0 ? 'Team practice' : 'Tactical walk-through',
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          location: 'Vancouver Community Court',
          notes:
            'Optional — bring water. If the side door is locked, text the captain.',
          source: 'manual',
        })
      }
    }

    if (newsRows.length > 0) {
      await supabaseAdmin.from('team_news_posts').insert(newsRows)
    }
    if (eventRows.length > 0) {
      await supabaseAdmin.from('team_calendar_events').insert(eventRows)
    }

    for (let ti = 0; ti < Math.min(3, teamsOut.length); ti++) {
      const team = teamsOut[ti]
      const players = playersByTeam.get(team.id) || []
      if (players.length === 0) continue
      const { data: poll } = await supabaseAdmin
        .from('jersey_polls')
        .insert({
          organization_id: org.id,
          team_id: team.id,
          season_id: seasonId,
          status: 'open',
        })
        .select('id')
        .single()
      if (!poll?.id) continue
      const responses = players.slice(0, Math.min(7, players.length)).map((p, idx) => ({
        poll_id: poll.id,
        player_id: p.id,
        preferred_number: 3 + ((idx * 7 + ti) % 35),
      }))
      if (responses.length > 0) {
        await supabaseAdmin.from('jersey_poll_responses').insert(responses)
      }
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
    const payload = everydayLeagueSiteDemoPayload()
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

  let gamesSeeded: { games_created: number; stats_rows: number } | null = null
  if (withGamesAndStats && teamsOut.length >= 2 && seasonId) {
    const g = await seedSeasonGamesWithStats(supabaseAdmin, {
      organizationId: org.id,
      seasonId,
      teams: teamsOut,
    })
    if (!g.ok) {
      return NextResponse.json({ error: g.error }, { status: 500 })
    }
    gamesSeeded = { games_created: g.games_created, stats_rows: g.stats_rows }

    const upcomingRows: Record<string, unknown>[] = []
    for (let i = 0; i < Math.min(teamsOut.length, 6); i += 2) {
      const home = teamsOut[i]
      const away = teamsOut[i + 1]
      if (!home || !away) continue
      const when = new Date(Date.now() + (i + 3) * 24 * 3600 * 1000)
      when.setHours(20, 0, 0, 0)
      upcomingRows.push({
        organization_id: org.id,
        season_id: seasonId,
        home_team_id: home.id,
        away_team_id: away.id,
        scheduled_at: when.toISOString(),
        status: 'scheduled',
        location: 'Vancouver Arena Court 2',
      })
    }
    if (upcomingRows.length > 0) {
      await supabaseAdmin.from('games').insert(upcomingRows)
    }
  }

  let planPreviewNote = ''
  if (previewPublicTier) {
    const { error: planErr } = await supabaseAdmin
      .from('organizations')
      .update({ plan: previewPublicTier })
      .eq('id', org.id)
    if (planErr) {
      return NextResponse.json(
        { error: `Could not set preview plan: ${planErr.message}` },
        { status: 500 }
      )
    }
    planPreviewNote = ` Organization plan temporarily set to "${previewPublicTier}" for public page preview — revert in Supabase or Stripe when done.`
  }

  const teamHint = teamsOut.map((t) => t.name).join(', ')

  return NextResponse.json({
    ok: true,
    message:
      (fullPortalDemo
        ? `Portal demo: ${teamsOut.length} teams (80 roster players max seed), season signup window opened, TEXT/NEWS league home, [SEED] drop-ins with registrations. Visit /league/${slug.trim()} and /join/${slug.trim()}/dropins. Delete [SEED] rows from dashboard when done.`
        : `Open /league/${slug.trim()} — seed teams: ${teamHint}. Remove later from Dashboard → Teams / Players if you like.`) +
      (gamesSeeded
        ? ` Games: ${gamesSeeded.games_created} finals, ${gamesSeeded.stats_rows} stat rows. Open a team page under /league/${slug.trim()}/teams/<teamId>.`
        : '') +
      planPreviewNote,
    season_id: seasonId,
    teams: teamsOut,
    league_site_demo: leagueSiteDemo,
    full_portal_demo: fullPortalDemo,
    games_seeded: gamesSeeded,
    preview_plan: previewPublicTier,
  })
}
