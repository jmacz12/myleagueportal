import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import {
  columnIndexForHeader,
  looksLikeHeader,
  normalizeHeader,
  parseGamesScheduleCsv,
  type GamesScheduleCsvColumn,
  type ParsedScheduleCsvRow,
} from './games-schedule-csv'
import { parseGamesScheduleIcs } from './games-schedule-ics'

export type ScheduleImportFileKind = 'csv' | 'excel' | 'ics' | 'text'

/** Rows on the Schedule tab that organizers can fill (dropdowns + date/time pickers). */
export const SCHEDULE_TEMPLATE_DATA_ROW_COUNT = 60

const SCHEDULE_SHEET_HEADERS = [
  'Home team',
  'Away team',
  'Date',
  'Time',
  'Location (optional)',
] as const

const SCHEDULE_TEMPLATE_INSTRUCTIONS_ROWS: string[][] = [
  ['How to fill in your schedule'],
  [''],
  ['1. Open the Schedule tab (first tab when you open the file).'],
  ['2. Click each cell and choose from the dropdown — Home team, Away team, Date, Time.'],
  ['3. Location is optional (type or leave blank).'],
  ['4. Save and upload the file in MyLeaguePortal → Review → Schedule games.'],
]

/** Game times for the template dropdown (matches import parsing). */
function buildTemplateTimeOptions(): string[] {
  const times: string[] = []
  for (let h = 8; h <= 22; h++) {
    for (const m of [0, 30]) {
      const period = h >= 12 ? 'PM' : 'AM'
      let hour12 = h % 12
      if (hour12 === 0) hour12 = 12
      times.push(`${hour12}:${m === 0 ? '00' : '30'} ${period}`)
    }
  }
  return times
}

/** Calendar dates for the template dropdown (~18 months). */
function buildTemplateDateOptions(): string[] {
  const dates: string[] = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(1)
  const totalDays = 548
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dates.push(`${y}-${mo}-${day}`)
  }
  return dates
}

function addVeryHiddenListSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  values: string[]
): string | undefined {
  if (values.length === 0) return undefined
  const sheet = workbook.addWorksheet(sheetName, { state: 'veryHidden' })
  sheet.getColumn(1).width = 18
  for (const value of values) sheet.addRow([value])
  return `'${sheetName}'!$A$1:$A$${values.length}`
}

function applyListValidation(
  cell: ExcelJS.Cell,
  range: string | undefined,
  errorTitle: string,
  error: string
) {
  if (!range) return
  cell.dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [range],
    showErrorMessage: true,
    errorTitle,
    error,
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Turn an Excel date/time serial (or string) into YYYY-MM-DD for the schedule date column. */
export function formatExcelScheduleDateCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') {
    const t = value.trim()
    if (!t) return ''
    const n = Number(t)
    if (!Number.isFinite(n) || !/^\d+(\.\d+)?$/.test(t)) return t
    value = n
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value)
  const parsed = XLSX.SSF.parse_date_code(value)
  if (!parsed?.y) return String(value)
  const mm = String(parsed.m).padStart(2, '0')
  const dd = String(parsed.d).padStart(2, '0')
  return `${parsed.y}-${mm}-${dd}`
}

/** Turn an Excel time serial (or string) into 24h HH:MM for the schedule time column. */
export function formatExcelScheduleTimeCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string') {
    const t = value.trim()
    if (!t) return ''
    const n = Number(t)
    if (!Number.isFinite(n) || !/^\d+(\.\d+)?$/.test(t)) return t
    value = n
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value)
  const parsed = XLSX.SSF.parse_date_code(value)
  if (!parsed) return String(value)
  const h = String(parsed.H).padStart(2, '0')
  const m = String(parsed.M).padStart(2, '0')
  return `${h}:${m}`
}

function headerColumnIndex(
  headerRow: string[],
  column: GamesScheduleCsvColumn
): number | undefined {
  for (let i = 0; i < headerRow.length; i++) {
    if (columnIndexForHeader(normalizeHeader(headerRow[i])) === column) return i
  }
  return undefined
}

/** Downloadable template (CSV) — header row only; use Excel for dropdowns and pickers. */
export function buildScheduleDownloadTemplate(_teamNames?: string[]): string {
  return SCHEDULE_SHEET_HEADERS.join(',')
}

