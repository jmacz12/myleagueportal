import type { SupabaseClient } from '@supabase/supabase-js'

export function normJerseyPollEmail(s: string) {
  return s.trim().toLowerCase()
}

export async function upsertJerseyPollPlayerResponse(
  admin: SupabaseClient,
  args: { pollId: string; playerId: string; preferredNumber: number }
): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  const parsed = args.preferredNumber
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 99) {
    return { ok: false, message: 'Jersey number must be between 0 and 99.', status: 400 }
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
    if (upd) return { ok: false, message: 'Could not save your response. Try again.', status: 500 }
  } else {
    const { error: ins } = await admin.from('jersey_poll_responses').insert({
      poll_id: args.pollId,
      player_id: args.playerId,
      preferred_number: parsed,
      submitted_at: now,
    })
    if (ins) return { ok: false, message: 'Could not save your response. Try again.', status: 500 }
  }
  return { ok: true }
}
