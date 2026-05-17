import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwnerOrgForDashboard } from '@/lib/org-access'
import { isProOrEnterprise, normalizeOrgPlan } from '@/lib/org-plan-tier'
import {
  buildGameStatSheetTemplateCsv,
  buildGameStatSheetTemplateXlsx,
  type StatSheetTemplatePlayer,
} from '@/lib/game-stats-sheet-template'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRO_MESSAGE =
  'Stat sheet download and upload are included on Pro and Enterprise. Upgrade under Dashboard → Settings → Plan, or enter stats live under Games.'

async function loadGameContext(gameId: string, organizationId: string) {
  const { data: game } = await supabaseAdmin
    .from('games')
    .select('id, home_team_id, away_team_id, scheduled_at, home_score, away_score, status')
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
      .in('team_id', [game.home_team_id, game.away_team_id])
      .order('jersey_number'),
  ])

  const teamName = new Map((teams ?? []).map((t) => [t.id as string, String(t.name || '')]))
  const homeName = teamName.get(game.home_team_id) || 'Home'
  const awayName = teamName.get(game.away_team_id) || 'Away'

  const templatePlayers: StatSheetTemplatePlayer[] = (players ?? []).map((p) => ({
    jersey_number: p.jersey_number != null ? String(p.jersey_number) : null,
    full_name: String(p.full_name || 'Player'),
    team_label: p.team_id === game.home_team_id ? 'Home' : 'Away',
  }))

  templatePlayers.sort((a, b) => {
    if (a.team_label !== b.team_label) return a.team_label === 'Home' ? -1 : 1
    const an = Number(a.jersey_number)
    const bn = Number(b.jersey_number)
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn
    return a.full_name.localeCompare(b.full_name)
  })

  const when = game.scheduled_at
    ? new Date(game.scheduled_at).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'TBD'

  return {
    game,
    gameLabel: `${awayName} @ ${homeName} — ${when}`,
    templatePlayers,
    homeName,
    awayName,
  }
}

export async function GET(
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
  const format = new URL(req.url).searchParams.get('format') === 'csv' ? 'csv' : 'xlsx'
  const ctx = await loadGameContext(gameId, gate.organizationId)
  if (!ctx) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 })
  }

  const safeName = `${ctx.awayName}-at-${ctx.homeName}`
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48)

  if (format === 'csv') {
    const csv = buildGameStatSheetTemplateCsv(ctx.templatePlayers)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="stats-${safeName}.csv"`,
      },
    })
  }

  const body = await buildGameStatSheetTemplateXlsx({
    gameLabel: ctx.gameLabel,
    players: ctx.templatePlayers,
  })

  return new NextResponse(Buffer.from(body), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="stats-${safeName}.xlsx"`,
    },
  })
}
