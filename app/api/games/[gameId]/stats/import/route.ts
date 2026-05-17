import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwnerOrgForDashboard } from '@/lib/org-access'
import { isProOrEnterprise, normalizeOrgPlan } from '@/lib/org-plan-tier'
import { applyGameStatsBulkUpsert } from '@/lib/game-stats-bulk-upsert'
import {
  buildStatSheetPreview,
  previewRowsToConfirmStats,
  type StatSheetConfirmRow,
  type StatSheetPlayerLookup,
  type StatSheetTeamLookup,
} from '@/lib/game-stats-sheet-csv'
import {
  detectStatSheetFileKind,
  parseStatSheetUpload,
} from '@/lib/game-stats-sheet-import'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRO_MESSAGE =
  'Stat sheet upload is included on Pro and Enterprise. Upgrade under Dashboard → Settings → Plan, or enter stats live under Games.'

async function loadImportContext(gameId: string, organizationId: string) {
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, home_team_id, away_team_id, organization_id')
    .eq('id', gameId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!game?.home_team_id || !game?.away_team_id) return null

  const [{ data: teams }, { data: players }] = await Promise.all([
    supabaseAdmin
      .from('teams')
      .select('id, name')
      .in('id', [game.home_team_id, game.away_team_id]),
    supabaseAdmin
      .from('players')
      .select('id, full_name, jersey_number, team_id')
      .eq('organization_id', organizationId)
      .in('team_id', [game.home_team_id, game.away_team_id]),
  ])

  const teamLookups: StatSheetTeamLookup[] = (teams ?? []).map((t) => ({
    id: t.id as string,
    name: String(t.name || 'Team'),
    side: t.id === game.home_team_id ? 'home' : 'away',
  }))

  const roster: StatSheetPlayerLookup[] = (players ?? []).map((p) => ({
    id: p.id as string,
    full_name: String(p.full_name || 'Player'),
    jersey_number: p.jersey_number != null ? String(p.jersey_number) : null,
    team_id: p.team_id as string,
  }))

  return { game, teams: teamLookups, roster }
}

function parseConfirmRows(raw: unknown): StatSheetConfirmRow[] {
  if (!Array.isArray(raw)) return []
  const out: StatSheetConfirmRow[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const player_id = typeof r.player_id === 'string' ? r.player_id.trim() : ''
    if (!player_id) continue
    const num = (k: string) => {
      const n = Number(r[k])
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
    }
    out.push({
      player_id,
      fg2m: num('fg2m'),
      fg3m: num('fg3m'),
      ftm: num('ftm'),
      pts: num('pts'),
      reb: num('reb'),
      ast: num('ast'),
      stl: num('stl'),
      blk: num('blk'),
      tov: num('tov'),
      pf: num('pf'),
    })
  }
  return out.slice(0, 40)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate = await requireOwnerOrgForDashboard(userId)
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('plan')
    .eq('id', gate.organizationId)
    .maybeSingle()

  if (!isProOrEnterprise(normalizeOrgPlan(org?.plan))) {
    return NextResponse.json({ error: PRO_MESSAGE }, { status: 403 })
  }

  const { gameId } = await params
  const ctx = await loadImportContext(gameId, gate.organizationId)
  if (!ctx) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Upload a file first.' }, { status: 400 })
    }
    const kind = detectStatSheetFileKind(file.name, file.type || '')
    if (!kind) {
      return NextResponse.json({ error: 'Use a .csv or .xlsx file.' }, { status: 400 })
    }
    const buffer = await file.arrayBuffer()
    const parsed = parseStatSheetUpload(buffer, kind)
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No player rows found in that file.' }, { status: 400 })
    }
    const rows = buildStatSheetPreview(parsed, ctx.teams, ctx.roster)
    const readyRows = rows.filter((r) => r.ready)
    return NextResponse.json({
      preview: true,
      rows,
      readyCount: readyRows.length,
      totalCount: rows.length,
    })
  }

  const body = await req.json().catch(() => null)
  if (body?.confirm === true) {
    const confirmRows = parseConfirmRows(body?.players)
    const allowed = new Set(ctx.roster.map((p) => p.id))
    const filtered = confirmRows.filter((r) => allowed.has(r.player_id))
    if (filtered.length === 0) {
      return NextResponse.json({ error: 'No valid player stats to save.' }, { status: 400 })
    }
    const result = await applyGameStatsBulkUpsert(
      supabaseAdmin,
      gameId,
      gate.organizationId,
      filtered
    )
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, saved: filtered.length })
  }

  const csv = typeof body?.csv === 'string' ? body.csv : ''
  if (!csv.trim()) {
    return NextResponse.json({ error: 'Upload a file first.' }, { status: 400 })
  }
  const parsed = parseStatSheetUpload(new TextEncoder().encode(csv).buffer, 'csv')
  const rows = buildStatSheetPreview(parsed, ctx.teams, ctx.roster)
  return NextResponse.json({
    preview: true,
    rows,
    readyCount: rows.filter((r) => r.ready).length,
    totalCount: rows.length,
  })
}
