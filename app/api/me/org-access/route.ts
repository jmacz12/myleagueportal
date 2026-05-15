import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser, getOrgAccessForClerkUserAndSlug } from '@/lib/org-access'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const slug = new URL(req.url).searchParams.get('slug')?.trim() || ''
  const access = slug
    ? await getOrgAccessForClerkUserAndSlug(userId, slug)
    : await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ access: null })

  return NextResponse.json({
    access: {
      organizationId: access.organization.id,
      slug: access.organization.slug,
      name: access.organization.name,
      logoUrl: access.organization.logo_url,
      role: access.role,
    },
  })
}
