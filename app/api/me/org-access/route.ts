import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getOrgAccessForClerkUser } from '@/lib/org-access'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return NextResponse.json({ access: null })

  return NextResponse.json({
    access: {
      organizationId: access.organization.id,
      slug: access.organization.slug,
      name: access.organization.name,
      role: access.role,
    },
  })
}
