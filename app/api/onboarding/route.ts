import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { normalizeSportTemplateId } from '@/lib/sport-templates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Not logged in.' }, { status: 401 })
    }

    const { name, sport_template_id: sportRaw } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'League name is required' }, { status: 400 })
    }

    const sport_template_id = normalizeSportTemplateId(sportRaw)

    // Basic plan gets a random number slug
    // Pro users can customize it later in Settings
    const basicSlug = `league-${Math.floor(100000 + Math.random() * 900000)}`

    let { error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        slug: basicSlug,
        clerk_user_id: userId,
        plan: 'basic',
        sport_template_id,
      })

    if (error) {
      const msg = String(error.message || '')
      if (msg.includes('sport_template_id') || msg.includes('schema cache')) {
        const retry = await supabaseAdmin.from('organizations').insert({
          name,
          slug: basicSlug,
          clerk_user_id: userId,
          plan: 'basic',
        })
        error = retry.error
      }
    }

    if (error) {
      return NextResponse.json({ error: 'Failed to create league.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}