import { parsePlayLog } from '@/lib/game-stats-play-log'

export type ParsedStatSheetRow = {
  lineNumber: number
  jersey: string
  player_name: string
  team_label: string
  play_log: string
  fg2m: string
  fg3m: string
  ftm: string
  pts: string
  reb: string
  ast: string
  stl: string
  blk: string
  tov: string
  pf: string
}

export type StatSheetPlayerLookup = {
  id: string
  full_name: string
  jersey_number: string | null
  team_id: string
}

export type StatSheetTeamLookup = { id: string; name: string; side: 'home' | 'away' }

export type StatSheetPreviewRow = ParsedStatSheetRow & {
  player_id: string | null
  player_label: string | null
  team_side: 'home' | 'away' | null
  resolved: {
    fg2m: number
    fg3m: number
    ftm: number
    pts: number
    reb: number
    ast: number
    stl: number
    blk: number
    tov: number
    pf: number
  } | null
  errors: string[]
  warnings: string[]
  ready: boolean
}

export type StatSheetConfirmRow = {
  player_id: string
  fg2m: number
  fg3m: number
  ftm: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
}

const HEADER_ALIASES: Record<string, string> = {
  jersey: 'jersey',
  '#': 'jersey',
  number: 'jersey',
  no: 'jersey',
  player: 'player_name',
  name: 'player_name',
  player_name: 'player_name',
  team: 'team_label',
  side: 'team_label',
  play_log: 'play_log',
  plays: 'play_log',
  log: 'play_log',
  '2pm': 'fg2m',
  fg2m: 'fg2m',
  '2pt': 'fg2m',
  '3pm': 'fg3m',
  fg3m: 'fg3m',
  '3pt': 'fg3m',
  ftm: 'ftm',
  ft: 'ftm',
  pts: 'pts',
  points: 'pts',
  reb: 'reb',
  rebs: 'reb',
  rebounds: 'reb',
  ast: 'ast',
  assists: 'ast',
  stl: 'stl',
  steals: 'stl',
  blk: 'blk',
  blocks: 'blk',
  tov: 'tov',
  turnovers: 'tov',
  pf: 'pf',
  fouls: 'pf',
}

function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQuotes = !inQuotes
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

function looksLikeHeader(cells: string[]): boolean {
  const normalized = cells.map(normalizeHeader)
  return normalized.some((c) => HEADER_ALIASES[c] !== undefined)
}

function isInstructionRow(row: Omit<ParsedStatSheetRow, 'lineNumber'>): boolean {
  const j = row.jersey.trim().toLowerCase()
  const p = row.player_name.trim().toLowerCase()
  if (j === '#' || j === 'jersey' || p === 'player') return true
  if (p.includes('play log') || p.includes('example')) return true
  return false
}

export function parseStatSheetCsv(input: string): ParsedStatSheetRow[] {
  const text = input.replace(/^\uFEFF/, '')
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  if (lines.length === 0) return []

  const firstCells = splitCsvLine(lines[0])
  const hasHeader = looksLikeHeader(firstCells)
  const indexByKey: Record<string, number> = {}
  let dataStart = 0

  if (hasHeader) {
    firstCells.forEach((cell, idx) => {
      const key = HEADER_ALIASES[normalizeHeader(cell)]
      if (key) indexByKey[key] = idx
    })
    dataStart = 1
  }

  const pick = (cells: string[], key: string, fallbackIdx: number) => {
    const idx = indexByKey[key]
    return (idx !== undefined ? cells[idx] : cells[fallbackIdx])?.trim() ?? ''
  }

  const rows: ParsedStatSheetRow[] = []
  for (let i = dataStart; i < lines.length && rows.length < 60; i++) {
    const cells = splitCsvLine(lines[i])
    if (cells.every((c) => !c)) continue
    const mapped = {
      jersey: pick(cells, 'jersey', 0),
      player_name: pick(cells, 'player_name', 1),
      team_label: pick(cells, 'team_label', 2),
      play_log: pick(cells, 'play_log', 3),
      fg2m: pick(cells, 'fg2m', 4),
      fg3m: pick(cells, 'fg3m', 5),
      ftm: pick(cells, 'ftm', 6),
      pts: pick(cells, 'pts', 7),
      reb: pick(cells, 'reb', 8),
      ast: pick(cells, 'ast', 9),
      stl: pick(cells, 'stl', 10),
      blk: pick(cells, 'blk', 11),
      tov: pick(cells, 'tov', 12),
      pf: pick(cells, 'pf', 13),
    }
    if (isInstructionRow(mapped)) continue
    if (!mapped.jersey && !mapped.player_name && !mapped.play_log && !mapped.pts) continue
    rows.push({ lineNumber: i + 1, ...mapped })
  }
  return rows
}

