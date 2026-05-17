/**
 * Smoke-test stat sheet CSV parsing (no auth).
 * Run: npm run verify:stats-import
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildStatSheetPreview,
  parseStatSheetCsv,
  previewRowsToConfirmStats,
} from '../lib/game-stats-sheet-csv'
import { parsePlayLog } from '../lib/game-stats-play-log'

const FIXTURE_CSV = join(__dirname, 'fixtures', 'stats-import-test.csv')

const MOCK_TEAMS = [
  { id: 'team-home', name: 'Home Hawks', side: 'home' as const },
  { id: 'team-away', name: 'Away Owls', side: 'away' as const },
]

const MOCK_ROSTER = [
  { id: 'p1', full_name: 'Jane Doe', jersey_number: '12', team_id: 'team-home' },
  { id: 'p2', full_name: 'John Smith', jersey_number: '4', team_id: 'team-away' },
]

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function runPlayLog() {
  const log = parsePlayLog('2 3 1')
  assert(log.fg2m === 1 && log.fg3m === 1 && log.ftm === 1 && log.pts === 6, 'play log 2 3 1 → 6 pts')
  console.log('✓ play log parser')
}

function runFixture() {
  const text = readFileSync(FIXTURE_CSV, 'utf8')
  const parsed = parseStatSheetCsv(text)
  assert(parsed.length === 2, `expected 2 rows, got ${parsed.length}`)

  const preview = buildStatSheetPreview(parsed, MOCK_TEAMS, MOCK_ROSTER)
  const ready = preview.filter((r) => r.ready)
  assert(ready.length === 2, `expected 2 ready rows, got ${ready.length} — ${JSON.stringify(preview.map((r) => r.errors))}`)

  const jane = ready.find((r) => r.player_id === 'p1')
  assert(jane?.resolved?.pts === 6, `Jane play log should be 6 PTS, got ${jane?.resolved?.pts}`)

  const john = ready.find((r) => r.player_id === 'p2')
  assert(john?.resolved?.pts === 7, `John totals should be 7 PTS, got ${john?.resolved?.pts}`)

  const confirm = previewRowsToConfirmStats(preview)
  assert(confirm.length === 2, 'confirm rows should be 2')
  console.log('✓ CSV fixture: 2 players parsed and ready')
}

function runEmptyPlayLogRejects() {
  const parsed = parseStatSheetCsv('jersey,player_name,team,play_log\n99,Nobody,Home,,,,,,,,,,,')
  const preview = buildStatSheetPreview(parsed, MOCK_TEAMS, MOCK_ROSTER)
  assert(!preview[0]?.ready, 'row with no stats should not be ready')
  console.log('✓ empty stat row rejected')
}

runPlayLog()
runFixture()
runEmptyPlayLogRejects()
console.log('\nAll stat sheet import checks passed.')
