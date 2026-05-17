'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search } from 'lucide-react'

type LeagueHit = { id: string; name: string; slug: string }
type TeamHit = { id: string; name: string; leagueSlug: string; leagueName: string }

type LandingLeagueSearchProps = {
  /** `hero` = directly under the homepage headline (dark background). */
  tone?: 'hero' | 'default'
}

export function LandingLeagueSearch({ tone = 'default' }: LandingLeagueSearchProps) {
  const onHero = tone === 'hero'
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [leagues, setLeagues] = useState<LeagueHit[]>([])
  const [teams, setTeams] = useState<TeamHit[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 320)
    return () => window.clearTimeout(t)
  }, [q])

  const runSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setLeagues([])
      setTeams([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/league-search?q=${encodeURIComponent(term)}`, {
        cache: 'no-store',
      })
      const json = (await res.json().catch(() => null)) as
        | { leagues?: LeagueHit[]; teams?: TeamHit[]; error?: string }
        | null
      if (!res.ok) {
        setLeagues([])
        setTeams([])
        setError(typeof json?.error === 'string' ? json.error : 'Search failed')
        return
      }
      setLeagues(Array.isArray(json?.leagues) ? json.leagues : [])
      setTeams(Array.isArray(json?.teams) ? json.teams : [])
    } catch {
      setLeagues([])
      setTeams([])
      setError('Search failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounced.length < 2) {
      setLeagues([])
      setTeams([])
      setLoading(false)
      return
    }
    void runSearch(debounced)
  }, [debounced, runSearch])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const hasResults = leagues.length > 0 || teams.length > 0
  const showPanel = open && debounced.length >= 2

  return (
    <section
      style={
        onHero
          ? { padding: '4px 0 20px', width: '100%' }
          : {
              background: '#ebe4d4',
              borderTop: '0.5px solid #d4c9a8',
              borderBottom: '0.5px solid #d4c9a8',
              padding: '28px 24px',
            }
      }
      aria-labelledby={`${listId}-heading`}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }} ref={wrapRef}>
        <h2
          id={`${listId}-heading`}
          style={{
            fontSize: onHero ? 'clamp(17px, 2.5vw, 20px)' : '15px',
            fontWeight: '800',
            color: onHero ? '#f2ead6' : '#1a1a0a',
            marginBottom: '10px',
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
        >
          Find a league or team
        </h2>
        <p
          style={{
            fontSize: '13px',
            color: onHero ? 'rgba(242,234,214,0.82)' : '#6b5e3a',
            textAlign: 'center',
            margin: '0 0 14px',
            lineHeight: 1.5,
          }}
        >
          Fans: search by name and jump straight to a league home or team page.
        </p>
        <div style={{ position: 'relative' }}>
          <label htmlFor={`${listId}-input`} className="sr-only">
            Search leagues and teams
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'white',
              border: '0.5px solid #d4c9a8',
              borderRadius: '12px',
              padding: '4px 4px 4px 14px',
              boxShadow: '0 1px 2px rgba(26,26,10,0.06)',
            }}
          >
            <Search size={18} style={{ color: '#6b5e3a', flexShrink: 0 }} aria-hidden />
            <input
              id={`${listId}-input`}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="League or team name"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '15px',
                padding: '12px 8px',
                background: 'transparent',
                color: '#1a1a0a',
                minWidth: 0,
              }}
            />
          </div>

          {showPanel ? (
            <div
              id={`${listId}-results`}
              role="listbox"
              aria-label="Search results"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 'calc(100% + 6px)',
                background: 'white',
                border: '0.5px solid #d4c9a8',
                borderRadius: '12px',
                maxHeight: 'min(60vh, 360px)',
                overflowY: 'auto',
                zIndex: 50,
                boxShadow: '0 8px 24px rgba(26,26,10,0.12)',
              }}
            >
              {loading ? (
                <div style={{ padding: '14px 16px', fontSize: '13px', color: '#6b5e3a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  Searching…
                </div>
              ) : error ? (
                <div style={{ padding: '14px 16px', fontSize: '13px', color: '#8b2942' }}>{error}</div>
              ) : !hasResults ? (
                <div style={{ padding: '14px 16px', fontSize: '13px', color: '#6b5e3a' }}>No matches yet—try another spelling.</div>
              ) : (
                <>
                  {leagues.length > 0 ? (
                    <div style={{ padding: '8px 0' }}>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          letterSpacing: '0.08em',
                          color: '#9a8c6a',
                          padding: '4px 16px 6px',
                        }}
                      >
                        LEAGUES
                      </div>
                      {leagues.map((L) => (
                        <Link
                          key={L.id}
                          href={`/league/${encodeURIComponent(L.slug)}`}
                          role="option"
                          onClick={() => setOpen(false)}
                          style={{
                            display: 'block',
                            padding: '10px 16px',
                            textDecoration: 'none',
                            color: '#1a1a0a',
                            fontSize: '14px',
                            fontWeight: '600',
                            borderTop: '0.5px solid #eee8d4',
                          }}
                        >
                          {L.name}
                          <span
                            style={{
                              display: 'block',
                              fontSize: '12px',
                              fontWeight: '500',
                              color: '#6b5e3a',
                              marginTop: '2px',
                            }}
                          >
                            League home
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {teams.length > 0 ? (
                    <div style={{ padding: '8px 0' }}>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          letterSpacing: '0.08em',
                          color: '#9a8c6a',
                          padding: '4px 16px 6px',
                        }}
                      >
                        TEAMS
                      </div>
                      {teams.map((T) => (
                        <Link
                          key={T.id}
                          href={`/league/${encodeURIComponent(T.leagueSlug)}/teams/${encodeURIComponent(T.id)}`}
                          role="option"
                          onClick={() => setOpen(false)}
                          style={{
                            display: 'block',
                            padding: '10px 16px',
                            textDecoration: 'none',
                            color: '#1a1a0a',
                            fontSize: '14px',
                            fontWeight: '600',
                            borderTop: '0.5px solid #eee8d4',
                          }}
                        >
                          {T.name}
                          <span
                            style={{
                              display: 'block',
                              fontSize: '12px',
                              fontWeight: '500',
                              color: '#6b5e3a',
                              marginTop: '2px',
                            }}
                          >
                            {T.leagueName}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
