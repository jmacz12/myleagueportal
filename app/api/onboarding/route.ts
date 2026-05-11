import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

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

    const { name } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'League name is required' }, { status: 400 })
    }

    // Basic plan gets a random number slug
    // Pro users can customize it later in Settings
    const basicSlug = `league-${Math.floor(100000 + Math.random() * 900000)}`

    const { error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        slug: basicSlug,
        clerk_user_id: userId,
        plan: 'basic',
      })

    if (error) {
      return NextResponse.json({ error: 'Failed to create league.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}