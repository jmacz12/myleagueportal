import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureDropinPlayerLinkedToReputation } from '@/lib/dropin-reputation'

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
      positions,
      organization_id,
      season_id,
      session_id,
      waiver_accepted,
      waiver_id,        // passed from the registration page
      guests,
    } = body

    // Public registration UI uses PG/SG/SF/PF/C codes, while roster records
    // are stored as Guard/Forward/Center in existing seed/admin flows.
    function normalizePositions(raw: unknown): string[] {
      if (!Array.isArray(raw)) return []
      const mapped = raw
        .map((p) => String(p).trim().toUpperCase())
        .map((p) => {
          if (p === 'PG' || p === 'SG') return 'Guard'
          if (p === 'SF' || p === 'PF') return 'Forward'
          if (p === 'C') return 'Center'
          return p
        })
        .filter(Boolean)
      return [...new Set(mapped)]
    }

    const normalizedPositions = normalizePositions(positions)
    const sanitizedPhone = typeof phone === 'string' ? phone.replace(/\D/g, '') : ''

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
      const { data: sessionRow, error: sessionLookupErr } = await supabaseAdmin
        .from('dropin_sessions')
        .select('id, organization_id, status, max_players, max_waitlist')
        .eq('id', session_id)
        .single()

      if (sessionLookupErr || !sessionRow) {
        return NextResponse.json({ error: 'This session is not available for registration.' }, { status: 400 })
      }
      if (sessionRow.organization_id !== organization_id) {
        return NextResponse.json({ error: 'Session does not belong to this league.' }, { status: 400 })
      }
      if (sessionRow.status !== 'upcoming') {
        return NextResponse.json({ error: 'This session is no longer open for sign-ups.' }, { status: 400 })
      }

      const maxPlayers = Number(sessionRow.max_players) || 0
      const maxWaitlist = Number(sessionRow.max_waitlist) || 0

      const { count: rosterCount } = await supabaseAdmin
        .from('dropin_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session_id)
        .eq('is_guest', false)
        .eq('is_waitlist', false)

      const { count: waitlistCount } = await supabaseAdmin
        .from('dropin_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session_id)
        .eq('is_guest', false)
        .eq('is_waitlist', true)

      const rosterFull = maxPlayers > 0 && rosterCount != null && rosterCount >= maxPlayers
      const waitlistFull =
        maxWaitlist > 0 && waitlistCount != null && waitlistCount >= maxWaitlist

      if (rosterFull) {
        if (maxWaitlist <= 0) {
          return NextResponse.json({ error: 'This session is full.' }, { status: 400 })
        }
        if (waitlistFull) {
          return NextResponse.json(
            { error: 'This session and waitlist are full.' },
            { status: 400 }
          )
        }
      }

      const addToWaitlist = rosterFull && maxWaitlist > 0

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
          positions: normalizedPositions,
          waiver_accepted: waiver_accepted ?? false,
          is_guest: false,
          checked_in: false,
          payment_status: 'unpaid',
          is_waitlist: addToWaitlist,
        })
        .select('id')
        .single()

      if (hostError || !hostRow) {
        console.error('Drop-in host insert error:', hostError)
        const code = (hostError as { code?: string } | null)?.code
        const msg = (hostError as { message?: string } | null)?.message || ''
        if (code === '23505' || /duplicate|unique/i.test(msg)) {
          return NextResponse.json(
            { error: 'You are already registered for this session (or this email is already on the list).' },
            { status: 400 }
          )
        }
        return NextResponse.json(
          {
            error: 'Failed to register. Please try again.',
            detail: process.env.NODE_ENV === 'development' ? msg : undefined,
          },
          { status: 500 }
        )
      }

      await ensureDropinPlayerLinkedToReputation(supabaseAdmin, {
        organizationId: organization_id,
        email,
        fullName: typeof full_name === 'string' ? full_name : '',
        positions: normalizedPositions,
      })

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

        for (const g of guests) {
          const ge = typeof g.email === 'string' ? g.email : ''
          if (ge.trim()) {
            await ensureDropinPlayerLinkedToReputation(supabaseAdmin, {
              organizationId: organization_id,
              email: ge,
              fullName: typeof g.full_name === 'string' ? g.full_name : 'Guest',
              positions: [],
            })
          }
        }
      }

      return NextResponse.json({ success: true, waitlist: addToWaitlist })
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

    const playerInsertBase = {
      full_name,
      email: email || null,
      phone: sanitizedPhone || null,
      /** Assigned later by organizer (dashboard) or future team jersey poll */
      jersey_number: null,
      positions: normalizedPositions,
      organization_id,
      season_id,
      status: 'active',
    }

    let playerError: { code?: string; message?: string } | null = null

    const withWaiverAttempt = await supabaseAdmin
      .from('players')
      .insert({
        ...playerInsertBase,
        waiver_accepted: waiver_accepted ?? false,
      })

    if (withWaiverAttempt.error) {
      const msg = String(withWaiverAttempt.error.message || '')
      if (/waiver_accepted|schema cache|column/i.test(msg)) {
        // Backward-compatible fallback for databases where players.waiver_accepted
        // has not been added yet.
        const fallbackAttempt = await supabaseAdmin
          .from('players')
          .insert(playerInsertBase)
        playerError = fallbackAttempt.error as { code?: string; message?: string } | null
      } else {
        playerError = withWaiverAttempt.error as { code?: string; message?: string } | null
      }
    }

    if (playerError) {
      console.error('Player insert error:', playerError)
      return NextResponse.json(
        {
          error: 'Failed to register. Please try again.',
          detail: process.env.NODE_ENV === 'development'
            ? (playerError as { message?: string } | null)?.message
            : undefined,
        },
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