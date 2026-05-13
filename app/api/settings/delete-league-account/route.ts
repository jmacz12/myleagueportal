import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOrgAccessForClerkUser } from '@/lib/org-access'
import { stripe } from '@/lib/stripe'
import { deleteOrganizationDatabaseRows, removeLeagueSiteFilesForOrg } from '@/lib/delete-organization-data'
import { DELETE_LEAGUE_ACCOUNT_CONFIRM_PHRASE } from '@/lib/delete-league-account-constants'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getOrgAccessForClerkUser(userId)
  if (!access || access.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only the league owner can delete the league and account.' },
      { status: 403 }
    )
  }

  let body: { confirm?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.confirm?.trim() !== DELETE_LEAGUE_ACCOUNT_CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        error: `Type the confirmation phrase exactly: ${DELETE_LEAGUE_ACCOUNT_CONFIRM_PHRASE}`,
      },
      { status: 400 }
    )
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .select('id, clerk_user_id, stripe_customer_id, stripe_subscription_id')
    .eq('id', access.organization.id)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  if (org.clerk_user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgId = org.id as string
  const subId = org.stripe_subscription_id as string | null | undefined
  const custId = org.stripe_customer_id as string | null | undefined

  if (subId) {
    try {
      await stripe.subscriptions.cancel(subId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!/no such subscription|already been canceled|resource_missing/i.test(msg)) {
        console.error('stripe subscriptions.cancel', e)
      }
    }
  }

  if (custId) {
    try {
      await stripe.customers.del(custId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!/no such customer|resource_missing/i.test(msg)) {
        console.error('stripe customers.del', e)
      }
    }
  }

  try {
    await removeLeagueSiteFilesForOrg(supabaseAdmin, orgId)
  } catch (e) {
    console.error('removeLeagueSiteFilesForOrg', e)
  }

  const dbResult = await deleteOrganizationDatabaseRows(supabaseAdmin, orgId)
  if (!dbResult.ok) {
    return NextResponse.json({ error: dbResult.message }, { status: 500 })
  }

  try {
    const client = await clerkClient()
    await client.users.deleteUser(userId)
  } catch (e) {
    console.error('clerk users.deleteUser', e)
    return NextResponse.json(
      {
        error:
          'League data was removed, but your sign-in account could not be deleted automatically. Contact support or delete the account from your identity provider.',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