export async function buildScheduleDownloadTemplateXlsx(teamNames: string[]): Promise<Uint8Array> {
  const names = teamNames.map((n) => n.trim()).filter(Boolean)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MyLeaguePortal'
  workbook.created = new Date()

  const schedule = workbook.addWorksheet('Schedule', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const columnWidths = [34, 34, 18, 16, 28] as const
  SCHEDULE_SHEET_HEADERS.forEach((label, i) => {
    const col = schedule.getColumn(i + 1)
    col.width = columnWidths[i]
    col.key = label
  })

  const headerRow = schedule.addRow([...SCHEDULE_SHEET_HEADERS])
  headerRow.height = 32
  headerRow.font = { bold: true, size: 12 }
  headerRow.alignment = { vertical: 'middle', wrapText: true }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0EC' },
    }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFB8C4BE' } },
    }
  })

  const firstDataRow = 2
  const lastDataRow = firstDataRow + SCHEDULE_TEMPLATE_DATA_ROW_COUNT - 1

  for (let r = firstDataRow; r <= lastDataRow; r++) {
    const row = schedule.addRow(['', '', '', '', ''])
    row.height = 30
    row.alignment = { vertical: 'middle', wrapText: true }

    const homeCell = schedule.getCell(r, 1)
    const awayCell = schedule.getCell(r, 2)
    const dateCell = schedule.getCell(r, 3)
    const timeCell = schedule.getCell(r, 4)
    const locationCell = schedule.getCell(r, 5)

    locationCell.alignment = { vertical: 'middle', wrapText: true }
  }

  const instructions = workbook.addWorksheet('How to fill in')
  instructions.getColumn(1).width = 22
  instructions.getColumn(2).width = 58
  for (const row of SCHEDULE_TEMPLATE_INSTRUCTIONS_ROWS) {
    const added = instructions.addRow(row)
    added.height = row[0] === '' && row[1] === '' ? 10 : 24
    added.alignment = { vertical: 'middle', wrapText: true }
  }
  instructions.getRow(1).font = { bold: true, size: 13 }
  if (names.length === 0) {
    instructions.addRow([''])
    const warn = instructions.addRow([
      'No teams in this season yet — add teams under Dashboard → Teams, then download the template again.',
    ])
    warn.height = 36
    warn.alignment = { wrapText: true }
    warn.font = { color: { argb: 'FFB45309' } }
  }

  const teamListRange = addVeryHiddenListSheet(workbook, 'ListTeams', names)
  const dateListRange = addVeryHiddenListSheet(workbook, 'ListDates', buildTemplateDateOptions())
  const timeListRange = addVeryHiddenListSheet(workbook, 'ListTimes', buildTemplateTimeOptions())

  for (let r = firstDataRow; r <= lastDataRow; r++) {
    applyListValidation(schedule.getCell(r, 1), teamListRange, 'Pick a team', 'Choose a team from the list.')
    applyListValidation(schedule.getCell(r, 2), teamListRange, 'Pick a team', 'Choose a team from the list.')
    applyListValidation(schedule.getCell(r, 3), dateListRange, 'Pick a date', 'Choose a date from the list.')
    applyListValidation(schedule.getCell(r, 4), timeListRange, 'Pick a time', 'Choose a time from the list.')
  }

  workbook.views = [
    {
      x: 0,
      y: 0,
      width: 24000,
      height: 12000,
      firstSheet: 0,
      activeTab: 0,
      visibility: 'visible',
    },
  ]

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

export function excelBufferToCsvText(buffer: ArrayBuffer): string {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === 'schedule') ?? workbook.SheetNames[0]
  if (!sheetName) return ''
  const sheet = workbook.Sheets[sheetName]
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
  })
  if (aoa.length === 0) return ''

  const headerCells = aoa[0].map((c) => String(c ?? ''))
  const hasHeader = looksLikeHeader(headerCells)
  const dateIdx = hasHeader ? headerColumnIndex(headerCells, 'date') : undefined
  const timeIdx = hasHeader ? headerColumnIndex(headerCells, 'time') : undefined
  const dateCol = dateIdx ?? 2
  const timeCol = timeIdx ?? 3
  const dataStart = hasHeader ? 1 : 0

  return aoa
    .map((row, rowIndex) => {
      const cells = row.map((cell, colIndex) => {
        let out: string
        if (rowIndex >= dataStart) {
          if (colIndex === dateCol) out = formatExcelScheduleDateCell(cell)
          else if (colIndex === timeCol) out = formatExcelScheduleTimeCell(cell)
          else out = String(cell ?? '').trim()
        } else {
          out = String(cell ?? '').trim()
        }
        return escapeCsvField(out)
      })
      return cells.join(',')
    })
    .join('\n')
}

export function detectScheduleFileKind(filename: string, mime: string): ScheduleImportFileKind | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'excel'
  if (
    lower.endsWith('.ics') ||
    lower.endsWith('.ical') ||
    mime.includes('text/calendar') ||
    mime.includes('application/ics')
  ) {
    return 'ics'
  }
  if (lower.endsWith('.csv') || mime.includes('csv') || mime.includes('text')) return 'csv'
  return null
}

export function scheduleImportTextFromUpload(
  buffer: ArrayBuffer,
  kind: ScheduleImportFileKind
): string {
  if (kind === 'excel') return excelBufferToCsvText(buffer)
  return new TextDecoder('utf-8').decode(buffer)
}

/** Parse an uploaded schedule file into import rows (CSV path or ICS). */
export function scheduleImportRowsFromUpload(
  buffer: ArrayBuffer,
  kind: ScheduleImportFileKind
): ParsedScheduleCsvRow[] {
  if (kind === 'ics') {
    return parseGamesScheduleIcs(scheduleImportTextFromUpload(buffer, kind))
  }
  return parseGamesScheduleCsv(scheduleImportTextFromUpload(buffer, kind))
}
