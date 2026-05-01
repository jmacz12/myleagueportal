import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { full_name, email, phone, jersey_number, position, organization_id, season_id } = body

    if (!full_name || !organization_id || !season_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if email already registered for this season
    if (email) {
      const { data: existing } = await supabaseAdmin
        .from('players')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('season_id', season_id)
        .eq('email', email)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'This email is already registered for this season.' },
          { status: 400 }
        )
      }
    }

    // Insert the player
    const { error } = await supabaseAdmin
      .from('players')
      .insert({
        full_name,
        email: email || null,
        phone: phone || null,
        jersey_number: jersey_number ? parseInt(jersey_number) : null,
        position: position || null,
        organization_id,
        season_id,
        status: 'active',
      })

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json(
        { error: 'Failed to register. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}