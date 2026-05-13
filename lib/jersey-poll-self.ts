import { clerkClient } from '@clerk/nextjs/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normJerseyPollEmail } from '@/lib/jersey-poll-response'

export type JerseyPollSelfPayload = {
  authenticated: boolean
  player_id: string | null
  preferred_number: number | null
}

/**
 * For an open jersey poll: whether the viewer is signed in (Clerk), and if their roster row matches a Clerk email.
 * Used by public team GET and authenticated preference POST.
 */
export async function getJerseyPollSelfPayload(
  admin: SupabaseClient,
  opts: { userId: string | null; teamId: string; pollId: string }
): Promise<JerseyPollSelfPayload> {
  if (!opts.userId) {
    return { authenticated: false, player_id: null, preferred_number: null }
  }

  try {
    const client = await clerkClient()
    const user = await client.users.getUser(opts.userId)
    const emails = new Set(
      (user.emailAddresses || [])
        .map((e) => normJerseyPollEmail(String(e.emailAddress || '')))
        .filter(Boolean)
    )
    if (emails.size === 0) {
      return { authenticated: true, player_id: null, preferred_number: null }
    }

    const { data: rosterPlayers, error } = await admin
      .from('players')
      .select('id, email')
      .eq('team_id', opts.teamId)

    if (error) {
      return { authenticated: true, player_id: null, preferred_number: null }
    }

    const player = (rosterPlayers || []).find(
      (p) => p.email && emails.has(normJerseyPollEmail(String(p.email)))
    )
    if (!player?.id) {
      return { authenticated: true, player_id: null, preferred_number: null }
    }

    const { data: resp } = await admin
      .from('jersey_poll_responses')
      .select('preferred_number')
      .eq('poll_id', opts.pollId)
      .eq('player_id', player.id)
      .maybeSingle()

    const pref = resp?.preferred_number
    const n = pref != null ? Number(pref) : NaN
    return {
      authenticated: true,
      player_id: player.id,
      preferred_number: !Number.isNaN(n) ? n : null,
    }
  } catch {
    return { authenticated: true, player_id: null, preferred_number: null }
  }
}
