import type { SupabaseClient } from '@supabase/supabase-js'
import { getPublicSiteOrigin } from '@/lib/public-site-origin'
import { createGameReminderUnsubscribeToken } from '@/lib/game-reminder-unsubscribe-token'

export function gameReminderUnsubscribePageUrl(playerId: string): string {
  const token = createGameReminderUnsubscribeToken(playerId)
  return `${getPublicSiteOrigin()}/unsubscribe/game-reminders?token=${encodeURIComponent(token)}`
}

/** One-click POST target (RFC 8058); same token as the page link. */
export function gameReminderUnsubscribeApiUrl(playerId: string): string {
  const token = createGameReminderUnsubscribeToken(playerId)
  return `${getPublicSiteOrigin()}/api/game-reminders/unsubscribe?token=${encodeURIComponent(token)}`
}

export async function optOutPlayerGameReminders(
  admin: SupabaseClient,
  playerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from('players')
    .update({ game_reminders_opt_out: true })
    .eq('id', playerId)
    .select('id, full_name, email')
    .maybeSingle()

  if (error) return { ok: false, error: error.message || 'Could not update preferences' }
  if (!data) return { ok: false, error: 'Player not found' }
  return { ok: true }
}
