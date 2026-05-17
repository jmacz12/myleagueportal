import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { requireOwnerOrgForDashboard } from '@/lib/org-access'
import { isProOrEnterprise, normalizeOrgPlan } from '@/lib/org-plan-tier'
import {
  buildScheduleDownloadTemplate,
  buildScheduleDownloadTemplateXlsx,
} from '@/lib/games-schedule-import'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRO_IMPORT_MESSAGE =
  'Schedule templates and file import are included on Pro and Enterprise. Upgrade under Dashboard → Settings → Plan.'

export async function GET(req: Request) {
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
    return NextResponse.json({ error: PRO_IMPORT_MESSAGE }, { status: 403 })
  }

  const seasonId = new URL(req.url).searchParams.get('season_id')?.trim() ?? ''
  const format = new URL(req.url).searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'

  if (!seasonId) {
    return NextResponse.json({ error: 'season_id is required' }, { status: 400 })
  }

  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('id, name')
    .eq('id', seasonId)
    .eq('organization_id', gate.organizationId)
    .maybeSingle()

  if (!season) {
    return NextResponse.json({ error: 'Season not found for this league' }, { status: 404 })
  }

  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('name')
    .eq('organization_id', gate.organizationId)
    .eq('season_id', seasonId)
    .order('name')

  const teamNames = (teams ?? []).map((t) => String(t.name ?? '').trim()).filter(Boolean)
  const safeSeason = String(season.name ?? 'season')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'season'

  if (format === 'xlsx') {
    const body = await buildScheduleDownloadTemplateXlsx(teamNames)
    return new NextResponse(Buffer.from(body), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="schedule-template-${safeSeason}.xlsx"`,
      },
    })
  }

  const csv = buildScheduleDownloadTemplate(teamNames)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="schedule-template-${safeSeason}.csv"`,
    },
  })
}
