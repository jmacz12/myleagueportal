/**
 * Smoke-test schedule CSV/Excel import parsing (no auth).
 * Run: npx tsx scripts/verify-schedule-import.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import {
  buildScheduleDownloadTemplate,
  buildScheduleDownloadTemplateXlsx,
  scheduleImportTextFromUpload,
  scheduleImportRowsFromUpload,
  detectScheduleFileKind,
  formatExcelScheduleDateCell,
  formatExcelScheduleTimeCell,
} from '../lib/games-schedule-import'
import { parseGamesScheduleIcs, parseTeamsFromIcsSummary } from '../lib/games-schedule-ics'
import {
  parseGamesScheduleCsv,
  buildScheduleImportPreview,
  finalizeScheduleImportPreview,
  isScheduleTemplatePlaceholderRow,
  refreshScheduleImportPreviewRow,
  previewRowsToConfirmGames,
} from '../lib/games-schedule-csv'

const FIXTURE_CSV = join(__dirname, 'fixtures', 'schedule-import-test.csv')
const FIXTURE_XLSX = join(__dirname, 'fixtures', 'schedule-import-test.xlsx')
const FIXTURE_ICS = join(__dirname, 'fixtures', 'schedule-import-test.ics')

const MOCK_TEAMS = [
  { id: 'team-a', name: '[SEED] Kitsilano Knights' },
  { id: 'team-b', name: '[SEED] Main St Motion' },
  { id: 'team-c', name: '[SEED] False Creek Forge' },
  { id: 'team-d', name: '[SEED] Commercial Drive' },
]

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function runCsvFixture() {
  const text = readFileSync(FIXTURE_CSV, 'utf8')
  const parsed = parseGamesScheduleCsv(text)
  assert(parsed.length === 2, `CSV: expected 2 rows, got ${parsed.length}`)
  const preview = buildScheduleImportPreview(parsed, MOCK_TEAMS)
  const ready = preview.filter((r) => r.ready)
  assert(ready.length === 2, `CSV: expected 2 ready rows, got ${ready.length} — ${JSON.stringify(preview.map((r) => r.errors))}`)
  console.log('✓ CSV fixture: 2 games parsed and ready')
}

function runTemplateSkip() {
  const template = buildScheduleDownloadTemplate([])
  const parsed = parseGamesScheduleCsv(template)
  assert(parsed.length === 0, 'CSV template header-only should parse to zero games')
  console.log('✓ CSV download template: header only (no placeholder games)')
}

async function runExcelRoundTrip() {
  const xlsxBytes = await buildScheduleDownloadTemplateXlsx(MOCK_TEAMS.map((t) => t.name))
  writeFileSync(FIXTURE_XLSX, xlsxBytes)

  const kind = detectScheduleFileKind('schedule-import-test.xlsx', '')
  assert(kind === 'excel', 'Expected excel file kind')

  const buffer = readFileSync(FIXTURE_XLSX).buffer
  const csvText = scheduleImportTextFromUpload(buffer, 'excel')
  const parsed = parseGamesScheduleCsv(csvText)
  assert(parsed.length === 0, 'Fresh template xlsx should have no filled game rows')

  const filledRows = [
    ['home_team', 'away_team', 'date', 'time', 'location'],
    ['[SEED] Kitsilano Knights', '[SEED] Main St Motion', '2026-06-20', '19:00', 'Court 1'],
    ['[SEED] False Creek Forge', '[SEED] Commercial Drive', '2026-06-22', '7:00 PM', 'Main gym'],
  ]
  const filledWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(filledWb, XLSX.utils.aoa_to_sheet(filledRows), 'Schedule')
  const filledXlsxPath = join(__dirname, 'fixtures', 'schedule-import-filled.xlsx')
  writeFileSync(filledXlsxPath, XLSX.write(filledWb, { type: 'buffer', bookType: 'xlsx' }))

  const filledBuffer = readFileSync(filledXlsxPath).buffer
  const filledFromXlsx = parseGamesScheduleCsv(scheduleImportTextFromUpload(filledBuffer, 'excel'))
  const filledPreview = buildScheduleImportPreview(filledFromXlsx, MOCK_TEAMS)
  assert(filledPreview.filter((r) => r.ready).length === 2, 'Filled Excel preview failed')

  const serialRows = [
    ['home_team', 'away_team', 'date', 'time', 'location'],
    ['[SEED] Kitsilano Knights', '[SEED] Main St Motion', 45532, 0.7916666667, 'Court 1'],
  ]
  const serialWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(serialWb, XLSX.utils.aoa_to_sheet(serialRows), 'Schedule')
  const serialBuf = XLSX.write(serialWb, { type: 'buffer', bookType: 'xlsx' })
  const serialParsed = parseGamesScheduleCsv(scheduleImportTextFromUpload(serialBuf, 'excel'))
  const serialPreview = buildScheduleImportPreview(serialParsed, MOCK_TEAMS)
  assert(
    serialPreview.length === 1 && serialPreview[0]?.ready,
    `Excel serial date/time row failed: ${JSON.stringify(serialPreview)}`
  )

  console.log('✓ Excel template builds; filled Excel parses to 2 ready games')
  console.log('✓ Excel native date/time serials convert for import')
  console.log(`  Wrote ${FIXTURE_XLSX}`)
}

function runExcelSerialCells() {
  assert(formatExcelScheduleDateCell(45532) === '2024-08-28', 'Excel date serial formatting failed')
  assert(formatExcelScheduleTimeCell(0.7916666667) === '19:00', 'Excel time serial formatting failed')
  console.log('✓ Excel serial date/time cells normalize to YYYY-MM-DD and HH:MM')
}

function runInAppTeamFix() {
  const parsed = parseGamesScheduleCsv(
    'home_team,away_team,date,time,location\nTypo Hawks,Main St Motion,2026-06-20,19:00,Court 1\n'
  )
  const preview = finalizeScheduleImportPreview(buildScheduleImportPreview(parsed, MOCK_TEAMS))
  assert(preview.length === 1 && !preview[0]!.ready, 'Typo row should start not ready')
  const fixed = refreshScheduleImportPreviewRow(preview[0]!, MOCK_TEAMS, { home_team_id: 'team-a' })
  assert(fixed.ready && fixed.home_team_id === 'team-a', 'Picking home team in UI should mark row ready')
  const { readyCount } = previewRowsToConfirmGames([fixed])
  assert(readyCount === 1, 'Confirm list should include fixed row')
  console.log('✓ In-app team pick fixes typo row without re-upload')
}

function runIcsFixture() {
  const text = readFileSync(FIXTURE_ICS, 'utf8')
  const kind = detectScheduleFileKind('schedule-import-test.ics', 'text/calendar')
  assert(kind === 'ics', 'Expected ics file kind')

  const vsTeams = parseTeamsFromIcsSummary('Knights vs Motion')
  assert(vsTeams?.home_team === 'Knights' && vsTeams.away_team === 'Motion', 'vs parsing failed')

  const atTeams = parseTeamsFromIcsSummary('Forge @ Drive')
  assert(atTeams?.home_team === 'Drive' && atTeams.away_team === 'Forge', '@ parsing failed')

  const parsed = parseGamesScheduleIcs(text)
  assert(parsed.length === 2, `ICS: expected 2 events (cancelled skipped), got ${parsed.length}`)

  const buffer = readFileSync(FIXTURE_ICS).buffer
  const fromUpload = scheduleImportRowsFromUpload(buffer, 'ics')
  assert(fromUpload.length === 2, 'ICS upload path should yield 2 rows')

  const preview = buildScheduleImportPreview(fromUpload, MOCK_TEAMS)
  const ready = preview.filter((r) => r.ready)
  assert(ready.length === 2, `ICS: expected 2 ready rows, got ${ready.length}`)
  console.log('✓ ICS fixture: vs and @ titles parse; cancelled events skipped')
}

function runPlaceholderDetection() {
  assert(
    isScheduleTemplatePlaceholderRow({
      home_team: '(Home team)',
      away_team: '(Away team)',
      date: '(Date)',
      time: '(Time)',
      location: '(Location)',
    }),
    'Placeholder detector failed'
  )
  console.log('✓ Placeholder row detection')
}

async function main() {
  runExcelSerialCells()
  runInAppTeamFix()
  runPlaceholderDetection()
  runTemplateSkip()
  runCsvFixture()
  runIcsFixture()
  await runExcelRoundTrip()
  console.log('\nAll schedule import smoke checks passed.')
}

void main()
