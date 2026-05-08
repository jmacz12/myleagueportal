/**
 * Turn a public watch URL (YouTube / Twitch page) into an iframe embed src.
 * Twitch requires a parent= host for embeds; pass the current page hostname (e.g. window.location.hostname).
 */
export function streamWatchUrlToEmbedSrc(watchUrl: string, twitchParentHost: string): string | null {
  const raw = watchUrl.trim()
  if (!raw) return null
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

  const host = u.hostname.replace(/^www\./, '')

  const ytCommon = 'rel=0&modestbranding=1&color=white'

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const v = u.searchParams.get('v')
    if (v && /^[\w-]{11}$/.test(v)) {
      return `https://www.youtube.com/embed/${encodeURIComponent(v)}?${ytCommon}`
    }
    const pathMatch = u.pathname.match(/\/embed\/([\w-]{11})/)
    if (pathMatch) return `https://www.youtube.com/embed/${pathMatch[1]}?${ytCommon}`
    const short = u.pathname.match(/\/live\/([\w-]{11})/)
    if (short) return `https://www.youtube.com/embed/${short[1]}?${ytCommon}`
    return null
  }

  if (host === 'youtu.be') {
    const id = u.pathname.replace(/^\//, '').slice(0, 11)
    if (id && /^[\w-]{11}$/.test(id)) {
      return `https://www.youtube.com/embed/${encodeURIComponent(id)}?${ytCommon}`
    }
    return null
  }

  if (host === 'twitch.tv') {
    const parts = u.pathname.split('/').filter(Boolean)
    const channel = parts[0]
    if (!channel || !/^[a-zA-Z0-9_]{4,25}$/.test(channel)) return null
    const parent = twitchParentHost.replace(/^www\./, '') || 'localhost'
    return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}`
  }

  return null
}
