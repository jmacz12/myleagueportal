import type { SupabaseClient } from '@supabase/supabase-js'

export async function optOutPlayerRegistrationOpens(
  admin: SupabaseClient,
  playerId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from('players')
    .update({ fan_email_registration_opens_opt_out: true })
    .eq('id', playerId)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: error.message || 'Could not update preferences' }
  if (!data) return { ok: false, error: 'Player not found' }
  return { ok: true }
}

export async function optOutDropinReminder(
  admin: SupabaseClient,
  registrationId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from('dropin_registrations')
    .update({ dropin_reminder_opt_out: true })
    .eq('id', registrationId)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: error.message || 'Could not update preferences' }
  if (!data) return { ok: false, error: 'Registration not found' }
  return { ok: true }
}
