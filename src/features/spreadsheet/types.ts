import type { TableSummary } from '../../core/types'

export interface StaticSheetData {
  name: string
  headers: string[]
  rows: string[][]
}

export type SpreadsheetSource =
  | {
      kind: 'session'
      title: string
      schemaName: string
      tables: TableSummary[]
      initialTableName?: string
    }
  | {
      kind: 'static'
      title: string
      sheets: StaticSheetData[]
      initialSheetIndex?: number
    }

export type SliceMode = 'all' | 'head' | 'tail'

export interface SortSpec {
  columnIndex: number
  direction: 'asc' | 'desc'
}

export interface CellCoord {
  row: number
  col: number
}

export interface SelectionRange {
  start: CellCoord
  end: CellCoord
}

export interface SelectionSummary {
  cellCount: number
  numericCount: number
  sum: number
  avg: number
  min: number
  max: number
}

export interface ColumnProfileStats {
  columnName: string
  totalCount: number
  nonNullCount: number
  nullCount: number
  distinctCount: number
  numericCount: number
  min: string | null
  max: string | null
  mean: number | null
  topValues: Array<{ value: string; count: number }>
}
