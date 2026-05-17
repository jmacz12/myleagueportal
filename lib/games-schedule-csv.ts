/**
 * League season game schedule — CSV parse + team name resolution for import preview.
 */

export const GAMES_SCHEDULE_CSV_MAX_ROWS = 100

/** Plain-language formats accepted in the date and time columns (import template + UI). */
export const SCHEDULE_IMPORT_DATE_FORMAT_HINT =
  'YYYY-MM-DD (e.g. 2026-06-20) or month/day/year (e.g. 6/20/2026)'
export const SCHEDULE_IMPORT_TIME_FORMAT_HINT =
  '24-hour (e.g. 19:00) or 12-hour with AM/PM (e.g. 7:00 PM or 7pm)'


export type GamesScheduleCsvColumn =
  | 'home_team'
  | 'away_team'
  | 'date'
  | 'time'
  | 'location'

export type ParsedScheduleCsvRow = {
  lineNumber: number
  home_team: string
  away_team: string
  date: string
  time: string
  location: string
}

export type ScheduleImportPreviewRow = ParsedScheduleCsvRow & {
  home_team_id: string | null
  away_team_id: string | null
  home_team_label: string | null
  away_team_label: string | null
  errors: string[]
  warnings: string[]
  ready: boolean
}

export type TeamNameLookup = { id: string; name: string }

const HEADER_ALIASES: Record<GamesScheduleCsvColumn, string[]> = {
  home_team: ['home', 'home team', 'home_team', 'hometeam'],
  away_team: ['away', 'away team', 'away_team', 'awayteam', 'visitor', 'visiting'],
  date: ['date', 'game date', 'day'],
  time: ['time', 'start', 'start time', 'tip'],
  location: ['location', 'venue', 'court', 'place', 'gym'],
}

export function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

export function columnIndexForHeader(normalized: string): GamesScheduleCsvColumn | null {
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [GamesScheduleCsvColumn, string[]][]) {
    if (aliases.includes(normalized)) return key
  }
  return null
}

/** Split one CSV line respecting double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

export function looksLikeHeader(cells: string[]): boolean {
  if (cells.length < 3) return false
  const normalized = cells.map(normalizeHeader)
  return normalized.some((c) => columnIndexForHeader(c) !== null)
}

function mapRowByHeaders(
  cells: string[],
  indexByColumn: Partial<Record<GamesScheduleCsvColumn, number>>
): Omit<ParsedScheduleCsvRow, 'lineNumber'> {
  const pick = (col: GamesScheduleCsvColumn) => {
    const idx = indexByColumn[col]
    return idx !== undefined && idx < cells.length ? cells[idx].trim() : ''
  }
  return {
    home_team: pick('home_team'),
    away_team: pick('away_team'),
    date: pick('date'),
    time: pick('time'),
    location: pick('location'),
  }
}

function stripTemplateHintParens(s: string): string {
  return s.trim().replace(/^\(|\)$/g, '').trim().toLowerCase()
}

/** Skip the downloadable template’s example row if the user uploads it unchanged. */
export function isScheduleTemplatePlaceholderRow(
  row: Omit<ParsedScheduleCsvRow, 'lineNumber'>
): boolean {
  const home = stripTemplateHintParens(row.home_team)
  const away = stripTemplateHintParens(row.away_team)
  const date = stripTemplateHintParens(row.date)
  const time = stripTemplateHintParens(row.time)
  const legacy =
    home === 'home team' &&
    away === 'away team' &&
    date === 'date' &&
    time === 'time' &&
    stripTemplateHintParens(row.location) === 'location'
  const withExamples =
    home.includes('home team') &&
    away.includes('away team') &&
    (date.includes('2026-06-20') || date === 'date') &&
    (time.includes('19:00') || time.includes('7:00 pm') || time === 'time')
  return legacy || withExamples
}

function mapRowPositional(cells: string[]): Omit<ParsedScheduleCsvRow, 'lineNumber'> {
  return {
    home_team: cells[0]?.trim() ?? '',
    away_team: cells[1]?.trim() ?? '',
    date: cells[2]?.trim() ?? '',
    time: cells[3]?.trim() ?? '',
    location: cells[4]?.trim() ?? '',
  }
}

export function parseGamesScheduleCsv(input: string): ParsedScheduleCsvRow[] {
  const text = input.replace(/^\uFEFF/, '')
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  if (lines.length === 0) return []

  const firstCells = splitCsvLine(lines[0])
  const hasHeader = looksLikeHeader(firstCells)

  let indexByColumn: Partial<Record<GamesScheduleCsvColumn, number>> = {}
  let dataStart = 0

  if (hasHeader) {
    firstCells.forEach((cell, idx) => {
      const col = columnIndexForHeader(normalizeHeader(cell))
      if (col) indexByColumn[col] = idx
    })
    dataStart = 1
  }

  const rows: ParsedScheduleCsvRow[] = []
  for (let i = dataStart; i < lines.length && rows.length < GAMES_SCHEDULE_CSV_MAX_ROWS; i++) {
    const cells = splitCsvLine(lines[i])
    if (cells.every((c) => !c)) continue
    const mapped = hasHeader ? mapRowByHeaders(cells, indexByColumn) : mapRowPositional(cells)
    if (isScheduleTemplatePlaceholderRow(mapped)) continue
    rows.push({ lineNumber: i + 1, ...mapped })
  }
  return rows
}

