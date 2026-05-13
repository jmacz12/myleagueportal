import type { SupabaseClient } from '@supabase/supabase-js'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Best-effort: remove all objects under `league-site/{orgId}/`. */
export async function removeLeagueSiteFilesForOrg(admin: SupabaseClient, orgId: string): Promise<void> {
  const bucket = 'league-site'

  async function walk(prefix: string): Promise<void> {
    const { data: entries } = await admin.storage.from(bucket).list(prefix, { limit: 1000 })
    if (!entries?.length) return

    for (const e of entries) {
      const path = prefix ? `${prefix}/${e.name}` : e.name
      const isFile = e.metadata != null && typeof (e.metadata as { size?: unknown }).size === 'number'
      if (isFile) {
        await admin.storage.from(bucket).remove([path])
      } else {
        await walk(path)
      }
    }
  }

  await walk(orgId)
}

/**
 * Full explicit teardown (used when DB migration `20260514140000_organization_fk_on_delete_cascade`
 * is not applied, or when a single `DELETE FROM organizations` hits a leftover FK).
 */
export async function deleteOrganizationDatabaseRowsExplicit(
  admin: SupabaseClient,
  orgId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const fail = (message: string) => ({ ok: false as const, message })

  const { data: games, error: gamesListErr } = await admin.from('games').select('id').eq('organization_id', orgId)
  if (gamesListErr) return fail(gamesListErr.message)

  const gameIds = (games || []).map((g) => g.id as string).filter(Boolean)
  for (const ids of chunk(gameIds, 200)) {
    const { error } = await admin.from('player_game_stats').delete().in('game_id', ids)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('games').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  const { data: sessions, error: sessErr } = await admin
    .from('dropin_sessions')
    .select('id')
    .eq('organization_id', orgId)
  if (sessErr) return fail(sessErr.message)

  const sessionIds = (sessions || []).map((s) => s.id as string).filter(Boolean)
  for (const ids of chunk(sessionIds, 200)) {
    const { error } = await admin.from('dropin_registrations').delete().in('session_id', ids)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('dropin_sessions').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  const { data: polls, error: pollsErr } = await admin.from('jersey_polls').select('id').eq('organization_id', orgId)
  if (pollsErr) return fail(pollsErr.message)

  const pollIds = (polls || []).map((p) => p.id as string).filter(Boolean)
  for (const ids of chunk(pollIds, 200)) {
    const { error } = await admin.from('jersey_poll_responses').delete().in('poll_id', ids)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('jersey_polls').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  for (const table of ['team_news_posts', 'team_calendar_events'] as const) {
    const { error } = await admin.from(table).delete().eq('organization_id', orgId)
    if (error) return fail(`${table}: ${error.message}`)
  }

  {
    const { error } = await admin.from('reputation_log').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('player_reputation').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('waiver_signatures').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('waivers').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('players').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('teams').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('seasons').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('reputation_settings').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('league_site_content').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('organization_editors').delete().eq('organization_id', orgId)
    if (error) return fail(error.message)
  }

  {
    const { error } = await admin.from('organizations').delete().eq('id', orgId)
    if (error) return fail(error.message)
  }

  return { ok: true }
}

/**
 * Removes all Postgres rows for one organization.
 * Prefers a single `DELETE FROM organizations` when FK CASCADE is installed (migration
 * `20260514140000_organization_fk_on_delete_cascade.sql`); falls back to explicit deletes
 * on older databases or FK errors.
 */
export async function deleteOrganizationDatabaseRows(
  admin: SupabaseClient,
  orgId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: deleted, error: delErr } = await admin.from('organizations').delete().eq('id', orgId).select('id')

  if (!delErr && Array.isArray(deleted) && deleted.length > 0) {
    return { ok: true }
  }

  const msg = delErr?.message || ''
  const fkBlocked = /foreign key|violates foreign key|23503/i.test(msg) || delErr?.code === '23503'

  if (delErr && !fkBlocked) {
    return { ok: false, message: msg || 'Failed to delete organization' }
  }

  return deleteOrganizationDatabaseRowsExplicit(admin, orgId)
}
