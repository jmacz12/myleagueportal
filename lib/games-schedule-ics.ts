/**
 * League game schedule — iCalendar (.ics) parse for import preview.
 * Google Calendar / Apple Calendar exports → same rows as CSV import.
 */

import {
  GAMES_SCHEDULE_CSV_MAX_ROWS,
  type ParsedScheduleCsvRow,
} from './games-schedule-csv'

type IcsProperty = {
  name: string
  params: Record<string, string>
  value: string
}

/** Unfold RFC 5545 line continuations (leading space/tab). */
export function unfoldIcsLines(text: string): string[] {
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const lines: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1)
    } else {
      lines.push(line)
    }
  }
  return lines
}

/** Decode common ICS escaped characters in property values. */
export function unescapeIcsValue(value: string): string {
  const out: string[] = []
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '\\' && i + 1 < value.length) {
      const next = value[i + 1]
      if (next === 'n' || next === 'N') {
        out.push('\n')
        i++
        continue
      }
      out.push(next)
      i++
      continue
    }
    out.push(ch)
  }
  return out.join('')
}

export function parseIcsPropertyLine(line: string): IcsProperty | null {
  const colon = line.indexOf(':')
  if (colon <= 0) return null
  const namePart = line.slice(0, colon)
  const value = unescapeIcsValue(line.slice(colon + 1))
  const segments = namePart.split(';')
  const name = (segments[0] ?? '').trim().toUpperCase()
  if (!name) return null
  const params: Record<string, string> = {}
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i] ?? ''
    const eq = seg.indexOf('=')
    if (eq === -1) continue
    const key = seg.slice(0, eq).trim().toLowerCase()
    const paramValue = seg.slice(eq + 1).trim().replace(/^"|"$/g, '')
    if (key) params[key] = paramValue
  }
  return { name, params, value }
}

/** Split unfolded lines into VEVENT property lists. */
export function extractIcsVevents(text: string): IcsProperty[][] {
  const lines = unfoldIcsLines(text)
  const events: IcsProperty[][] = []
  let current: IcsProperty[] | null = null
  let depth = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const upper = trimmed.toUpperCase()
    if (upper === 'BEGIN:VEVENT') {
      current = []
      depth = 1
      continue
    }
    if (upper === 'END:VEVENT' && current) {
      if (current.length > 0) events.push(current)
      current = null
      depth = 0
      continue
    }
    if (!current || depth === 0) continue
    const prop = parseIcsPropertyLine(trimmed)
    if (prop) current.push(prop)
  }

  return events
}

/** Parse DTSTART into YYYY-MM-DD and HH:MM (wall clock from the file). */
export function parseIcsDateTime(
  value: string,
  params: Record<string, string>
): { date: string; time: string } | null {
  const raw = value.trim()
  if (!raw) return null

  const isDateOnly = params.value === 'DATE' || /^\d{8}$/.test(raw)

  if (isDateOnly) {
    const m = raw.match(/^(\d{4})(\d{2})(\d{2})$/)
    if (!m) return null
    return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '' }
  }

  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i)
  if (!m) return null

  const date = `${m[1]}-${m[2]}-${m[3]}`
  const hour = Number(m[4])
  const minute = m[5]

  if (m[7]?.toUpperCase() === 'Z') {
    const utc = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, Number(minute), 0))
    const y = utc.getFullYear()
    const mo = String(utc.getMonth() + 1).padStart(2, '0')
    const d = String(utc.getDate()).padStart(2, '0')
    const h = String(utc.getHours()).padStart(2, '0')
    return { date: `${y}-${mo}-${d}`, time: `${h}:${minute}` }
  }

  return { date, time: `${String(hour).padStart(2, '0')}:${minute}` }
}

/**
 * Extract home/away team names from a calendar event title.
 * `@` → first team away, second home (e.g. "Lakers @ Celtics").
 * `vs` / `v` → first home, second away.
 */
export function parseTeamsFromIcsSummary(summary: string): {
  home_team: string
  away_team: string
} | null {
  const s = summary.trim().replace(/\s+/g, ' ')
  if (!s) return null

  const at = s.match(/^(.+?)\s+@\s+(.+)$/i)
  if (at) {
    return { home_team: at[2].trim(), away_team: at[1].trim() }
  }

  const vs = s.match(/^(.+?)\s+(?:vs\.?|versus|v\.?)\s+(.+)$/i)
  if (vs) {
    return { home_team: vs[1].trim(), away_team: vs[2].trim() }
  }

  const dash = s.match(/^(.+?)\s+[-–—]\s+(.+)$/)
  if (dash) {
    return { home_team: dash[1].trim(), away_team: dash[2].trim() }
  }

  return null
}

function propValue(event: IcsProperty[], name: string): string {
  const hit = event.find((p) => p.name === name)
  return hit?.value.trim() ?? ''
}

function isCancelledEvent(event: IcsProperty[]): boolean {
  const status = propValue(event, 'STATUS').toUpperCase()
  return status === 'CANCELLED'
}

function veventToRow(event: IcsProperty[], lineNumber: number): ParsedScheduleCsvRow | null {
  if (isCancelledEvent(event)) return null

  const summary = propValue(event, 'SUMMARY')
  const description = propValue(event, 'DESCRIPTION')
  const location = propValue(event, 'LOCATION')

  let teams = parseTeamsFromIcsSummary(summary)
  if (!teams && description) {
    const homeFromDesc = description.match(/(?:home|host)\s*:\s*(.+)/i)?.[1]?.split(/\r?\n/)[0]?.trim()
    const awayFromDesc = description.match(/(?:away|visitor|guest)\s*:\s*(.+)/i)?.[1]?.split(/\r?\n/)[0]?.trim()
    if (homeFromDesc && awayFromDesc) {
      teams = { home_team: homeFromDesc, away_team: awayFromDesc }
    }
  }

  const dtstart = event.find((p) => p.name === 'DTSTART')
  if (!dtstart) return null

  const when = parseIcsDateTime(dtstart.value, dtstart.params)
  if (!when) return null

  const title = summary || description.split(/\r?\n/)[0]?.trim() || 'Calendar event'

  return {
    lineNumber,
    home_team: teams?.home_team ?? title,
    away_team: teams?.away_team ?? '',
    date: when.date,
    time: when.time,
    location,
  }
}

export function parseGamesScheduleIcs(input: string): ParsedScheduleCsvRow[] {
  const events = extractIcsVevents(input)
  const rows: ParsedScheduleCsvRow[] = []

  for (let i = 0; i < events.length && rows.length < GAMES_SCHEDULE_CSV_MAX_ROWS; i++) {
    const row = veventToRow(events[i]!, i + 1)
    if (row) rows.push({ ...row, lineNumber: rows.length + 1 })
  }

  return rows
}
