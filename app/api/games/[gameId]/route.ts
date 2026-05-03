import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params

  const { data: game } = await supabaseAdmin
    .from('games').select('*').eq('id', gameId).single()

  return NextResponse.json({ game })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gameId } = await params
  const body = await req.json()

  const updates: any = {}
  if (body.game_clock !== undefined) updates.game_clock = body.game_clock
  if (body.period !== undefined) updates.period = body.period
  if (body.home_score !== undefined) updates.home_score = body.home_score
  if (body.away_score !== undefined) updates.away_score = body.away_score
  if (body.status !== undefined) updates.status = body.status

  const { error } = await supabaseAdmin.from('games').update(updates).eq('id', gameId)
  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ success: true })
}