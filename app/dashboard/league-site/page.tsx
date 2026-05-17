'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { LeagueSiteAccessPanel } from '@/components/dashboard/LeagueSiteAccessPanel'
import { subscribeLeagueAppearanceUpdated } from '@/lib/league-appearance-sync'
import { getPublicSiteOrigin, publicFanSiteOrigin } from '@/lib/public-site-origin'

type EditorRow = {
  id: string
  clerk_user_id: string
  invited_email: string | null
  created_at: string
}

export default function LeagueSitePage() {
  return (
    <Suspense fallback={<p style={{ color: 'var(--sidebar-text)' }}>Loading…</p>}>
      <LeagueSitePageClient />
    </Suspense>
  )
}

function LeagueSitePageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState('')
  const [verifiedFanHostname, setVerifiedFanHostname] = useState<string | null>(null)
  const [role, setRole] = useState<'owner' | 'editor' | ''>('')
  const [orgPlan, setOrgPlan] = useState('basic')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const [editors, setEditors] = useState<EditorRow[]>([])
  const [editorEmail, setEditorEmail] = useState('')
  const [editorBusy, setEditorBusy] = useState(false)

  const fanSiteOrigin = useMemo(() => publicFanSiteOrigin(verifiedFanHostname), [verifiedFanHostname])
  const publicLeagueUrl = slug ? `${fanSiteOrigin}/league/${encodeURIComponent(slug)}` : ''
  const editWebsiteUrl = publicLeagueUrl ? `${publicLeagueUrl}?edit=1` : ''

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/league-site')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not load')
        return
      }
      setSlug(data.slug ?? '')
      setVerifiedFanHostname(
        typeof data.verifiedFanHostname === 'string' && data.verifiedFanHostname.trim()
          ? data.verifiedFanHostname.trim().toLowerCase()
          : null
      )
      setRole(data.role ?? '')
      setOrgPlan(typeof data.plan === 'string' ? data.plan : 'basic')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEditors = useCallback(async () => {
    const res = await fetch('/api/organization-editors')
    if (!res.ok) return
    const data = await res.json().catch(() => ({}))
    setEditors(Array.isArray(data.editors) ? data.editors : [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return subscribeLeagueAppearanceUpdated(() => {
      void load()
    })
  }, [load])

  useEffect(() => {
    if (role === 'owner') void loadEditors()
  }, [role, loadEditors])

  async function addEditor() {
    setEditorBusy(true)
    setError('')
    try {
      const res = await fetch('/api/organization-editors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: editorEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not add editor')
        return
      }
      setEditorEmail('')
      await loadEditors()
      setMessage('Editor added. They can use Edit website on your public league page after signing in.')
    } finally {
      setEditorBusy(false)
    }
  }

  async function removeEditor(clerkUserId: string) {
    setEditorBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/organization-editors?clerkUserId=${encodeURIComponent(clerkUserId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data.error === 'string' ? data.error : 'Remove failed')
        return
      }
      await loadEditors()
    } finally {
      setEditorBusy(false)
    }
  }

  function copyPublicUrl() {
    if (!publicLeagueUrl) return
    void navigator.clipboard.writeText(publicLeagueUrl).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return <p style={{ color: 'var(--sidebar-text)' }}>Loading…</p>
  }

  const activeTab =
    role === 'owner' && searchParams.get('section') === 'access' ? 'access' : 'website'
  const defaultPublicOrigin = getPublicSiteOrigin()

  return (
    <div style={{ maxWidth: '720px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: 'var(--sidebar-text-active)' }}>
        League website
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--sidebar-text)', margin: '0 0 24px', lineHeight: 1.55 }}>
        Preview your public league home, then open <strong>Edit website</strong> to change the hero, news blocks, and page
        sections — the same editor fans see, with <strong>Save draft</strong> and <strong>Publish</strong> on that page.
      </p>

      {role === 'owner' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
          <button
            type="button"
            onClick={() => router.replace('/dashboard/league-site')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: activeTab === 'website' ? '2px solid var(--sidebar-active-border)' : '1px solid var(--sidebar-border)',
              background: activeTab === 'website' ? 'var(--sidebar-active-bg)' : 'var(--bg-elevated, #fff)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--sidebar-text-active)',
            }}
          >
            Website
          </button>
          <button
            type="button"
            onClick={() => router.replace('/dashboard/league-site?section=access')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: activeTab === 'access' ? '2px solid var(--sidebar-active-border)' : '1px solid var(--sidebar-border)',
              background: activeTab === 'access' ? 'var(--sidebar-active-bg)' : 'var(--bg-elevated, #fff)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              color: 'var(--sidebar-text-active)',
            }}
          >
            Access & streams
          </button>
        </div>
      ) : null}

      {message ? <p style={{ fontSize: '13px', color: '#15803d', marginBottom: '12px' }}>{message}</p> : null}
      {error ? <p style={{ fontSize: '13px', color: '#b91c1c', marginBottom: '12px' }}>{error}</p> : null}

      {activeTab === 'website' ? (
        <>
          {publicLeagueUrl ? (
            <section
              style={{
                background: 'var(--bg-elevated, #fff)',
                border: '0.5px solid var(--sidebar-border)',
                borderRadius: '12px',
                padding: '18px',
                marginBottom: '18px',
              }}
            >
              <h2 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 10px' }}>Public league page</h2>
              <p style={{ fontSize: '13px', color: 'var(--sidebar-text)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Fan-facing URL{verifiedFanHostname ? ' (your custom domain)' : ''} — share this link with players and
                visitors.
              </p>
              <p
                style={{
                  margin: '0 0 14px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--sidebar-border)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--sidebar-text-active)',
                  wordBreak: 'break-all',
                }}
              >
                {publicLeagueUrl}
              </p>
              {verifiedFanHostname ? (
                <p style={{ fontSize: '12px', color: 'var(--sidebar-text)', margin: '0 0 12px', lineHeight: 1.45 }}>
                  Default portal URL: {defaultPublicOrigin}/league/{slug}
                </p>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <Link
                  href={editWebsiteUrl}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    background: 'var(--sidebar-active-border)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '14px',
                    textDecoration: 'none',
                    boxShadow: '0 6px 18px -8px rgba(0,0,0,0.35)',
                  }}
                >
                  Edit website
                </Link>
                <Link
                  href={publicLeagueUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--sidebar-border)',
                    background: 'var(--bg-elevated, #fff)',
                    fontWeight: 700,
                    fontSize: '14px',
                    textDecoration: 'none',
                    color: 'var(--sidebar-text-active)',
                  }}
                >
                  <ExternalLink size={16} aria-hidden />
                  View as fan
                </Link>
                <button
                  type="button"
                  onClick={copyPublicUrl}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--sidebar-border)',
                    background: 'transparent',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    color: 'var(--sidebar-text-active)',
                  }}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>

              <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--sidebar-text)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Preview
              </p>
              <div
                style={{
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid var(--sidebar-border)',
                  background: '#f4f4f5',
                }}
              >
                <iframe
                  title="League website preview"
                  src={publicLeagueUrl}
                  style={{ display: 'block', width: '100%', height: 'min(520px, 70vh)', border: 'none' }}
                />
              </div>
            </section>
          ) : (
            <p style={{ fontSize: '14px', color: 'var(--sidebar-text)' }}>Set your league URL in Settings first.</p>
          )}
        </>
      ) : (
        <LeagueSiteAccessPanel
          slug={slug}
          fanSiteOrigin={fanSiteOrigin}
          orgPlan={orgPlan}
          editors={editors}
          editorEmail={editorEmail}
          setEditorEmail={setEditorEmail}
          addEditor={addEditor}
          removeEditor={removeEditor}
          editorBusy={editorBusy}
        />
      )}
    </div>
  )
}
