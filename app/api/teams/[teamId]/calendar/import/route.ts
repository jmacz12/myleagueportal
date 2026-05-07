import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getTeamManagerAccess } from '@/lib/team-manager-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ImportRow = { title: string; starts_at: string; location: string | null }

function parseCsv(input: string): ImportRow[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []
  const rows: ImportRow[] = []
  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim())
    if (parts.length < 2) continue
    rows.push({
      title: parts[0],
      starts_at: parts[1],
      location: parts[2] || null,
    })
  }
  return rows
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { userId } = await auth()
  const { teamId } = await params
  const access = await getTeamManagerAccess(userId, teamId)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const csv = String(body?.csv || '').trim()
  if (!csv) return NextResponse.json({ error: 'CSV text is required' }, { status: 400 })

  const parsed = parseCsv(csv).slice(0, 100)
  if (parsed.length === 0) {
    return NextResponse.json({ error: 'No valid rows found. Use: title,starts_at,location' }, { status: 400 })
  }

  const rows = parsed.map((r) => ({
    organization_id: access.organizationId,
    team_id: teamId,
    title: r.title,
    starts_at: r.starts_at,
    location: r.location,
    source: 'csv-import',
    created_by_clerk_user_id: userId,
  }))

  const { error } = await supabaseAdmin.from('team_calendar_events').insert(rows)
  if (error) return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  return NextResponse.json({ inserted: rows.length })
}
