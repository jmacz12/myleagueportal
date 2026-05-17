import ExcelJS from 'exceljs'

export type StatSheetTemplatePlayer = {
  jersey_number: string | null
  full_name: string
  team_label: 'Home' | 'Away'
}

const HEADERS = [
  '#',
  'Player',
  'Team',
  'Play log (2 / 3 / 1)',
  '2PM',
  '3PM',
  'FTM',
  'PTS',
  'REB',
  'AST',
  'STL',
  'BLK',
  'TOV',
  'PF',
] as const

const COLUMN_WIDTHS = [6, 28, 12, 22, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6] as const

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

function addVeryHiddenListSheet(workbook: ExcelJS.Workbook, sheetName: string, values: string[]): string {
  const sheet = workbook.addWorksheet(sheetName, { state: 'veryHidden' })
  for (const value of values) sheet.addRow([value])
  return `'${sheetName}'!$A$1:$A$${values.length}`
}

export async function buildGameStatSheetTemplateXlsx(input: {
  gameLabel: string
  players: StatSheetTemplatePlayer[]
}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'MyLeaguePortal'

  const stats = workbook.addWorksheet('Stats', {
    views: [{ state: 'frozen', ySplit: 4 }],
  })

  HEADERS.forEach((_, i) => {
    stats.getColumn(i + 1).width = COLUMN_WIDTHS[i]
  })

  const info1 = stats.addRow([`Game: ${input.gameLabel}`])
  info1.height = 24
  info1.font = { bold: true, size: 12 }
  stats.addRow(['Play log: type 2, 3, or 1 (or F) for made shots — or fill the stat columns instead.'])
  stats.addRow(['Team column: pick Home or Away from the dropdown.'])
  stats.addRow([])

  const headerRow = stats.addRow([...HEADERS])
  headerRow.height = 30
  headerRow.font = { bold: true, size: 11 }
  headerRow.alignment = { vertical: 'middle', wrapText: true }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0EC' },
    }
  })

  const firstPlayerRow = 5
  let rowNum = firstPlayerRow
  for (const p of input.players) {
    const row = stats.addRow([
      p.jersey_number ?? '',
      p.full_name,
      p.team_label,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ])
    row.height = 28
    row.alignment = { vertical: 'middle', wrapText: true }
    rowNum++
  }

  const lastPlayerRow = Math.max(firstPlayerRow, rowNum - 1)

  const instructions = workbook.addWorksheet('How to fill in')
  instructions.getColumn(1).width = 24
  instructions.getColumn(2).width = 56
  const instructionRows = [
    ['Game stat sheet'],
    [''],
    ['1. Use the Stats tab (opens first).'],
    ['2. Each player row is prefilled — pick Home/Away if needed, then add stats.'],
    ['3. Play log example: 2 3 2 1 means 2pt, 3pt, 2pt, free throw.'],
    ['4. Or type totals in 2PM, 3PM, FTM, PTS, REB, etc.'],
    ['5. Upload this file on Dashboard → Stats for this game.'],
  ]
  for (const r of instructionRows) {
    const added = instructions.addRow(r)
    added.height = 22
    added.alignment = { wrapText: true }
  }

  const teamListRange = addVeryHiddenListSheet(workbook, 'ListTeams', ['Home', 'Away'])

  for (let r = firstPlayerRow; r <= lastPlayerRow; r++) {
    applyListValidation(stats.getCell(r, 3), teamListRange, 'Pick team', 'Choose Home or Away.')
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

export function buildGameStatSheetTemplateCsv(players: StatSheetTemplatePlayer[]): string {
  const lines = [HEADERS.join(',')]
  for (const p of players) {
    lines.push(
      [
        p.jersey_number ?? '',
        `"${p.full_name.replace(/"/g, '""')}"`,
        p.team_label,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ].join(',')
    )
  }
  return lines.join('\n')
}
