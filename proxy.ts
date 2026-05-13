import { NextResponse } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { shouldSkipCustomDomainMiddlewareLookup } from '@/lib/custom-domain'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/onboarding',
])

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/join(.*)',
  '/league(.*)',
  '/api/join(.*)',
  '/api/public(.*)',
  '/games(.*)',
])

async function resolveVerifiedCustomDomainLeagueSlug(hostLower: string): Promise<string | null> {
  if (shouldSkipCustomDomainMiddlewareLookup(hostLower)) return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('organizations')
    .select('slug')
    .eq('custom_domain', hostLower)
    .not('custom_domain_verified_at', 'is', null)
    .maybeSingle()

  if (error || !data?.slug) return null
  const s = String(data.slug).trim()
  return s || null
}

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get('host')?.split(':')[0]?.trim().toLowerCase() ?? ''
  const url = req.nextUrl.clone()
  const path = url.pathname
  if (host && (path === '/' || path === '') && !path.startsWith('/api/')) {
    const slug = await resolveVerifiedCustomDomainLeagueSlug(host)
    if (slug) {
      url.pathname = `/league/${slug}`
      return NextResponse.rewrite(url)
    }
  }

  if (!isPublicRoute(req) && isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
