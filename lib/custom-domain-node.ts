import { domainToASCII } from 'node:url'
import { resolveTxt } from 'node:dns/promises'
import { customDomainTxtFqdn, isApplicationPrimaryHost, looksLikeValidHostname } from '@/lib/custom-domain'

export function toAsciiHostname(input: string): string | null {
  const trimmed = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
  const host = trimmed.split('/')[0]?.split(':')[0]?.trim() ?? ''
  if (!host) return null
  try {
    return domainToASCII(host).toLowerCase()
  } catch {
    return null
  }
}

export function validateOrgCustomDomainHostname(input: string): { ok: true; hostname: string } | { ok: false; error: string } {
  const ascii = toAsciiHostname(input)
  if (!ascii) return { ok: false, error: 'Enter a valid hostname (e.g. www.yourleague.com).' }
  if (!looksLikeValidHostname(ascii)) return { ok: false, error: 'That hostname does not look valid.' }
  if (isApplicationPrimaryHost(ascii)) {
    return { ok: false, error: 'That hostname is reserved for the platform.' }
  }
  return { ok: true, hostname: ascii }
}

export async function dnsTxtContainsToken(hostname: string, token: string): Promise<boolean> {
  const fqdn = customDomainTxtFqdn(hostname)
  try {
    const rows = await resolveTxt(fqdn)
    for (const arr of rows) {
      if (arr.join('') === token) return true
    }
  } catch {
    return false
  }
  return false
}
