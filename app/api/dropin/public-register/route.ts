import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { sessionId, organizationId, firstName, lastName, email } = await req.json()

    if (!sessionId || !firstName || !lastName || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Check current capacity
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('capacity')
      .eq('id', sessionId)
      .single()

    const { count } = await supabaseAdmin
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)

    if (session && count !== null && count >= session.capacity) {
      return NextResponse.json({ error: 'This session is full' }, { status: 400 })
    }

    // 2. Register the player
    const { error: regError } = await supabaseAdmin
      .from('registrations')
      .insert([{
        session_id: sessionId,
        organization_id: organizationId,
        first_name: firstName,
        last_name: lastName,
        email: email,
        status: 'unpaid' // Organizers collect cash/e-transfer manually
      }])

    if (regError) throw regError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('REGISTRATION_ERROR', error)
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 })
  }
}