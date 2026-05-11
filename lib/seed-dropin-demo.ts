import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureDropinPlayerLinkedToReputation, randomizeReputationForPlayerIds } from '@/lib/dropin-reputation'

/** Tagged sessions from this seed — safe to delete and recreate. */
export const DROPIN_SEED_LOCATION_TAG = '[SEED drop-ins]'
const LEGACY_DEMO_TAG = '[DEMO off-season]'

export type SeedDropinDemoResult =
  | {
      ok: true
      slug: string
      message: string
      sessionsCreated: number
      registrationsInserted: number
      recurringUntil: string
      firstMondayId: string | null
      firstWednesdayId: string | null
      standingsPlayersLinked: number
    }
  | { ok: false; error: string; hint?: string }

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Next weekday occurrence at hour:minute local time, strictly after `from`. */
function nextOccurrence(from: Date, dow: number, hour: number, minute: number): Date {
  for (let i = 0; i < 21; i++) {
    const tryDate = new Date(from)
    tryDate.setDate(from.getDate() + i)
    tryDate.setHours(hour, minute, 0, 0)
    if (tryDate.getDay() === dow && tryDate.getTime() > from.getTime()) {
      return tryDate
    }
  }
  const fallback = new Date(from)
  fallback.setDate(fallback.getDate() + 7)
  fallback.setHours(hour, minute, 0, 0)
  return fallback
}

/** Expand weekly date strings (YYYY-MM-DD) from start through end inclusive. */
function expandWeeklyLocal(firstYmd: string, untilYmd: string): string[] {
  const end = new Date(untilYmd + 'T23:59:59')
  const dates: string[] = []
  const cur = new Date(firstYmd + 'T12:00:00')
  while (cur <= end) {
    dates.push(ymd(cur))
    cur.setDate(cur.getDate() + 7)
    if (dates.length > 80) break
  }
  return dates
}

