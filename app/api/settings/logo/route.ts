import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgAccessForClerkUser } from '@/lib/org-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/** Upload a league logo (stored like league-site assets); updates organizations.logo_url */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const file = form.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Use JPG, PNG, WebP, or GIF' }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 5MB or smaller' }, { status: 400 })
  }

  const ext =
    file.type === 'image/jpeg'
      ? 'jpg'
      : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'gif'

  const path = `${access.organization.id}/logo-${crypto.randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await supabaseAdmin.storage.from('league-site').upload(path, buf, {
    contentType: file.type,
    upsert: false,
  })

  if (upErr) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: pub } = supabaseAdmin.storage.from('league-site').getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { error: dbErr } = await supabaseAdmin
    .from('organizations')
    .update({ logo_url: publicUrl })
    .eq('id', access.organization.id)

  if (dbErr) {
    return NextResponse.json({ error: 'Could not save logo URL' }, { status: 500 })
  }

  return NextResponse.json({ url: publicUrl, logo_url: publicUrl })
}

/** Remove league logo (falls back to initials on public pages until a new logo is uploaded). */
export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ error: 'No organization' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ logo_url: null })
    .eq('id', access.organization.id)

  if (error) return NextResponse.json({ error: 'Could not clear logo' }, { status: 500 })
  return NextResponse.json({ success: true })
}
