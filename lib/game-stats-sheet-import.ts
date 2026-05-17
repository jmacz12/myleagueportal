import * as XLSX from 'xlsx'
import { parseStatSheetCsv } from '@/lib/game-stats-sheet-csv'

export function statSheetExcelToCsvText(buffer: ArrayBuffer): string {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false })
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase() === 'stats') ?? workbook.SheetNames[0]
  if (!sheetName) return ''
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n' })
}

export function parseStatSheetUpload(buffer: ArrayBuffer, kind: 'csv' | 'excel'): ReturnType<typeof parseStatSheetCsv> {
  const text =
    kind === 'excel' ? statSheetExcelToCsvText(buffer) : new TextDecoder('utf-8').decode(buffer)
  return parseStatSheetCsv(text)
}

export function detectStatSheetFileKind(filename: string, mime: string): 'csv' | 'excel' | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'excel'
  if (lower.endsWith('.csv') || mime.includes('csv') || mime.includes('text')) return 'csv'
  return null
}
