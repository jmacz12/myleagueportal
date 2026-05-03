import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      full_name,
      email,
      phone,
      jersey_number,
      positions,
      organization_id,
      season_id,
      session_id,
      waiver_accepted,
      waiver_id,        // passed from the registration page
      guests,
    } = body

    if (!full_name || !organization_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get IP address for waiver signature record
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    // Helper: save a waiver signature row
    async function saveWaiverSignature(name: string, emailAddr: string | null) {
      if (!waiver_id) return
      await supabaseAdmin.from('waiver_signatures').insert({
        waiver_id,
        organization_id,
        full_name: name,
        email: emailAddr || null,
        ip_address: ip,
        signed_at: new Date().toISOString(),
      })
    }

    // ─── DROP-IN REGISTRATION PATH ────────────────────────────────────────────
    if (session_id) {
      if (email) {
        const { data: existing } = await supabaseAdmin
          .from('dropin_registrations')
          .select('id')
          .eq('session_id', session_id)
          .eq('email', email)
          .eq('is_guest', false)
          .maybeSingle()

        if (existing) {
          return NextResponse.json(
            { error: 'This email is already registered for this session.' },
            { status: 400 }
          )
        }
      }

      const { data: hostRow, error: hostError } = await supabaseAdmin
        .from('dropin_registrations')
        .insert({
          session_id,
          organization_id,
          full_name,
          email: email || null,
          positions: positions ?? [],
          waiver_accepted: waiver_accepted ?? false,
          is_guest: false,
          checked_in: false,
          payment_status: 'unpaid',
        })
        .select('id')
        .single()

      if (hostError || !hostRow) {
        console.error('Drop-in host insert error:', hostError)
        return NextResponse.json(
          { error: 'Failed to register. Please try again.' },
          { status: 500 }
        )
      }

      // Save waiver signature for host
      if (waiver_accepted) await saveWaiverSignature(full_name, email)

      // Insert guests
      if (Array.isArray(guests) && guests.length > 0) {
        const guestRows = guests.map((g: {
          full_name: string
          email?: string
          waiver_accepted?: boolean
        }) => ({
          session_id,
          organization_id,
          full_name: g.full_name,
          email: g.email || null,
          positions: [],
          waiver_accepted: g.waiver_accepted ?? false,
          is_guest: true,
          host_registration_id: hostRow.id,
          checked_in: false,
          payment_status: 'unpaid',
        }))

        const { error: guestError } = await supabaseAdmin
          .from('dropin_registrations')
          .insert(guestRows)

        if (guestError) {
          console.error('Guest insert error:', guestError)
          return NextResponse.json({
            success: true,
            warning: 'Registered successfully, but one or more guests could not be saved.',
          })
        }

        // Save waiver signatures for each guest who accepted
        for (const g of guests) {
          if (g.waiver_accepted) await saveWaiverSignature(g.full_name, g.email || null)
        }
      }

      return NextResponse.json({ success: true })
    }

    // ─── SEASON PLAYER REGISTRATION PATH ─────────────────────────────────────
    if (!season_id) {
      return NextResponse.json(
        { error: 'Missing season_id for player registration' },
        { status: 400 }
      )
    }

    if (email) {
      const { data: existing } = await supabaseAdmin
        .from('players')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('season_id', season_id)
        .eq('email', email)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'This email is already registered for this season.' },
          { status: 400 }
        )
      }
    }

    const { error: playerError } = await supabaseAdmin
      .from('players')
      .insert({
        full_name,
        email: email || null,
        phone: phone || null,
        jersey_number: jersey_number ? parseInt(jersey_number) : null,
        positions: positions ?? [],
        organization_id,
        season_id,
        waiver_accepted: waiver_accepted ?? false,
        status: 'active',
      })

    if (playerError) {
      console.error('Player insert error:', playerError)
      return NextResponse.json(
        { error: 'Failed to register. Please try again.' },
        { status: 500 }
      )
    }

    // Save waiver signature for player
    if (waiver_accepted) await saveWaiverSignature(full_name, email)

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}