import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = await params

  const { data: session } = await supabaseAdmin
    .from('dropin_sessions').select('*').eq('id', sessionId).single()

  const { data: registrations } = await supabaseAdmin
    .from('dropin_registrations').select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ session, registrations: registrations || [] })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { registration_id, checked_in, payment_status } = await req.json()

  const updates: any = {}
  if (checked_in !== undefined) updates.checked_in = checked_in
  if (payment_status !== undefined) updates.payment_status = payment_status

  const { error } = await supabaseAdmin
    .from('dropin_registrations').update(updates).eq('id', registration_id)

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  return NextResponse.json({ success: true })
}