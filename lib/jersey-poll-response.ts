import type { SupabaseClient } from '@supabase/supabase-js'

export function normJerseyPollEmail(s: string) {
  return s.trim().toLowerCase()
}

/**
 * Player saves a jersey pick for an open poll: first successful save wins each number.
 * Updates `players.jersey_number` to match (same uniqueness as manual roster edits).
 */
export async function submitJerseyPollPreference(
  admin: SupabaseClient,
  args: { pollId: string; playerId: string; preferredNumber: number }
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const parsed = args.preferredNumber
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 99) {
    return { ok: false, message: 'Jersey number must be between 0 and 99.', status: 400 }
  }

  const { data: poll, error: pollErr } = await admin
    .from('jersey_polls')
    .select('id, team_id, season_id, organization_id, status')
    .eq('id', args.pollId)
    .maybeSingle()

  if (pollErr || !poll) {
    return { ok: false, message: 'Poll not found.', status: 404 }
  }
  if (poll.status !== 'open') {
    return { ok: false, message: 'This poll is closed.', status: 400 }
  }

  const { data: player, error: plErr } = await admin
    .from('players')
    .select('id, team_id, season_id, organization_id, jersey_number')
    .eq('id', args.playerId)
    .maybeSingle()

  if (plErr || !player) {
    return { ok: false, message: 'Player not found.', status: 404 }
  }
  if (player.team_id !== poll.team_id || player.season_id !== poll.season_id) {
    return { ok: false, message: 'That player is not on this poll’s team.', status: 403 }
  }

  const { data: takenOnPoll } = await admin
    .from('jersey_poll_responses')
    .select('id')
    .eq('poll_id', args.pollId)
    .eq('preferred_number', parsed)
    .neq('player_id', args.playerId)
    .maybeSingle()

  if (takenOnPoll) {
    return {
      ok: false,
      message: 'Someone else on your team already picked that number. Choose another.',
      status: 409,
    }
  }

  const { data: takenInSeason } = await admin
    .from('players')
    .select('id')
    .eq('season_id', poll.season_id)
    .eq('organization_id', poll.organization_id)
    .eq('jersey_number', parsed)
    .neq('id', args.playerId)
    .maybeSingle()

  if (takenInSeason) {
    return {
      ok: false,
      message: 'That jersey number is already taken this season in your league. Choose another.',
      status: 409,
    }
  }

  const oldJersey = player.jersey_number != null ? Number(player.jersey_number) : null

  const { error: jerseyErr } = await admin.from('players').update({ jersey_number: parsed }).eq('id', args.playerId)

  if (jerseyErr) {
    return { ok: false, message: 'Could not save your jersey number. Try again.', status: 500 }
  }

  const { data: existingRow } = await admin
    .from('jersey_poll_responses')
    .select('id')
    .eq('poll_id', args.pollId)
    .eq('player_id', args.playerId)
    .maybeSingle()

  const now = new Date().toISOString()
  if (existingRow) {
    const { error: upd } = await admin
      .from('jersey_poll_responses')
      .update({ preferred_number: parsed, submitted_at: now })
      .eq('id', existingRow.id)
    if (upd) {
      await admin.from('players').update({ jersey_number: oldJersey }).eq('id', args.playerId)
      if (upd.code === '23505') {
        return {
          ok: false,
          message: 'Someone else on your team already picked that number. Choose another.',
          status: 409,
        }
      }
      return { ok: false, message: 'Could not save your pick. Try again.', status: 500 }
    }
  } else {
    const { error: ins } = await admin.from('jersey_poll_responses').insert({
      poll_id: args.pollId,
      player_id: args.playerId,
      preferred_number: parsed,
      submitted_at: now,
    })
    if (ins) {
      await admin.from('players').update({ jersey_number: oldJersey }).eq('id', args.playerId)
      if (ins.code === '23505') {
        return {
          ok: false,
          message: 'Someone else on your team already picked that number. Choose another.',
          status: 409,
        }
      }
      return { ok: false, message: 'Could not save your pick. Try again.', status: 500 }
    }
  }

  return { ok: true }
}