export function normalizeScheduleDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    const mm = us[1].padStart(2, '0')
    const dd = us[2].padStart(2, '0')
    return `${us[3]}-${mm}-${dd}`
  }
  const usShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (usShort) {
    const yy = Number(usShort[3])
    const year = yy >= 70 ? 1900 + yy : 2000 + yy
    const mm = usShort[1].padStart(2, '0')
    const dd = usShort[2].padStart(2, '0')
    return `${year}-${mm}-${dd}`
  }
  return null
}

export function normalizeScheduleTime(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const h24 = s.match(/^(\d{1,2}):(\d{2})$/)
  if (h24) {
    const h = Number(h24[1])
    const m = Number(h24[2])
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${h24[2]}`
    }
    return null
  }
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (ampm) {
    let h = Number(ampm[1])
    const m = ampm[2] ? Number(ampm[2]) : 0
    const pm = ampm[3].toLowerCase() === 'pm'
    if (h < 1 || h > 12 || m < 0 || m > 59) return null
    if (pm && h !== 12) h += 12
    if (!pm && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const compact = s.match(/^(\d{1,2})(am|pm)$/i)
  if (compact) {
    return normalizeScheduleTime(`${compact[1]}:00 ${compact[2]}`)
  }
  return null
}

function normalizeTeamKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function resolveTeamName(
  raw: string,
  teams: TeamNameLookup[]
): { id: string | null; label: string | null; error?: string } {
  const key = normalizeTeamKey(raw)
  if (!key) return { id: null, label: null, error: 'Team name is required' }
  const matches = teams.filter((t) => normalizeTeamKey(t.name) === key)
  if (matches.length === 1) return { id: matches[0].id, label: matches[0].name }
  if (matches.length > 1) {
    return { id: null, label: null, error: `Multiple teams named “${raw.trim()}”` }
  }
  const partial = teams.filter(
    (t) => normalizeTeamKey(t.name).includes(key) || key.includes(normalizeTeamKey(t.name))
  )
  if (partial.length === 1) {
    return { id: partial[0].id, label: partial[0].name }
  }
  if (partial.length > 1) {
    return { id: null, label: null, error: `Team name “${raw.trim()}” is ambiguous` }
  }
  return { id: null, label: null, error: `Unknown team “${raw.trim()}”` }
}

/** Re-validate one preview row after the organizer picks teams or edits date/time in the UI. */
export function refreshScheduleImportPreviewRow(
  row: ScheduleImportPreviewRow,
  teams: TeamNameLookup[],
  manual: { home_team_id?: string; away_team_id?: string } = {}
): ScheduleImportPreviewRow {
  const errors: string[] = []
  const warnings: string[] = []

  let home_team_id: string | null = null
  let away_team_id: string | null = null
  let home_team_label: string | null = null
  let away_team_label: string | null = null

  if (manual.home_team_id) {
    home_team_id = manual.home_team_id
    home_team_label = teams.find((t) => t.id === manual.home_team_id)?.name ?? null
    const typed = row.home_team.trim()
    if (typed && home_team_label && normalizeTeamKey(typed) !== normalizeTeamKey(home_team_label)) {
      warnings.push(`Home: spreadsheet had “${typed}”`)
    }
  } else if (row.home_team_id) {
    home_team_id = row.home_team_id
    home_team_label = teams.find((t) => t.id === row.home_team_id)?.name ?? row.home_team_label
  } else {
    const home = resolveTeamName(row.home_team, teams)
    home_team_id = home.id
    home_team_label = home.label
    if (home.error) errors.push(home.error)
    else if (home.label && normalizeTeamKey(row.home_team) !== normalizeTeamKey(home.label)) {
      warnings.push(`Home matched to “${home.label}”`)
    }
  }

  if (manual.away_team_id) {
    away_team_id = manual.away_team_id
    away_team_label = teams.find((t) => t.id === manual.away_team_id)?.name ?? null
    const typed = row.away_team.trim()
    if (typed && away_team_label && normalizeTeamKey(typed) !== normalizeTeamKey(away_team_label)) {
      warnings.push(`Away: spreadsheet had “${typed}”`)
    }
  } else if (row.away_team_id) {
    away_team_id = row.away_team_id
    away_team_label = teams.find((t) => t.id === row.away_team_id)?.name ?? row.away_team_label
  } else {
    const away = resolveTeamName(row.away_team, teams)
    away_team_id = away.id
    away_team_label = away.label
    if (away.error) errors.push(away.error)
    else if (away.label && normalizeTeamKey(row.away_team) !== normalizeTeamKey(away.label)) {
      warnings.push(`Away matched to “${away.label}”`)
    }
  }

  const dateNorm = normalizeScheduleDate(row.date)
  if (!row.date.trim()) errors.push('Date is required')
  else if (!dateNorm) errors.push(`Unrecognized date “${row.date.trim()}” (use YYYY-MM-DD or MM/DD/YYYY)`)

  const timeNorm = normalizeScheduleTime(row.time)
  if (!row.time.trim()) errors.push('Time is required')
  else if (!timeNorm) errors.push(`Unrecognized time “${row.time.trim()}” (use 19:00 or 7:00 PM)`)

  if (home_team_id && away_team_id && home_team_id === away_team_id) {
    errors.push('Home and away must be different teams')
  }

  const ready =
    errors.length === 0 && !!home_team_id && !!away_team_id && !!dateNorm && !!timeNorm

  return {
    ...row,
    date: dateNorm ?? row.date,
    time: timeNorm ?? row.time,
    home_team_id,
    away_team_id,
    home_team_label,
    away_team_label,
    errors,
    warnings,
    ready,
  }
}

export function applyScheduleImportDuplicateWarnings(
  rows: ScheduleImportPreviewRow[]
): ScheduleImportPreviewRow[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    const warnings = row.warnings.filter((w) => !w.startsWith('Duplicate'))
    if (!row.ready || !row.home_team_id || !row.away_team_id) {
      return { ...row, warnings }
    }
    const dupKey = `${row.home_team_id}|${row.away_team_id}|${row.date}|${row.time}`
    if (seen.has(dupKey)) warnings.push('Duplicate row in this file')
    else seen.add(dupKey)
    return { ...row, warnings }
  })
}

export function previewRowsToConfirmGames(rows: ScheduleImportPreviewRow[]): {
  games: Array<{
    home_team_id: string
    away_team_id: string
    date: string
    time: string
    location: string
  }>
  readyCount: number
} {
  const ready = rows.filter((r) => r.ready && r.home_team_id && r.away_team_id)
  return {
    readyCount: ready.length,
    games: ready.map((r) => ({
      home_team_id: r.home_team_id!,
      away_team_id: r.away_team_id!,
      date: r.date,
      time: r.time,
      location: r.location,
    })),
  }
}

export function buildScheduleImportPreview(
  parsed: ParsedScheduleCsvRow[],
  teams: TeamNameLookup[]
): ScheduleImportPreviewRow[] {
  const seen = new Set<string>()
  return parsed.map((row) => {
    const errors: string[] = []
    const warnings: string[] = []

    const home = resolveTeamName(row.home_team, teams)
    const away = resolveTeamName(row.away_team, teams)
    if (home.error) errors.push(home.error)
    if (away.error) errors.push(away.error)
    if (
      home.id &&
      away.id &&
      home.label &&
      normalizeTeamKey(row.home_team) !== normalizeTeamKey(home.label)
    ) {
      warnings.push(`Home matched to “${home.label}”`)
    }
    if (
      away.id &&
      away.id &&
      away.label &&
      normalizeTeamKey(row.away_team) !== normalizeTeamKey(away.label)
    ) {
      warnings.push(`Away matched to “${away.label}”`)
    }

    const dateNorm = normalizeScheduleDate(row.date)
    if (!row.date.trim()) errors.push('Date is required')
    else if (!dateNorm) errors.push(`Unrecognized date “${row.date.trim()}” (use YYYY-MM-DD or MM/DD/YYYY)`)

    const timeNorm = normalizeScheduleTime(row.time)
    if (!row.time.trim()) errors.push('Time is required')
    else if (!timeNorm) errors.push(`Unrecognized time “${row.time.trim()}” (use 19:00 or 7:00 PM)`)

    if (home.id && away.id && home.id === away.id) {
      errors.push('Home and away must be different teams')
    }

    if (home.id && away.id && dateNorm && timeNorm) {
      const dupKey = `${home.id}|${away.id}|${dateNorm}|${timeNorm}`
      if (seen.has(dupKey)) warnings.push('Duplicate row in this file')
      else seen.add(dupKey)
    }

    const ready =
      errors.length === 0 &&
      !!home.id &&
      !!away.id &&
      !!dateNorm &&
      !!timeNorm

    return {
      ...row,
      date: dateNorm ?? row.date,
      time: timeNorm ?? row.time,
      home_team_id: home.id,
      away_team_id: away.id,
      home_team_label: home.label,
      away_team_label: away.label,
      errors,
      warnings,
      ready,
    }
  })
}

export function finalizeScheduleImportPreview(
  rows: ScheduleImportPreviewRow[]
): ScheduleImportPreviewRow[] {
  return applyScheduleImportDuplicateWarnings(rows)
}

export const GAMES_SCHEDULE_CSV_TEMPLATE = `home_team,away_team,date,time,location
(Home team — copy from Teams tab),(Away team — copy from Teams tab),(2026-06-20 or 6/20/2026),(19:00 or 7:00 PM),(Optional — Court 1)`
