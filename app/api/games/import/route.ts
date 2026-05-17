import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwnerOrgForDashboard } from '@/lib/org-access'
import { isProOrEnterprise, normalizeOrgPlan } from '@/lib/org-plan-tier'
import {
  buildScheduleImportPreview,
  finalizeScheduleImportPreview,
  parseGamesScheduleCsv,
  GAMES_SCHEDULE_CSV_MAX_ROWS,
  normalizeScheduleDate,
  normalizeScheduleTime,
} from '@/lib/games-schedule-csv'
import {
  detectScheduleFileKind,
  scheduleImportTextFromUpload,
} from '@/lib/games-schedule-import'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRO_IMPORT_MESSAGE =
  'Bulk schedule import is included on Pro and Enterprise. Upgrade under Dashboard → Settings → Plan, or add games one at a time.'

type ConfirmGameRow = {
  home_team_id: string
  away_team_id: string
  date: string
  time: string
  location?: string | null
}

async function loadOrgPlan(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('plan')
    .eq('id', organizationId)
    .maybeSingle()
  return normalizeOrgPlan(data?.plan)
}

async function resolveImportContext(seasonId: string, organizationId: string) {
  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('id')
    .eq('id', seasonId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!season) return null

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .eq('organization_id', organizationId)
    .eq('season_id', seasonId)

  return { teams: teams ?? [] }
}

function parseConfirmGames(raw: unknown): ConfirmGameRow[] {
  if (!Array.isArray(raw)) return []
  const out: ConfirmGameRow[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const home_team_id = typeof r.home_team_id === 'string' ? r.home_team_id.trim() : ''
    const away_team_id = typeof r.away_team_id === 'string' ? r.away_team_id.trim() : ''
    const date = typeof r.date === 'string' ? r.date.trim() : ''
    const time = typeof r.time === 'string' ? r.time.trim() : ''
    const location = typeof r.location === 'string' ? r.location : ''
    if (!home_team_id || !away_team_id || !date || !time) continue
    out.push({ home_team_id, away_team_id, date, time, location })
  }
  return out.slice(0, GAMES_SCHEDULE_CSV_MAX_ROWS)
}

function validateConfirmGames(
  games: ConfirmGameRow[],
  teamIds: Set<string>
): { ok: ConfirmGameRow[]; error?: string } {
  const ok: ConfirmGameRow[] = []
  for (const g of games) {
    if (!teamIds.has(g.home_team_id) || !teamIds.has(g.away_team_id)) {
      return { ok: [], error: 'One or more teams are not in this season.' }
    }
    if (g.home_team_id === g.away_team_id) {
      return { ok: [], error: 'Home and away must be different teams.' }
    }
    const dateNorm = normalizeScheduleDate(g.date)
    const timeNorm = normalizeScheduleTime(g.time)
    if (!dateNorm || !timeNorm) {
      return { ok: [], error: 'Invalid date or time in confirmed games.' }
    }
    ok.push({
      ...g,
      date: dateNorm,
      time: timeNorm,
      location: g.location?.trim() || null,
    })
  }
  if (ok.length === 0) {
    return { ok: [], error: 'No valid games to schedule.' }
  }
  return { ok }
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireOwnerOrgForDashboard(userId)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }
  const organizationId = gate.organizationId

  const plan = await loadOrgPlan(organizationId)
  if (!isProOrEnterprise(plan)) {
    return NextResponse.json({ error: PRO_IMPORT_MESSAGE }, { status: 403 })
  }

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const season_id = String(form.get('season_id') || '').trim()
    if (!season_id) {
      return NextResponse.json({ error: 'season_id is required' }, { status: 400 })
    }

    const ctx = await resolveImportContext(season_id, organizationId)
    if (!ctx) {
      return NextResponse.json({ error: 'Season not found for this league' }, { status: 404 })
    }

    let csvText = String(form.get('csv') || '')
    const file = form.get('file')
    if (file instanceof File && file.size > 0) {
      const kind = detectScheduleFileKind(file.name, file.type || '')
      if (!kind) {
        return NextResponse.json(
          { error: 'Use a .csv or .xlsx file (Excel or exported spreadsheet).' },
          { status: 400 }
        )
      }
      const buffer = await file.arrayBuffer()
      csvText = scheduleImportTextFromUpload(buffer, kind)
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'Upload a file or paste schedule text first.' }, { status: 400 })
    }

    const parsed = parseGamesScheduleCsv(csvText)
    if (parsed.length === 0) {
      return NextResponse.json(
        {
          error: `No games found. First row: home team, away team, date, time, location (max ${GAMES_SCHEDULE_CSV_MAX_ROWS} games).`,
        },
        { status: 400 }
      )
    }

    const rows = finalizeScheduleImportPreview(buildScheduleImportPreview(parsed, ctx.teams))
    const readyRows = rows.filter((r) => r.ready)

    return NextResponse.json({
      preview: true,
      rows,
      readyCount: readyRows.length,
      totalCount: rows.length,
      truncated: parsed.length >= GAMES_SCHEDULE_CSV_MAX_ROWS,
    })
  }

  const body = await req.json().catch(() => null)
  const season_id = typeof body?.season_id === 'string' ? body.season_id.trim() : ''
  const confirm = body?.confirm === true

  if (!season_id) {
    return NextResponse.json({ error: 'season_id is required' }, { status: 400 })
  }

  const ctx = await resolveImportContext(season_id, organizationId)
  if (!ctx) {
    return NextResponse.json({ error: 'Season not found for this league' }, { status: 404 })
  }

  if (confirm) {
    const confirmGames = parseConfirmGames(body?.games)
    const teamIds = new Set(ctx.teams.map((t) => t.id))
    const validated = validateConfirmGames(confirmGames, teamIds)
    if (validated.error) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const inserts = validated.ok.map((r) => ({
      organization_id: organizationId,
      season_id,
      home_team_id: r.home_team_id,
      away_team_id: r.away_team_id,
      scheduled_at: `${r.date}T${r.time}:00`,
      location: r.location,
      status: 'scheduled',
    }))

    const { error } = await supabaseAdmin.from('games').insert(inserts)
    if (error) {
      return NextResponse.json({ error: 'Failed to create games' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      inserted: inserts.length,
    })
  }

  const csv = typeof body?.csv === 'string' ? body.csv : ''
  if (!csv.trim()) {
    return NextResponse.json({ error: 'Paste a schedule or upload a file first.' }, { status: 400 })
  }

  const parsed = parseGamesScheduleCsv(csv)
  if (parsed.length === 0) {
    return NextResponse.json(
      {
        error: `No games found. First row: home team, away team, date, time, location (max ${GAMES_SCHEDULE_CSV_MAX_ROWS} games).`,
      },
      { status: 400 }
    )
  }

  const rows = finalizeScheduleImportPreview(buildScheduleImportPreview(parsed, ctx.teams))
  const readyRows = rows.filter((r) => r.ready)

  return NextResponse.json({
    preview: true,
    rows,
    readyCount: readyRows.length,
    totalCount: rows.length,
    truncated: parsed.length >= GAMES_SCHEDULE_CSV_MAX_ROWS,
  })
}
