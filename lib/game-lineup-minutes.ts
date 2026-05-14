import type { SupabaseClient } from '@supabase/supabase-js'
import { parseStarterSlotArray, starterSlotArraysEqual } from '@/lib/starter-slot-array'

/** Regulation quarter length for timeline math (default 10:00; overridden by `organizations.scoring_quarter_minutes`). */
export const REGULATION_PERIOD_SECONDS = 600

export const SCORING_QUARTER_MINUTES_MIN = 4
export const SCORING_QUARTER_MINUTES_MAX = 20
export const SCORING_QUARTER_MINUTES_DEFAULT = 10

/** Whole minutes per regulation quarter (dashboard setting). */
export function clampScoringQuarterMinutes(raw: unknown): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return SCORING_QUARTER_MINUTES_DEFAULT
  return Math.min(SCORING_QUARTER_MINUTES_MAX, Math.max(SCORING_QUARTER_MINUTES_MIN, n))
}

export function scoringQuarterLengthSeconds(raw: unknown): number {
  return clampScoringQuarterMinutes(raw) * 60
}

export function formatSecondsAsMinSec(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function parseGameClockToRemainingSeconds(clock: unknown): number {
  if (typeof clock !== 'string') return 0
  const parts = clock.trim().split(':')
  if (parts.length < 2) return 0
  const m = Number(parts[0])
  const s = Number(parts[1])
  if (!Number.isFinite(m) || !Number.isFinite(s)) return 0
  return Math.max(0, Math.floor(m) * 60 + Math.floor(s))
}

/** Monotonic "game seconds" from tip: each period is `quarterLen` long, clock is time remaining in period. */
export function gameClockAnchorSeconds(
  period: number,
  clockRemainingSeconds: number,
  quarterLen: number = REGULATION_PERIOD_SECONDS
): number {
  const p = Math.max(1, Math.floor(period) || 1)
  const rem = Math.max(0, Math.min(quarterLen, Math.floor(clockRemainingSeconds)))
  return (p - 1) * quarterLen + (quarterLen - rem)
}

function playerIdsFromSnapshotSlots(home: unknown, away: unknown): string[] {
  const h = parseStarterSlotArray(home)
  const a = parseStarterSlotArray(away)
  return [...new Set([...h, ...a].filter((x): x is string => !!x))]
}

type SnapshotRow = {
  period: number
  clock_remaining_seconds: number
  home_starter_slot_ids: unknown
  away_starter_slot_ids: unknown
}

function snapshotFingerprint(
  period: number,
  clockRemainingSeconds: number,
  home: unknown,
  away: unknown
): string {
  return JSON.stringify({
    p: period,
    c: clockRemainingSeconds,
    h: parseStarterSlotArray(home),
    a: parseStarterSlotArray(away),
  })
}

export async function appendLineupSnapshotIfNeeded(
  admin: SupabaseClient,
  params: {
    gameId: string
    organizationId: string
    period: number
    clockRemainingSeconds: number
    homeSlots: (string | null)[]
    awaySlots: (string | null)[]
  }
): Promise<boolean> {
  const { data: last } = await admin
    .from('game_lineup_snapshots')
    .select('period, clock_remaining_seconds, home_starter_slot_ids, away_starter_slot_ids, created_at')
    .eq('game_id', params.gameId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const p = Math.max(1, Math.floor(params.period) || 1)
  const c = Math.max(0, Math.floor(params.clockRemainingSeconds))

  if (last) {
    if (
      snapshotFingerprint(p, c, params.homeSlots, params.awaySlots) ===
      snapshotFingerprint(
        Number(last.period) || 1,
        Number(last.clock_remaining_seconds) || 0,
        last.home_starter_slot_ids,
        last.away_starter_slot_ids
      )
    ) {
      return false
    }
  }

  const { error } = await admin.from('game_lineup_snapshots').insert({
    game_id: params.gameId,
    organization_id: params.organizationId,
    period: p,
    clock_remaining_seconds: c,
    home_starter_slot_ids: params.homeSlots,
    away_starter_slot_ids: params.awaySlots,
  })
  if (error) {
    console.error('appendLineupSnapshotIfNeeded:', error.message)
    return false
  }
  return true
}

/**
 * Recompute `seconds_played` for every player in this game from snapshots + current `games.period` / `game_clock`.
 */
export async function recomputePlayerSecondsPlayedForGame(
  admin: SupabaseClient,
  gameId: string,
  opts?: { quarterLengthSeconds?: number }
): Promise<void> {
  const { data: game, error: gErr } = await admin
    .from('games')
    .select(
      'id, organization_id, status, period, game_clock, home_starter_slot_ids, away_starter_slot_ids'
    )
    .eq('id', gameId)
    .maybeSingle()

  if (gErr || !game?.id) return

  let quarterLen = opts?.quarterLengthSeconds
  if (quarterLen == null || !Number.isFinite(quarterLen) || quarterLen <= 0) {
    const { data: orgRow } = await admin
      .from('organizations')
      .select('scoring_quarter_minutes')
      .eq('id', game.organization_id)
      .maybeSingle()
    quarterLen = scoringQuarterLengthSeconds(orgRow?.scoring_quarter_minutes ?? SCORING_QUARTER_MINUTES_DEFAULT)
  }

  const { data: snaps } = await admin
    .from('game_lineup_snapshots')
    .select('period, clock_remaining_seconds, home_starter_slot_ids, away_starter_slot_ids, created_at')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })

  const list = (snaps || []) as SnapshotRow[]
  const endRem = parseGameClockToRemainingSeconds(game.game_clock)
  const endAnchor = gameClockAnchorSeconds(Math.max(1, Number(game.period) || 1), endRem, quarterLen)

  const seconds = new Map<string, number>()

  function addSeconds(playerIds: string[], delta: number) {
    if (delta <= 0 || playerIds.length === 0) return
    for (const id of playerIds) {
      seconds.set(id, (seconds.get(id) ?? 0) + delta)
    }
  }

  for (let i = 0; i < list.length; i++) {
    const cur = list[i]
    const pids = playerIdsFromSnapshotSlots(cur.home_starter_slot_ids, cur.away_starter_slot_ids)
    const a0 = gameClockAnchorSeconds(
      Number(cur.period) || 1,
      Number(cur.clock_remaining_seconds) || 0,
      quarterLen
    )
    const nextAnchor =
      i + 1 < list.length
        ? gameClockAnchorSeconds(
            Number(list[i + 1].period) || 1,
            Number(list[i + 1].clock_remaining_seconds) || 0,
            quarterLen
          )
        : endAnchor
    addSeconds(pids, nextAnchor - a0)
  }

  const { data: statRows } = await admin.from('player_game_stats').select('player_id').eq('game_id', gameId)
  const existingIds = new Set((statRows || []).map((r) => String(r.player_id)))

  const allIds = new Set<string>([...seconds.keys(), ...existingIds])

  const idsToFetch = [...allIds].filter((id) => !existingIds.has(id) && (seconds.get(id) ?? 0) > 0)
  let teamByPlayer = new Map<string, string | null>()
  if (idsToFetch.length > 0) {
    const { data: pl } = await admin
      .from('players')
      .select('id, team_id')
      .in('id', idsToFetch)
      .eq('organization_id', game.organization_id)
    teamByPlayer = new Map((pl || []).map((p) => [p.id, p.team_id]))
  }

  await Promise.all(
    [...allIds].map(async (pid) => {
      const sec = Math.max(0, Math.floor(seconds.get(pid) ?? 0))
      if (existingIds.has(pid)) {
        await admin.from('player_game_stats').update({ seconds_played: sec }).eq('game_id', gameId).eq('player_id', pid)
      } else if (sec > 0) {
        const teamId = teamByPlayer.get(pid) ?? null
        const row: Record<string, unknown> = {
          game_id: gameId,
          player_id: pid,
          organization_id: game.organization_id,
          team_id: teamId,
          seconds_played: sec,
          pts: 0,
          fg2m: 0,
          fg3m: 0,
          ftm: 0,
          ast: 0,
          reb: 0,
          stl: 0,
          blk: 0,
          tov: 0,
          pf: 0,
        }
        let ins = await admin.from('player_game_stats').insert(row)
        if (ins.error && String(ins.error.message || '').toLowerCase().includes('team_id')) {
          const { team_id: _t, ...rest } = row
          void _t
          ins = await admin.from('player_game_stats').insert(rest)
        }
        if (ins.error && /\bfg2m\b|\bfg3m\b|\bftm\b/i.test(String(ins.error.message || ''))) {
          await admin.from('player_game_stats').insert({
            game_id: gameId,
            player_id: pid,
            organization_id: game.organization_id,
            seconds_played: sec,
            pts: 0,
            ast: 0,
            reb: 0,
            stl: 0,
            blk: 0,
            tov: 0,
            pf: 0,
          })
        }
        if (ins.error?.code === '23505') {
          await admin.from('player_game_stats').update({ seconds_played: sec }).eq('game_id', gameId).eq('player_id', pid)
        }
      }
    })
  )
}

export async function recomputeMinutesForAllOrgGames(
  admin: SupabaseClient,
  organizationId: string
): Promise<void> {
  const { data: gameRows } = await admin.from('games').select('id').eq('organization_id', organizationId)
  for (const row of gameRows || []) {
    await recomputePlayerSecondsPlayedForGame(admin, row.id)
  }
}

export function slotsChangedVsRow(
  body: { home_starter_slot_ids?: unknown; away_starter_slot_ids?: unknown },
  gameRow: { home_starter_slot_ids?: unknown; away_starter_slot_ids?: unknown }
): boolean {
  let changed = false
  if (body.home_starter_slot_ids !== undefined) {
    changed =
      changed || !starterSlotArraysEqual(body.home_starter_slot_ids, gameRow.home_starter_slot_ids)
  }
  if (body.away_starter_slot_ids !== undefined) {
    changed =
      changed || !starterSlotArraysEqual(body.away_starter_slot_ids, gameRow.away_starter_slot_ids)
  }
  return changed
}