function formatSessionSuffix(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

const FIRST_NAMES = [
  'Alex',
  'Jordan',
  'Sam',
  'Casey',
  'Riley',
  'Morgan',
  'Taylor',
  'Jamie',
  'Chris',
  'Pat',
  'Drew',
  'Quinn',
  'Avery',
  'Blake',
  'Cameron',
  'Dana',
  'Ellis',
  'Frank',
  'Gray',
  'Harper',
  'Indigo',
  'Skyler',
  'Reese',
  'Rowan',
  'Sage',
  'River',
  'Phoenix',
  'Oakley',
  'Emerson',
  'Finley',
  'Hayden',
  'Logan',
  'Marley',
  'Parker',
  'Remy',
  'Shawn',
  'Terry',
  'Val',
  'Winter',
  'Zion',
]

const LAST_NAMES = [
  'Rivera',
  'Lee',
  'Okonkwo',
  'Morgan',
  'Chen',
  'Patel',
  'Blake',
  'Brooks',
  'Fox',
  'Ade',
  'Ng',
  'Silva',
  'Park',
  'Kim',
  'Hart',
  'Diaz',
  'Scott',
  'Moore',
  'Liu',
  'Turner',
  'Jain',
  'Wells',
  'Singh',
  'Caruso',
  'Brown',
  'Davis',
  'Evans',
  'Garcia',
  'Harris',
  'Iwamoto',
  'Jones',
  'Klein',
  'Lopez',
  'Miller',
  'Nolan',
  'Owen',
  'Price',
  'Quinn',
  'Reed',
  'Stone',
]

function syntheticName(index: number): string {
  const fi = index % FIRST_NAMES.length
  const li = Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length
  return `${FIRST_NAMES[fi]} ${LAST_NAMES[li]}`
}

function slugMailDomain(slug: string): string {
  const s = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'league'
}

function buildRegistrationRows(
  orgId: string,
  sessionId: string,
  rosterCount: number,
  waitCount: number,
  emailPrefix: string,
  leagueSlug: string
): Record<string, unknown>[] {
  const domain = slugMailDomain(leagueSlug)
  const rows: Record<string, unknown>[] = []
  let idx = 0
  for (let i = 0; i < rosterCount; i++) {
    rows.push({
      session_id: sessionId,
      organization_id: orgId,
      full_name: syntheticName(idx++),
      email: `${emailPrefix}.roster.${i}@${domain}.dropin.local`,
      positions: [],
      is_guest: false,
      checked_in: false,
      payment_status: 'unpaid',
      is_waitlist: false,
    })
  }
  for (let i = 0; i < waitCount; i++) {
    rows.push({
      session_id: sessionId,
      organization_id: orgId,
      full_name: syntheticName(idx++),
      email: `${emailPrefix}.wait.${i}@${domain}.dropin.local`,
      positions: [],
      is_guest: false,
      checked_in: false,
      payment_status: 'unpaid',
      is_waitlist: true,
    })
  }
  return rows
}

export async function seedDropinDemo(
  supabase: SupabaseClient,
  slug: string,
  options?: { recurringMonths?: number }
): Promise<SeedDropinDemoResult> {
  const trimmed = slug.trim()
  if (!trimmed) {
    return { ok: false, error: 'Missing league slug.' }
  }

  const recurringMonths = Math.min(5, Math.max(3, options?.recurringMonths ?? 4))

  const { data: org, error: orgErr } = await supabase.from('organizations').select('id').eq('slug', trimmed).single()

  if (orgErr || !org) {
    return {
      ok: false,
      error: `No organization with slug "${trimmed}".`,
      hint: 'Copy the slug from Dashboard → Settings (registration slug).',
    }
  }

  const orgId = org.id as string

  const idSet = new Set<string>()
  for (const pattern of [`%${DROPIN_SEED_LOCATION_TAG}%`, `%${LEGACY_DEMO_TAG}%`]) {
    const { data: rows } = await supabase
      .from('dropin_sessions')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('location', pattern)
    for (const r of rows || []) idSet.add(r.id as string)
  }

  const oldIds = [...idSet]
  if (oldIds.length > 0) {
    await supabase.from('dropin_registrations').delete().in('session_id', oldIds)
    await supabase.from('dropin_sessions').delete().in('id', oldIds)
  }

  const now = new Date()
  const recurringEnd = new Date(now)
  recurringEnd.setMonth(recurringEnd.getMonth() + recurringMonths)
  const recurringUntilYmd = ymd(recurringEnd)

  const firstMonday = nextOccurrence(now, 1, 19, 0)
  const firstWednesday = nextOccurrence(now, 3, 19, 0)
  const monStartYmd = ymd(firstMonday)
  const wedStartYmd = ymd(firstWednesday)

  const monDates = expandWeeklyLocal(monStartYmd, recurringUntilYmd)
  const wedDates = expandWeeklyLocal(wedStartYmd, recurringUntilYmd)

  const sessionCommon = {
    organization_id: orgId,
    payment_method: 'cash_or_etransfer' as const,
    etransfer_info: null as string | null,
    allow_signups: true,
    status: 'upcoming' as const,
    signup_opens: 'immediately' as const,
    signup_opens_days_before: null as number | null,
    signup_opens_at: null as string | null,
    is_recurring: true,
    recurring_frequency: 'weekly' as const,
    recurring_until: recurringUntilYmd,
    fee_amount: 12,
    max_waitlist: 5,
  }

  /** Monday cap and Wednesday cap — both in 20–40 range. */
  const maxPlayersMonday = 36
  const maxPlayersWednesday = 32

  const monInserts = monDates.map((d) => ({
    ...sessionCommon,
    name: `Off-season drop-in · Mon 7–9pm — ${formatSessionSuffix(d)}`,
    scheduled_at: `${d}T19:00:00`,
    ends_at: `${d}T21:00:00`,
    location: `Main gym · ${DROPIN_SEED_LOCATION_TAG}`,
    max_players: maxPlayersMonday,
  }))

  const wedInserts = wedDates.map((d) => ({
    ...sessionCommon,
    name: `Off-season drop-in · Wed 7–9pm — ${formatSessionSuffix(d)}`,
    scheduled_at: `${d}T19:00:00`,
    ends_at: `${d}T21:00:00`,
    location: `Community court · ${DROPIN_SEED_LOCATION_TAG}`,
    max_players: maxPlayersWednesday,
  }))

  const { data: insertedMon, error: monErr } = await supabase.from('dropin_sessions').insert(monInserts).select('id')
  if (monErr) {
    return {
      ok: false,
      error: monErr.message,
      hint: 'If a column is missing, run npm run db:apply-pending (drop-in waitlist migration).',
    }
  }

  const { data: insertedWed, error: wedErr } = await supabase.from('dropin_sessions').insert(wedInserts).select('id')
  if (wedErr) {
    return { ok: false, error: wedErr.message }
  }

  const firstMondayId = (insertedMon?.[0]?.id as string | undefined) ?? null
  const firstWednesdayId = (insertedWed?.[0]?.id as string | undefined) ?? null

  const regRows: Record<string, unknown>[] = []

  if (firstMondayId) {
    regRows.push(
      ...buildRegistrationRows(
        orgId,
        firstMondayId,
        maxPlayersMonday,
        5,
        `demo.mon.${monStartYmd.replace(/-/g, '')}`,
        trimmed
      )
    )
  }
  if (firstWednesdayId) {
    /** Wednesday: partial roster + partial waitlist for UI variety */
    regRows.push(
      ...buildRegistrationRows(orgId, firstWednesdayId, 24, 4, `demo.wed.${wedStartYmd.replace(/-/g, '')}`, trimmed)
    )
  }

  let registrationsInserted = 0
  let standingsPlayersLinked = 0

  if (regRows.length > 0) {
    const { error: regErr } = await supabase.from('dropin_registrations').insert(regRows)
    if (regErr) {
      return {
        ok: false,
        error: regErr.message,
        hint: 'Sessions were created; registrations failed. Check dropin_registrations columns / waitlist migration.',
      }
    }
    registrationsInserted = regRows.length

    const seenEmail = new Map<string, string>()
    for (const row of regRows) {
      const em = typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''
      const nm = typeof row.full_name === 'string' ? row.full_name : 'Player'
      if (em && !seenEmail.has(em)) seenEmail.set(em, nm)
    }

    const linkResults = await Promise.all(
      [...seenEmail.entries()].map(([email, fullName]) =>
        ensureDropinPlayerLinkedToReputation(supabase, {
          organizationId: orgId,
          email,
          fullName,
          positions: [],
        })
      )
    )
    const playerIds = linkResults.map((r) => r?.playerId).filter((id): id is string => !!id)

    standingsPlayersLinked = playerIds.length
    await randomizeReputationForPlayerIds(supabase, orgId, playerIds)
  }

  const sessionsCreated = monInserts.length + wedInserts.length

  return {
    ok: true,
    slug: trimmed,
    message: `Created ${sessionsCreated} recurring sessions (${recurringMonths} mo until ${recurringUntilYmd}). Populated the next Monday (${maxPlayersMonday}+5) and next Wednesday (24+4). Linked ${standingsPlayersLinked} players to reputation (randomized standings).`,
    sessionsCreated,
    registrationsInserted,
    recurringUntil: recurringUntilYmd,
    firstMondayId,
    firstWednesdayId,
    standingsPlayersLinked,
  }
}