function parseOptionalInt(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null
  return n
}

function resolveTeamSide(
  label: string,
  teams: StatSheetTeamLookup[]
): { side: 'home' | 'away' | null; error?: string } {
  const key = label.trim().toLowerCase()
  if (!key) return { side: null, error: 'Team is required (Home or Away)' }
  if (key === 'home' || key === 'h') return { side: 'home' }
  if (key === 'away' || key === 'a' || key === 'visitor' || key === 'visiting') return { side: 'away' }
  const home = teams.find((t) => t.side === 'home')
  const away = teams.find((t) => t.side === 'away')
  const norm = (s: string) => s.trim().toLowerCase()
  if (home && norm(home.name) === key) return { side: 'home' }
  if (away && norm(away.name) === key) return { side: 'away' }
  return { side: null, error: `Unknown team “${label.trim()}” (use Home or Away)` }
}

function resolvePlayer(
  row: ParsedStatSheetRow,
  teamId: string,
  roster: StatSheetPlayerLookup[]
): { id: string | null; label: string | null; error?: string } {
  const onTeam = roster.filter((p) => p.team_id === teamId)
  const jerseyKey = row.jersey.trim().replace(/^#/, '')
  if (jerseyKey) {
    const matches = onTeam.filter((p) => String(p.jersey_number ?? '').trim() === jerseyKey)
    if (matches.length === 1) return { id: matches[0].id, label: matches[0].full_name }
    if (matches.length > 1) return { id: null, label: null, error: `Jersey #${jerseyKey} is ambiguous` }
  }
  const nameKey = row.player_name.trim().toLowerCase()
  if (nameKey) {
    const matches = onTeam.filter((p) => p.full_name.trim().toLowerCase() === nameKey)
    if (matches.length === 1) return { id: matches[0].id, label: matches[0].full_name }
    const partial = onTeam.filter(
      (p) =>
        p.full_name.trim().toLowerCase().includes(nameKey) ||
        nameKey.includes(p.full_name.trim().toLowerCase())
    )
    if (partial.length === 1) return { id: partial[0].id, label: partial[0].full_name }
    if (partial.length > 1) return { id: null, label: null, error: `Player “${row.player_name.trim()}” is ambiguous` }
  }
  return { id: null, label: null, error: 'Could not match player (# or name)' }
}

function buildResolvedStats(row: ParsedStatSheetRow): {
  stats: StatSheetConfirmRow['fg2m'] extends number ? Omit<StatSheetConfirmRow, 'player_id'> : never
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  const fromLog = row.play_log.trim() ? parsePlayLog(row.play_log) : null
  const fg2m = parseOptionalInt(row.fg2m)
  const fg3m = parseOptionalInt(row.fg3m)
  const ftm = parseOptionalInt(row.ftm)
  const ptsDirect = parseOptionalInt(row.pts)
  const reb = parseOptionalInt(row.reb) ?? 0
  const ast = parseOptionalInt(row.ast) ?? 0
  const stl = parseOptionalInt(row.stl) ?? 0
  const blk = parseOptionalInt(row.blk) ?? 0
  const tov = parseOptionalInt(row.tov) ?? 0
  const pf = parseOptionalInt(row.pf) ?? 0

  if (row.fg2m.trim() && fg2m === null) errors.push('Invalid 2PM')
  if (row.fg3m.trim() && fg3m === null) errors.push('Invalid 3PM')
  if (row.ftm.trim() && ftm === null) errors.push('Invalid FTM')
  if (row.pts.trim() && ptsDirect === null) errors.push('Invalid PTS')
  if (row.reb.trim() && parseOptionalInt(row.reb) === null) errors.push('Invalid REB')
  if (row.ast.trim() && parseOptionalInt(row.ast) === null) errors.push('Invalid AST')

  const hasTotals = fg2m !== null || fg3m !== null || ftm !== null || ptsDirect !== null
  if (!fromLog && !hasTotals) {
    errors.push('Add a play log (e.g. 2 3 2 1) or fill stat columns')
  }

  let finalFg2m = fg2m ?? fromLog?.fg2m ?? 0
  let finalFg3m = fg3m ?? fromLog?.fg3m ?? 0
  let finalFtm = ftm ?? fromLog?.ftm ?? 0
  if (fromLog && hasTotals && (fg2m !== null || fg3m !== null || ftm !== null)) {
    warnings.push('Used typed 2PM/3PM/FTM over play log for shooting')
  } else if (fromLog && !hasTotals) {
    finalFg2m = fromLog.fg2m
    finalFg3m = fromLog.fg3m
    finalFtm = fromLog.ftm
  }

  let pts = ptsDirect ?? finalFg2m * 2 + finalFg3m * 3 + finalFtm
  if (ptsDirect !== null && (fg2m !== null || fg3m !== null || ftm !== null)) {
    const computed = finalFg2m * 2 + finalFg3m * 3 + finalFtm
    if (computed !== ptsDirect) warnings.push(`PTS ${ptsDirect} used (made shots add to ${computed})`)
    pts = ptsDirect
  }

  return {
    stats: {
      fg2m: finalFg2m,
      fg3m: finalFg3m,
      ftm: finalFtm,
      pts,
      reb,
      ast,
      stl,
      blk,
      tov,
      pf,
    },
    errors,
    warnings,
  }
}

export function buildStatSheetPreview(
  parsed: ParsedStatSheetRow[],
  teams: StatSheetTeamLookup[],
  roster: StatSheetPlayerLookup[]
): StatSheetPreviewRow[] {
  const teamIdBySide = new Map<'home' | 'away', string>()
  for (const t of teams) teamIdBySide.set(t.side, t.id)

  return parsed.map((row) => {
    const errors: string[] = []
    const warnings: string[] = []

    const teamRes = resolveTeamSide(row.team_label, teams)
    if (teamRes.error) errors.push(teamRes.error)
    const teamId = teamRes.side ? teamIdBySide.get(teamRes.side) : undefined

    let player_id: string | null = null
    let player_label: string | null = null
    if (teamId) {
      const playerRes = resolvePlayer(row, teamId, roster)
      player_id = playerRes.id
      player_label = playerRes.label
      if (playerRes.error) errors.push(playerRes.error)
    }

    const built = buildResolvedStats(row)
    errors.push(...built.errors)
    warnings.push(...built.warnings)

    const ready = errors.length === 0 && !!player_id && !!built.stats

    return {
      ...row,
      player_id,
      player_label,
      team_side: teamRes.side,
      resolved: ready && built.stats ? built.stats : built.stats,
      errors,
      warnings,
      ready,
    }
  })
}

export function previewRowsToConfirmStats(rows: StatSheetPreviewRow[]): StatSheetConfirmRow[] {
  return rows
    .filter((r) => r.ready && r.player_id && r.resolved)
    .map((r) => ({
      player_id: r.player_id!,
      ...r.resolved!,
    }))
}
