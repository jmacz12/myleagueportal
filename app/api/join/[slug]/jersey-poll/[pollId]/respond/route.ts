import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normEmail(s: string) {
  return s.trim().toLowerCase()
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; pollId: string }> }
) {
  const { slug, pollId } = await params
  const body = await req.json()
  const emailRaw = body?.email as string | undefined
  const preferred = body?.preferred_number

  if (!emailRaw || preferred === undefined || preferred === null) {
    return NextResponse.json({ error: 'Email and preferred jersey number are required.' }, { status: 400 })
  }

  const parsed = parseInt(String(preferred), 10)
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 99) {
    return NextResponse.json({ error: 'Jersey number must be between 0 and 99.' }, { status: 400 })
  }

  const email = normEmail(emailRaw)
  if (!email) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const { data: poll, error: pollError } = await supabaseAdmin
    .from('jersey_polls')
    .select('id, team_id, organization_id, status')
    .eq('id', pollId)
    .single()

  if (pollError || !poll || poll.organization_id !== org.id) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  }

  if (poll.status !== 'open') {
    return NextResponse.json({ error: 'This poll is closed.' }, { status: 400 })
  }

  const { data: candidates, error: playerError } = await supabaseAdmin
    .from('players')
    .select('id, email, team_id')
    .eq('team_id', poll.team_id)

  if (playerError) {
    return NextResponse.json({ error: 'Unable to verify roster.' }, { status: 500 })
  }

  const player = (candidates || []).find(
    (p) => p.email && normEmail(p.email) === email
  )

  if (!player) {
    return NextResponse.json(
      {
        error:
          'No player on this team matches that email. Use the email you registered with, or ask your organizer.',
      },
      { status: 404 }
    )
  }

  const { data: existingRow } = await supabaseAdmin
    .from('jersey_poll_responses')
    .select('id')
    .eq('poll_id', poll.id)
    .eq('player_id', player.id)
    .maybeSingle()

  const now = new Date().toISOString()
  if (existingRow) {
    const { error: upd } = await supabaseAdmin
      .from('jersey_poll_responses')
      .update({ preferred_number: parsed, submitted_at: now })
      .eq('id', existingRow.id)
    if (upd) {
      return NextResponse.json({ error: 'Could not save your response. Try again.' }, { status: 500 })
    }
  } else {
    const { error: ins } = await supabaseAdmin.from('jersey_poll_responses').insert({
      poll_id: poll.id,
      player_id: player.id,
      preferred_number: parsed,
      submitted_at: now,
    })
    if (ins) {
      return NextResponse.json({ error: 'Could not save your response. Try again.' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
