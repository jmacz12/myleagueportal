'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { DashboardPlanLockedHint } from '@/components/dashboard/DashboardPlanLockedHint'
import { publicFanSiteOrigin } from '@/lib/public-site-origin'
import { looksLikeValidHostname } from '@/lib/custom-domain'

type CustomDomainPayload = {
  planOk: boolean
  verifiedHostname: string | null
  pendingHostname: string | null
  verificationToken: string | null
  txtFqdn: string | null
  cnameTarget: string
  verifiedAt?: string | null
}

export function CustomDomainPanel({
  plan,
  slug,
  onVerifiedHostname,
}: {
  plan: string
  slug: string
  onVerifiedHostname?: (hostname: string | null) => void
}) {
  const tierOk = plan === 'pro' || plan === 'enterprise'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [payload, setPayload] = useState<CustomDomainPayload | null>(null)
  const [hostnameInput, setHostnameInput] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/settings/custom-domain')
      const data = (await res.json().catch(() => null)) as (CustomDomainPayload & { error?: string }) | null
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Could not load domain settings')
        setPayload(null)
        return
      }
      if (!data || typeof data.planOk !== 'boolean') {
        setError('Unexpected response from the server. Try again in a moment.')
        setPayload(null)
        return
      }
      setPayload(data)
      setHostnameInput(data.pendingHostname || data.verifiedHostname || '')
      onVerifiedHostname?.(data.verifiedHostname || null)
    } catch {
      setError('Network error — check your connection and try again.')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [onVerifiedHostname])

  useEffect(() => {
    void load()
  }, [load])

  async function putHostname(value: string) {
    if (!tierOk) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const trimmed = value.trim()
      if (trimmed && !looksLikeValidHostname(trimmed)) {
        setError('Enter a hostname like www.yourleague.com (no https://).')
        return
      }
      const res = await fetch('/api/settings/custom-domain', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Save failed')
        return
      }
      if (data.cleared) {
        setMessage('Custom domain disconnected.')
        onVerifiedHostname?.(null)
      } else {
        setMessage('Hostname saved. Add the DNS records below, wait for DNS, then click Verify.')
      }
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function saveHostname() {
    await putHostname(hostnameInput)
  }

  async function clearDomain() {
    setHostnameInput('')
    await putHostname('')
  }

  async function verifyDns() {
    if (!tierOk) return
    setVerifying(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/settings/custom-domain', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Verification failed')
        return
      }
      setMessage(
        'Domain verified. Fans can use your hostname once TLS is active on your host (see hosting note below).'
      )
      await load()
    } finally {
      setVerifying(false)
    }
  }

  if (!tierOk) {
    return (
      <div className="card" style={{ marginBottom: '16px' }}>
        <DashboardPlanLockedHint feature="point your own domain at your public league and join links (DNS verification)" />
        <span className="label" style={{ display: 'block', marginBottom: '6px' }}>
          Custom fan domain
        </span>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.55 }}>
          Use a hostname you control (often <code style={{ fontSize: '12px' }}>www.</code> on your registrar). After DNS
          and HTTPS work, visitors land on your league home the same as <strong>/league/{slug}</strong> on the portal.
        </p>
        <div style={{ opacity: 0.55, pointerEvents: 'none' }}>
          <label className="label">Hostname</label>
          <input type="text" className="input" disabled placeholder="www.yourleague.com" />
          <button type="button" className="btn-primary" style={{ fontSize: '12px', padding: '7px 14px', marginTop: '10px' }} disabled>
            Save hostname
          </button>
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--border)',
              borderRadius: '10px',
              padding: '14px',
              fontSize: '12px',
              lineHeight: 1.55,
              marginTop: '14px',
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: '8px', fontSize: '13px' }}>1. Point traffic (CNAME)</div>
            <p style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>
              Add a <strong>CNAME</strong> from your hostname to the portal target shown here after you upgrade.
            </p>
            <div style={{ fontWeight: 800, marginBottom: '8px', fontSize: '13px' }}>2. Prove ownership (TXT)</div>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              Add a TXT record to verify you control the domain.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Loader2 size={18} className="animate-spin" aria-hidden />
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading domain settings…</span>
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="card" style={{ marginBottom: '16px' }}>
        <span className="label" style={{ display: 'block', marginBottom: '8px' }}>
          Custom fan domain
        </span>
        <p style={{ fontSize: '13px', color: '#b91c1c', margin: '0 0 12px', lineHeight: 1.5 }}>
          {error || 'Could not load domain settings.'}
        </p>
        <button
          type="button"
          className="btn-secondary"
          style={{ fontSize: '12px', padding: '7px 14px' }}
          onClick={() => void load()}
        >
          Try again
        </button>
        {error?.includes('migration') || error?.includes('columns') ? (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '10px 0 0', lineHeight: 1.45 }}>
            If this mentions missing database columns, run pending migrations (e.g.{' '}
            <code style={{ fontSize: '11px' }}>npm run db:apply-pending</code>) on your Supabase project.
          </p>
        ) : null}
      </div>
    )
  }

  const verified = !!payload.verifiedHostname
  const fanOrigin = publicFanSiteOrigin(payload.verifiedHostname)
  const labels = hostnameInput.trim().split('.').filter(Boolean)
  const cnameName = labels.length > 2 ? labels[0] : '@'

  return (
    <div className="card" style={{ marginBottom: '16px' }}>
      <span className="label" style={{ display: 'block', marginBottom: '6px' }}>
        Custom fan domain (Pro & Enterprise)
      </span>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.55 }}>
        Use a hostname you control (often <code style={{ fontSize: '12px' }}>www.</code> on your registrar). After DNS
        and HTTPS work, visitors opening <strong>https://{hostnameInput.trim() || 'your-host'}/</strong> land on your
        league home the same as <strong>/league/{slug}</strong> on the portal.
      </p>

      {error ? (
        <div
          style={{
            marginBottom: '12px',
            background: '#fef2f2',
            border: '0.5px solid #fecaca',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '12px',
            color: '#b91c1c',
            lineHeight: 1.45,
          }}
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div
          style={{
            marginBottom: '12px',
            background: '#f0fdf4',
            border: '0.5px solid #bbf7d0',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '12px',
            color: '#15803d',
            lineHeight: 1.45,
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <label className="label">Hostname</label>
        <input
          type="text"
          className="input"
          value={hostnameInput}
          onChange={(e) => setHostnameInput(e.target.value.trim().toLowerCase())}
          placeholder="www.yourleague.com"
          disabled={verified}
          autoComplete="off"
          spellCheck={false}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            className="btn-primary"
            style={{ fontSize: '12px', padding: '7px 14px' }}
            disabled={saving || verifying || verified}
            onClick={() => void saveHostname()}
          >
            {saving ? 'Saving…' : 'Save hostname'}
          </button>
          {!verified && payload.pendingHostname ? (
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '7px 14px' }}
              disabled={saving || verifying}
              onClick={() => void verifyDns()}
            >
              {verifying ? 'Checking DNS…' : 'Verify DNS'}
            </button>
          ) : null}
          {verified || payload.pendingHostname ? (
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '12px', padding: '7px 14px', color: '#b91c1c', borderColor: '#fecaca' }}
              disabled={saving || verifying}
              onClick={() => void clearDomain()}
            >
              Disconnect
            </button>
          ) : null}
        </div>
      </div>

      {!verified && (payload.txtFqdn || payload.verificationToken) ? (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '0.5px solid var(--border)',
            borderRadius: '10px',
            padding: '14px',
            fontSize: '12px',
            lineHeight: 1.55,
            marginBottom: '12px',
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: '8px', fontSize: '13px' }}>1. Point traffic (CNAME)</div>
          <p style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>
            At your DNS host, create a <strong>CNAME</strong> from your public hostname to the portal (apex domains may
            need a flattened <strong>ALIAS</strong> / ANAME per your provider):
          </p>
          <ul style={{ margin: '0 0 12px', paddingLeft: '18px', color: 'var(--text-primary)' }}>
            <li>
              <strong>Name / host:</strong> <code>{cnameName}</code> (or <code>@</code> for root — depends on DNS UI)
            </li>
            <li>
              <strong>Target:</strong> <code>{payload.cnameTarget}</code>
            </li>
          </ul>
          <div style={{ fontWeight: 800, marginBottom: '8px', fontSize: '13px' }}>2. Prove ownership (TXT)</div>
          <p style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>
            Add this TXT record exactly (one string, no quotes in the value):
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-primary)' }}>
            <li>
              <strong>Name / host:</strong> <code>{payload.txtFqdn ?? '_mlp-domain-verify'}</code>
            </li>
            <li>
              <strong>Value:</strong> <code>{payload.verificationToken}</code>
            </li>
          </ul>
        </div>
      ) : null}

      {verified ? (
        <div style={{ fontSize: '13px', lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong>Verified:</strong> <code>{payload.verifiedHostname}</code>
          </p>
          <p style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>
            Fan site base URL:{' '}
            <a href={fanOrigin} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
              {fanOrigin}
            </a>
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
            <strong>HTTPS:</strong> add this hostname to your deployment (e.g. Vercel → Project → Domains) so a
            certificate is issued. This page only verifies DNS and routes traffic once TLS terminates on your app.
          </p>
        </div>
      ) : null}
    </div>
  )
}
