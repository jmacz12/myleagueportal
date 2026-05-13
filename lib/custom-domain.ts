/**
 * Pro / Enterprise custom fan domain (DNS TXT verification + Host routing).
 * This module is Edge-safe (no Node dns/url).
 */

export const MLP_DOMAIN_TXT_LABEL = '_mlp-domain-verify'

export function customDomainTxtFqdn(hostname: string): string {
  const h = hostname.trim().toLowerCase()
  return `${MLP_DOMAIN_TXT_LABEL}.${h}`
}

export function collectDefaultApplicationHosts(): string[] {
  const out = new Set<string>(['localhost', '127.0.0.1'])
  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_PUBLIC_SITE_URL]) {
    if (!raw) continue
    try {
      out.add(new URL(raw.trim()).hostname.toLowerCase())
    } catch {
      /* ignore */
    }
  }
  for (const x of (process.env.CUSTOM_DOMAIN_RESERVED_HOSTS || '').split(',')) {
    const t = x.trim().toLowerCase()
    if (t) out.add(t)
  }
  return [...out]
}

export function isApplicationPrimaryHost(hostnameLower: string): boolean {
  return collectDefaultApplicationHosts().includes(hostnameLower)
}

export function shouldSkipCustomDomainMiddlewareLookup(hostLower: string): boolean {
  if (!hostLower) return true
  if (isApplicationPrimaryHost(hostLower)) return true
  if (hostLower.endsWith('.vercel.app')) return true
  return false
}

/** Loose client-side hint; authoritative validation is on the server. */
export function looksLikeValidHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0] ?? ''
  if (h.length < 4 || h.length > 253) return false
  if (h.startsWith('.') || h.endsWith('.') || h.includes('..')) return false
  if (!/^[\w.-]+$/.test(h)) return false
  const labels = h.split('.')
  if (labels.length < 2) return false
  if (labels.some((l) => l.length === 0 || l.length > 63)) return false
  const tld = labels[labels.length - 1]!
  if (tld.length < 2 || !/^[a-z0-9]+$/i.test(tld)) return false
  return true
}

export function suggestedCnameTargetHostname(): string {
  const raw = process.env.CUSTOM_DOMAIN_CNAME_TARGET?.trim()
  if (raw) {
    try {
      if (raw.includes('://')) return new URL(raw).hostname.toLowerCase()
    } catch {
      /* fall through */
    }
    const bare = raw.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0]?.trim().toLowerCase()
    if (bare) return bare
  }
  try {
    return new URL(process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || 'https://www.myleagueportal.com').hostname.toLowerCase()
  } catch {
    return 'www.myleagueportal.com'
  }
}
