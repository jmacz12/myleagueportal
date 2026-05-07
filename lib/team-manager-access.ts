import { createClient } from '@supabase/supabase-js'
import { getOrgAccessForClerkUser } from '@/lib/org-access'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getTeamManagerAccess(
  userId: string | null | undefined,
  teamId: string
): Promise<{
  organizationId: string
  teamId: string
  plan: string
  role: 'owner' | 'editor' | 'manager'
} | null> {
  if (!userId || !teamId) return null
  const access = await getOrgAccessForClerkUser(userId)
  if (!access) return null

  const [{ data: team }, { data: org }] = await Promise.all([
    supabaseAdmin
      .from('teams')
      .select('id, organization_id')
      .eq('id', teamId)
      .maybeSingle(),
    supabaseAdmin
      .from('organizations')
      .select('id, plan')
      .eq('id', access.organization.id)
      .maybeSingle(),
  ])

  if (!team || !org || team.organization_id !== access.organization.id) return null

  return {
    organizationId: access.organization.id,
    teamId: team.id,
    plan: String(org.plan || 'basic').toLowerCase(),
    role: access.role === 'owner' || access.role === 'editor' ? access.role : 'manager',
  }
}
