import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getTeamManagerAccess } from '@/lib/team-manager-access'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ canManage: false }, { status: 401 })

  const { teamId } = await params
  const access = await getTeamManagerAccess(userId, teamId)
  if (!access) return NextResponse.json({ canManage: false }, { status: 403 })

  return NextResponse.json({
    canManage: true,
    role: access.role,
    plan: access.plan,
    organizationId: access.organizationId,
  })
}
