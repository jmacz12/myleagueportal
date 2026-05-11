import type { SupabaseClient } from '@supabase/supabase-js'

/** Matches PATCH logic in `app/api/dropin/standings/route.ts`. */
export function tierFromPoints(points: number, tierGold: number, tierSilver: number): 'gold' | 'silver' | 'bronze' | 'warning' {
  if (points >= tierGold) return 'gold'
  if (points >= tierSilver) return 'silver'
  if (points < 0) return 'warning'
  return 'bronze'
}

async function loadReputationThresholds(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ tierGold: number; tierSilver: number }> {
  const { data } = await supabase
    .from('reputation_settings')
    .select('tier_gold, tier_silver')
    .eq('organization_id', organizationId)
    .maybeSingle()
  return {
    tierGold: typeof data?.tier_gold === 'number' ? data.tier_gold : 200,
    tierSilver: typeof data?.tier_silver === 'number' ? data.tier_silver : 100,
  }
}

/**
 * Drop-in public signup uses `dropin_registrations`; standings use `players` + `player_reputation`.
 * When an email is present, ensure a league player row exists and has a reputation row so Dashboard → Drop-ins → Standings stays in sync.
 */
export async function ensureDropinPlayerLinkedToReputation(
  supabase: SupabaseClient,
  params: {
    organizationId: string
    email: string | null | undefined
    fullName: string
    positions?: string[]
  }
): Promise<{ playerId: string } | null> {
  const raw = typeof params.email === 'string' ? params.email.trim().toLowerCase() : ''
  if (!raw) return null

  const { data: existingPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('organization_id', params.organizationId)
    .eq('email', raw)
    .order('registered_at', { ascending: false })
    .limit(1)

  let playerId = existingPlayers?.[0]?.id as string | undefined

  if (!playerId) {
    const { data: seasons } = await supabase
      .from('seasons')
      .select('id')
      .eq('organization_id', params.organizationId)
      .order('created_at', { ascending: false })
      .limit(1)

    const seasonId = seasons?.[0]?.id as string | undefined
    if (!seasonId) return null

    const pos = Array.isArray(params.positions) ? params.positions : []

    const { data: inserted, error } = await supabase
      .from('players')
      .insert({
        organization_id: params.organizationId,
        season_id: seasonId,
        team_id: null,
        full_name: params.fullName.trim() || 'Player',
        email: raw,
        positions: pos,
        status: 'active',
      })
      .select('id')
      .single()

    if (error || !inserted?.id) {
      console.warn('[dropin-reputation] players insert skipped:', error?.message || 'unknown')
      return null
    }
    playerId = inserted.id as string
  }

  const { data: existingRep } = await supabase
    .from('player_reputation')
    .select('id')
    .eq('organization_id', params.organizationId)
    .eq('player_id', playerId)
    .maybeSingle()

  if (!existingRep) {
    const { error: repErr } = await supabase.from('player_reputation').insert({
      organization_id: params.organizationId,
      player_id: playerId,
      points: 0,
      sessions_attended: 0,
      sessions_registered: 0,
      total_paid: 0,
      total_owed: 0,
      tier: 'bronze',
      is_inactive: false,
      consecutive_noshows: 0,
    })
    if (repErr) {
      console.warn('[dropin-reputation] player_reputation insert skipped:', repErr.message)
      return null
    }
  }

  return { playerId }
}

/** Demo / seed: assign varied points and session counts so Standings tiers look populated. */
export async function randomizeReputationForPlayerIds(
  supabase: SupabaseClient,
  organizationId: string,
  playerIds: string[]
): Promise<void> {
  if (playerIds.length === 0) return

  const { tierGold, tierSilver } = await loadReputationThresholds(supabase, organizationId)

  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)

  await Promise.all(
    shuffled.map((pid) => {
      const attended = 1 + Math.floor(Math.random() * 14)
      const noShows = Math.floor(Math.random() * 4)
      const registered = attended + noShows
      let points =
        attended * 12 +
        Math.floor(Math.random() * 80) -
        noShows * 15 +
        Math.floor(Math.random() * 40)

      points = Math.max(-30, Math.min(320, points))

      const tier = tierFromPoints(points, tierGold, tierSilver)

      return supabase
        .from('player_reputation')
        .update({
          points,
          tier,
          sessions_attended: attended,
          sessions_registered: registered,
          total_paid: attended * 12,
          total_owed: noShows > 0 ? Math.floor(Math.random() * 25) : 0,
          is_inactive: false,
          consecutive_noshows: noShows > 2 ? noShows : 0,
        })
        .eq('organization_id', organizationId)
        .eq('player_id', pid)
    })
  )
}
