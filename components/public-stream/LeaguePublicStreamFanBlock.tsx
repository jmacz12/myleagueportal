'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { PublicStreamBoxScore } from '@/components/public-stream/PublicStreamBoxScore'
import { StreamWithOverlay } from '@/components/public-stream/StreamWithOverlay'
import type { LeagueWatchLeaguePreset } from '@/components/public-stream/LeagueWatchScoreStrip'
import type { JoinStreamLivePayload } from '@/lib/join-stream-live'

export type LeaguePublicStreamFanBlockProps = {
  slug: string
  /** Deep-link a recorded or live game (`?tab=stream&game=` on league home, or `?game=` on watch-only). */
  streamGameIdParam: string | null
  streamLive: JoinStreamLivePayload | null
  leaguePreset: LeagueWatchLeaguePreset
}

/**
 * Shared fan stream UI: optional embed + full `PublicStreamBoxScore` (same as league home Stream tab).
 */
export function LeaguePublicStreamFanBlock({
  slug,
  streamGameIdParam,
  streamLive,
  leaguePreset,
}: LeaguePublicStreamFanBlockProps) {
  const P = leaguePreset
  const streamEffectiveBoxGameId = streamGameIdParam ?? streamLive?.gameId ?? null

  const streamWatchUrlParsed = useMemo(() => {
    const raw = streamLive?.streamPageUrl?.trim()
    if (!raw) return null
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
    } catch {
      return null
    }
    return null
  }, [streamLive?.streamPageUrl])

  const streamScoreOverlayCoversHeader =
    !!streamWatchUrlParsed &&
    !!streamLive &&
    (!streamGameIdParam || streamGameIdParam === streamLive.gameId) &&
    streamLive.gameId === streamEffectiveBoxGameId

  return (
    <>
      {streamGameIdParam && streamLive && streamLive.gameId !== streamGameIdParam ? (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 14px',
            borderRadius: '12px',
            background: P.accentSoftBg,
            border: `1px solid ${P.surfaceBorder}`,
          }}
        >
          <p style={{ margin: 0, fontSize: '13px', color: P.body, lineHeight: 1.55 }}>
            <strong style={{ color: P.heading }}>Another game is live</strong> for this league. The player stats section below is for the game you
            opened.{' '}
            <Link href={`/league/${encodeURIComponent(slug)}?tab=stream`} style={{ fontWeight: 800, color: P.accent }}>
              Switch to the current live broadcast →
            </Link>
          </p>
        </div>
      ) : null}
      {!streamEffectiveBoxGameId ? (
        <div
          style={{
            padding: '28px 20px',
            textAlign: 'center',
            background: P.surfaceBg,
            border: `1px solid ${P.surfaceBorder}`,
            borderRadius: '16px',
            color: P.body,
            fontSize: '14px',
            lineHeight: 1.55,
          }}
        >
          No game is live right now. Check the <strong style={{ color: P.heading }}>Schedule</strong> tab, or open a team&apos;s{' '}
          <strong style={{ color: P.heading }}>Stream</strong> tab if they&apos;ve posted a broadcast link.
        </div>
      ) : (
        <>
          {(() => {
            const showLiveBroadcastUi = !!streamLive && (!streamGameIdParam || streamGameIdParam === streamLive.gameId)
            if (!showLiveBroadcastUi) {
              return streamEffectiveBoxGameId ? (
                <PublicStreamBoxScore gameId={streamEffectiveBoxGameId} leaguePreset={P} hideLiveGameHeader={false} />
              ) : null
            }

            const raw = streamLive.streamPageUrl?.trim() || ''
            let watchUrl: string | null = null
            if (raw) {
              try {
                const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
                if (u.protocol === 'http:' || u.protocol === 'https:') watchUrl = u.href
              } catch {
                watchUrl = null
              }
            }

            if (!raw) {
              return (
                <>
                  <div
                    style={{
                      padding: '28px 20px',
                      textAlign: 'center',
                      background: P.surfaceBg,
                      border: `1px solid ${P.surfaceBorder}`,
                      borderRadius: '16px',
                      color: P.body,
                      fontSize: '14px',
                      lineHeight: 1.55,
                    }}
                  >
                    <strong style={{ color: P.heading }}>
                      {streamLive.homeName || 'Home'} vs {streamLive.awayName || 'Away'}
                    </strong>{' '}
                    is live, but neither team has added a stream URL yet. Add a <strong style={{ color: P.heading }}>league default</strong> or team
                    links in <strong style={{ color: P.heading }}>Dashboard → League website → Access & streams</strong>, or under{' '}
                    <strong style={{ color: P.heading }}>Manage team → Page & links</strong> on a team page.
                  </div>
                  {streamEffectiveBoxGameId ? (
                    <PublicStreamBoxScore
                      gameId={streamEffectiveBoxGameId}
                      leaguePreset={P}
                      hideLiveGameHeader={false}
                      marginTopPx={18}
                    />
                  ) : null}
                </>
              )
            }
            if (!watchUrl) {
              return (
                <>
                  <p style={{ color: P.muted }}>Could not read stream URL.</p>
                  {streamEffectiveBoxGameId ? (
                    <PublicStreamBoxScore
                      gameId={streamEffectiveBoxGameId}
                      leaguePreset={P}
                      hideLiveGameHeader={false}
                      marginTopPx={18}
                    />
                  ) : null}
                </>
              )
            }
            return (
              <>
                <StreamWithOverlay watchUrl={watchUrl} liveGameId={streamLive.gameId} accentColor={P.accent} />
                {streamEffectiveBoxGameId ? (
                  <PublicStreamBoxScore
                    gameId={streamEffectiveBoxGameId}
                    leaguePreset={P}
                    hideLiveGameHeader={streamScoreOverlayCoversHeader}
                    marginTopPx={18}
                  />
                ) : null}
              </>
            )
          })()}
        </>
      )}
    </>
  )
}
