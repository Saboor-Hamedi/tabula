import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { getDuckDBHandle } from '../../core/duckdb/initDuckDB'
import { tableColumns, tableToRows } from '../../core/duckdb/result'
import { qualifiedName } from '../../core/duckdb/sql'
import { buildCsv, downloadCsv } from '../../core/export/csv'
import { formatCount } from '../../core/utils/format'
import {
  BarChartIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  ExternalIcon,
  SearchIcon,
  SheetIcon,
  SlidersIcon,
} from '../common/Icons'
import type {
  SelectionRange,
  SliceMode,
  SortSpec,
  SpreadsheetSource,
  StaticSheetData,
} from './types'
import {
  compareCells,
  computeSelectionSummary,
  exportSheetsToXlsx,
  formatRangeLabel,
  normalizeRange,
  profileColumnValues,
  toExcelColumnLetter,
} from './utils'
import './spreadsheet.css'

const ROW_HEIGHT = 30
const OVERSCAN_ROWS = 10
const MAX_DUCKDB_SHEET_ROWS = 25_000
const SLICE_PRESETS = [5, 10, 25, 50, 100]

export interface SpreadsheetModalProps {
  source: SpreadsheetSource | null
  onClose: () => void
}

function formatCellDisplay(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function formatStatNum(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function SpreadsheetModal({ source, onClose }: SpreadsheetModalProps) {
  if (!source) return null
  return <SpreadsheetWorkbook source={source} onClose={onClose} />
}

function SpreadsheetWorkbook({
  source,
  onClose,
}: {
  source: SpreadsheetSource
  onClose: () => void
}) {
  const initialSheet = useMemo(() => {
    if (source.kind === 'session') {
      const idx = source.initialTableName
        ? source.tables.findIndex((t) => t.name === source.initialTableName)
        : 0
      return idx >= 0 ? idx : 0
    }
    return source.initialSheetIndex ?? 0
  }, [source])

  const [activeSheetIdx, setActiveSheetIdx] = useState(initialSheet)
  const [loadedSheets, setLoadedSheets] = useState<Record<number, StaticSheetData>>(() => {
    if (source.kind === 'static') {
      const map: Record<number, StaticSheetData> = {}
      source.sheets.forEach((s, idx) => {
        map[idx] = s
      })
      return map
    }
    return {}
  })
  const [loadingSheet, setLoadingSheet] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [truncatedNotice, setTruncatedNotice] = useState<number | null>(null)

  // Exploration state
  const [searchQuery, setSearchQuery] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<number, string>>({})
  const [sortSpec, setSortSpec] = useState<SortSpec | null>(null)
  const [sliceMode, setSliceMode] = useState<SliceMode>('all')
  const [sliceCount, setSliceCount] = useState(25)
  const [wrapCells, setWrapCells] = useState(false)
  const [showStatsDrawer, setShowStatsDrawer] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copiedSelection, setCopiedSelection] = useState(false)
  const [copiedFormula, setCopiedFormula] = useState(false)

  // Column widths & menus
  const [colWidths, setColWidths] = useState<Record<number, number>>({})
  const [openColMenu, setOpenColMenu] = useState<number | null>(null)

  // Selection state
  const [selection, setSelection] = useState<SelectionRange | null>({
    start: { row: 0, col: 0 },
    end: { row: 0, col: 0 },
  })
  const [isDragging, setIsDragging] = useState(false)

  // Virtual scroll state
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(520)

  const sheetList = useMemo(() => {
    if (source.kind === 'static') {
      return source.sheets.map((s) => ({
        name: s.name,
        rowCount: s.rows.length,
      }))
    }
    return source.tables.map((t) => ({
      name: t.name,
      rowCount: t.rowCount,
    }))
  }, [source])

  const loadSessionSheet = useCallback(
    async (index: number): Promise<StaticSheetData | null> => {
      if (source.kind !== 'session') return loadedSheets[index] ?? null
      const tableSummary = source.tables[index]
      if (!tableSummary) return null

      if (loadedSheets[index]) return loadedSheets[index]

      const handle = getDuckDBHandle()
      const target = qualifiedName(source.schemaName, tableSummary.name)
      const arrowTable = await handle.connection.query(
        `SELECT * FROM ${target} LIMIT ${MAX_DUCKDB_SHEET_ROWS}`,
      )
      const cols = tableColumns(arrowTable)
      const rawRows = tableToRows(arrowTable)
      const rows = rawRows.map((record) => cols.map((c) => formatCellDisplay(record[c])))

      const sheetData: StaticSheetData = {
        name: tableSummary.name,
        headers: cols,
        rows,
      }
      setLoadedSheets((prev) => ({ ...prev, [index]: sheetData }))
      if ((tableSummary.rowCount ?? 0) > MAX_DUCKDB_SHEET_ROWS) {
        setTruncatedNotice(tableSummary.rowCount)
      } else {
        setTruncatedNotice(null)
      }
      return sheetData
    },
    [source, loadedSheets],
  )

  // Load active DuckDB sheet on mount or tab change
  useEffect(() => {
    if (source.kind !== 'session') return
    if (loadedSheets[activeSheetIdx]) {
      const total = source.tables[activeSheetIdx]?.rowCount ?? 0
      setTruncatedNotice(total > MAX_DUCKDB_SHEET_ROWS ? total : null)
      return
    }
    let cancelled = false
    setLoadingSheet(true)
    setLoadError(null)
    void loadSessionSheet(activeSheetIdx)
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to read table rows.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSheet(false)
      })
    return () => {
      cancelled = true
    }
  }, [source, activeSheetIdx, loadedSheets, loadSessionSheet])

  // Reset sort/filter/selection cleanly when switching sheets
  const handleSelectSheet = (idx: number) => {
    if (idx === activeSheetIdx) return
    setActiveSheetIdx(idx)
    setSortSpec(null)
    setColumnFilters({})
    setSearchQuery('')
    setOpenColMenu(null)
    setColWidths({})
    setSelection({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } })
    setScrollTop(0)
    if (gridContainerRef.current) gridContainerRef.current.scrollTop = 0
  }

  const currentSheet = loadedSheets[activeSheetIdx] ?? {
    name: sheetList[activeSheetIdx]?.name ?? 'Sheet1',
    headers: [],
    rows: [],
  }

  // Compute initial auto-widths once per sheet
  const computedColWidths = useMemo(() => {
    return currentSheet.headers.map((header, idx) => {
      if (colWidths[idx] !== undefined) return colWidths[idx]
      let maxLen = header.length
      const sample = Math.min(currentSheet.rows.length, 60)
      for (let r = 0; r < sample; r++) {
        const len = (currentSheet.rows[r]?.[idx] ?? '').length
        if (len > maxLen) maxLen = len
      }
      return Math.min(Math.max(maxLen * 8 + 44, 110), 280)
    })
  }, [currentSheet.headers, currentSheet.rows, colWidths])

  // Track original 1-based row numbers so Tail/Sort/Filter remain transparent
  const processedRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const activeFilters = Object.entries(columnFilters).filter(([, v]) => v.trim().length > 0)

    let indexed = currentSheet.rows.map((cells, origIdx) => ({
      origRowNum: origIdx + 1,
      cells,
    }))

    if (query) {
      indexed = indexed.filter((item) =>
        item.cells.some((c) => c.toLowerCase().includes(query)),
      )
    }

    if (activeFilters.length > 0) {
      indexed = indexed.filter((item) =>
        activeFilters.every(([colIdxStr, filterText]) => {
          const val = (item.cells[Number(colIdxStr)] ?? '').toLowerCase()
          return val.includes(filterText.trim().toLowerCase())
        }),
      )
    }

    if (sortSpec) {
      const { columnIndex, direction } = sortSpec
      indexed = [...indexed].sort((a, b) =>
        compareCells(a.cells[columnIndex] ?? '', b.cells[columnIndex] ?? '', direction),
      )
    }

    if (sliceMode === 'head') {
      indexed = indexed.slice(0, Math.max(1, sliceCount))
    } else if (sliceMode === 'tail') {
      indexed = indexed.slice(-Math.max(1, sliceCount))
    }

    return indexed
  }, [currentSheet.rows, searchQuery, columnFilters, sortSpec, sliceMode, sliceCount])

  const visibleMatrix = useMemo(() => processedRows.map((item) => item.cells), [processedRows])

  // Measure viewport height dynamically
  useEffect(() => {
    const el = gridContainerRef.current
    if (!el) return
    const updateHeight = () => setViewportHeight(el.clientHeight || 520)
    updateHeight()
    const ro = new ResizeObserver(updateHeight)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isFullscreen, showStatsDrawer, currentSheet.headers.length])

  // End drag selection on mouseup anywhere
  useEffect(() => {
    if (!isDragging) return
    const stop = () => setIsDragging(false)
    window.addEventListener('mouseup', stop)
    return () => window.removeEventListener('mouseup', stop)
  }, [isDragging])

  // Close column menu on outside click
  useEffect(() => {
    if (openColMenu === null) return
    const onDown = () => setOpenColMenu(null)
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [openColMenu])

  // Active cell details
  const activeCoord = selection?.end ?? { row: 0, col: 0 }
  const activeCellValue =
    processedRows[activeCoord.row]?.cells[activeCoord.col] ?? ''
  const activeColumnName = currentSheet.headers[activeCoord.col] ?? ''

  const selectionSummary = useMemo(
    () => computeSelectionSummary(visibleMatrix, selection),
    [visibleMatrix, selection],
  )

  const activeColumnStats = useMemo(() => {
    if (!showStatsDrawer || currentSheet.headers.length === 0) return null
    const colIdx = Math.min(activeCoord.col, currentSheet.headers.length - 1)
    return profileColumnValues(
      currentSheet.headers[colIdx] ?? 'Column',
      visibleMatrix,
      colIdx,
    )
  }, [showStatsDrawer, currentSheet.headers, activeCoord.col, visibleMatrix])

  const handleCopySelection = useCallback(async () => {
    if (!selection || processedRows.length === 0) return
    const { minRow, maxRow, minCol, maxCol } = normalizeRange(selection)
    const lines: string[] = []
    for (let r = minRow; r <= maxRow && r < processedRows.length; r++) {
      const row = processedRows[r].cells
      const slice: string[] = []
      for (let c = minCol; c <= maxCol && c < currentSheet.headers.length; c++) {
        slice.push((row[c] ?? '').replace(/\t|\r?\n/g, ' '))
      }
      lines.push(slice.join('\t'))
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopiedSelection(true)
      window.setTimeout(() => setCopiedSelection(false), 1500)
    } catch {
      // Ignore clipboard rejection
    }
  }, [selection, processedRows, currentSheet.headers.length])

  // Global Esc & Ctrl+C handling
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (openColMenu !== null) {
          setOpenColMenu(null)
          return
        }
        onClose()
        return
      }
      const target = event.target as HTMLElement | null
      const inInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (!inInput && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        void handleCopySelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, openColMenu, handleCopySelection])

  // Grid arrow navigation
  const handleGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
    if (processedRows.length === 0 || currentSheet.headers.length === 0) return

    const cur = selection?.end ?? { row: 0, col: 0 }
    let nextRow = cur.row
    let nextCol = cur.col

    if (event.key === 'ArrowDown') nextRow = Math.min(processedRows.length - 1, cur.row + 1)
    else if (event.key === 'ArrowUp') nextRow = Math.max(0, cur.row - 1)
    else if (event.key === 'ArrowRight' || (event.key === 'Tab' && !event.shiftKey)) {
      nextCol = Math.min(currentSheet.headers.length - 1, cur.col + 1)
    } else if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) {
      nextCol = Math.max(0, cur.col - 1)
    } else if (event.key === 'Home') {
      nextCol = 0
    } else if (event.key === 'End') {
      nextCol = currentSheet.headers.length - 1
    } else {
      return
    }

    event.preventDefault()
    if (event.shiftKey && event.key !== 'Tab') {
      setSelection((prev) => ({
        start: prev?.start ?? { row: 0, col: 0 },
        end: { row: nextRow, col: nextCol },
      }))
    } else {
      setSelection({ start: { row: nextRow, col: nextCol }, end: { row: nextRow, col: nextCol } })
    }
  }

  // Column resize drag handler
  const startColumnResize = (colIdx: number, event: ReactMouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = computedColWidths[colIdx] ?? 140

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      setColWidths((prev) => ({
        ...prev,
        [colIdx]: Math.max(70, Math.min(600, startWidth + delta)),
      }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Toggle sort on column click
  const toggleSort = (colIdx: number, direction?: 'asc' | 'desc') => {
    setSortSpec((prev) => {
      if (direction) return { columnIndex: colIdx, direction }
      if (prev?.columnIndex === colIdx) {
        if (prev.direction === 'asc') return { columnIndex: colIdx, direction: 'desc' }
        return null
      }
      return { columnIndex: colIdx, direction: 'asc' }
    })
  }

  // Exports
  const handleExportCsv = () => {
    const base = source.title.replace(/\.[^.]+$/, '') || 'tabula-sheet'
    downloadCsv(`${base}-${currentSheet.name}.csv`, buildCsv(currentSheet.headers, visibleMatrix))
  }

  const handleExportXlsx = async () => {
    const base = source.title.replace(/\.[^.]+$/, '') || 'tabula-workbook'
    // If filtered/sliced on active sheet, export current active view cleanly; if untouched multi-sheet workbook, export all sheets
    const hasViewTransforms =
      Boolean(searchQuery.trim()) ||
      Object.values(columnFilters).some((v) => v.trim().length > 0) ||
      Boolean(sortSpec) ||
      sliceMode !== 'all'

    if (hasViewTransforms) {
      exportSheetsToXlsx(base, [
        {
          name: currentSheet.name,
          headers: currentSheet.headers,
          rows: visibleMatrix,
        },
      ])
      return
    }

    const sheetsToExport: StaticSheetData[] = []
    for (let i = 0; i < sheetList.length; i++) {
      const sheet = loadedSheets[i] ?? (await loadSessionSheet(i))
      if (sheet) sheetsToExport.push(sheet)
    }
    if (sheetsToExport.length > 0) {
      exportSheetsToXlsx(base, sheetsToExport)
    }
  }

  // Windowed virtual slice
  const useVirtual = !wrapCells && processedRows.length > 80
  const startRowIdx = useVirtual
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS)
    : 0
  const visibleRowCount = useVirtual
    ? Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2
    : processedRows.length
  const endRowIdx = useVirtual
    ? Math.min(processedRows.length, startRowIdx + visibleRowCount)
    : processedRows.length
  const renderedRows = processedRows.slice(startRowIdx, endRowIdx)
  const topSpacerHeight = useVirtual ? startRowIdx * ROW_HEIGHT : 0
  const bottomSpacerHeight = useVirtual
    ? Math.max(0, (processedRows.length - endRowIdx) * ROW_HEIGHT)
    : 0

  const normRange = selection ? normalizeRange(selection) : null

  const modalNode = (
    <div
      className="sheet-modal-backdrop"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className={`sheet-modal ${isFullscreen ? 'is-fullscreen' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Spreadsheet workbook: ${source.title}`}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleGridKeyDown}
        tabIndex={-1}
      >
        {/* 1. Title Bar */}
        <header className="sheet-titlebar">
          <div className="sheet-title-left">
            <span className="sheet-app-badge" aria-hidden>
              <SheetIcon size={15} />
            </span>
            <div className="sheet-title-copy">
              <strong className="sheet-title-name">{source.title}</strong>
              <span className="sheet-title-meta">
                {formatCount(processedRows.length)}
                {processedRows.length !== currentSheet.rows.length
                  ? ` of ${formatCount(currentSheet.rows.length)}`
                  : ''}{' '}
                rows × {currentSheet.headers.length} cols
                {truncatedNotice
                  ? ` (first ${formatCount(MAX_DUCKDB_SHEET_ROWS)} of ${formatCount(truncatedNotice)} loaded)`
                  : ''}
              </span>
            </div>
          </div>

          <div className="sheet-title-actions">
            <button
              type="button"
              className="sheet-action-btn is-excel"
              onClick={() => void handleExportXlsx()}
              title="Download real Excel workbook (.xlsx)"
            >
              <DownloadIcon size={13} />
              <span>Export Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              className="sheet-action-btn"
              onClick={handleExportCsv}
              title="Download active view as CSV"
            >
              <DownloadIcon size={13} />
              <span>CSV</span>
            </button>
            <button
              type="button"
              className="sheet-icon-btn"
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? 'Restore window size' : 'Full screen'}
              aria-label={isFullscreen ? 'Restore window size' : 'Full screen'}
            >
              <ExternalIcon size={15} />
            </button>
            <button
              type="button"
              className="sheet-icon-btn"
              onClick={onClose}
              title="Close workbook (Esc)"
              aria-label="Close workbook"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </header>

        {/* 2. Excel Ribbon / Exploration Controls */}
        <div className="sheet-toolbar">
          {/* Slice Mode: All / Head / Tail */}
          <div className="sheet-toolbar-group" role="group" aria-label="Row slice mode">
            <span className="sheet-toolbar-label">View:</span>
            <div className="sheet-segmented">
              <button
                type="button"
                className={`sheet-seg-btn ${sliceMode === 'all' ? 'is-active' : ''}`}
                onClick={() => setSliceMode('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`sheet-seg-btn ${sliceMode === 'head' ? 'is-active' : ''}`}
                onClick={() => setSliceMode('head')}
              >
                Head
              </button>
              <button
                type="button"
                className={`sheet-seg-btn ${sliceMode === 'tail' ? 'is-active' : ''}`}
                onClick={() => setSliceMode('tail')}
              >
                Tail
              </button>
            </div>

            {sliceMode !== 'all' ? (
              <div className="sheet-slice-counts">
                {SLICE_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`sheet-preset-btn ${sliceCount === n ? 'is-active' : ''}`}
                    onClick={() => setSliceCount(n)}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={25000}
                  value={sliceCount}
                  onChange={(e) => {
                    const num = Number.parseInt(e.target.value, 10)
                    if (Number.isFinite(num) && num > 0) setSliceCount(num)
                  }}
                  className="sheet-count-input"
                  aria-label="Custom row count"
                  title="Custom row count"
                />
              </div>
            ) : null}
          </div>

          <div className="sheet-toolbar-divider" />

          {/* Global Search */}
          <div className="sheet-search-box">
            <SearchIcon size={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setScrollTop(0)
                if (gridContainerRef.current) gridContainerRef.current.scrollTop = 0
              }}
              placeholder="Find across all cells…"
              aria-label="Search cells"
            />
            {searchQuery ? (
              <button
                type="button"
                className="sheet-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <CloseIcon size={12} />
              </button>
            ) : null}
          </div>

          {/* Right Utilities */}
          <div className="sheet-toolbar-right">
            {sortSpec ? (
              <button
                type="button"
                className="sheet-filter-pill"
                onClick={() => setSortSpec(null)}
                title="Clear sort"
              >
                <span>
                  Sort: {currentSheet.headers[sortSpec.columnIndex]}{' '}
                  {sortSpec.direction === 'asc' ? '↑' : '↓'}
                </span>
                <CloseIcon size={11} />
              </button>
            ) : null}

            {Object.entries(columnFilters)
              .filter(([, v]) => v.trim().length > 0)
              .map(([colIdxStr, val]) => (
                <button
                  key={colIdxStr}
                  type="button"
                  className="sheet-filter-pill"
                  onClick={() =>
                    setColumnFilters((prev) => {
                      const next = { ...prev }
                      delete next[Number(colIdxStr)]
                      return next
                    })
                  }
                  title="Clear column filter"
                >
                  <span>
                    {currentSheet.headers[Number(colIdxStr)]}: "{val}"
                  </span>
                  <CloseIcon size={11} />
                </button>
              ))}

            <button
              type="button"
              className={`sheet-tool-btn ${wrapCells ? 'is-active' : ''}`}
              onClick={() => setWrapCells((v) => !v)}
              title="Toggle text wrapping inside cells"
            >
              <SlidersIcon size={12} />
              <span>Wrap</span>
            </button>

            <button
              type="button"
              className={`sheet-tool-btn ${showStatsDrawer ? 'is-active' : ''}`}
              onClick={() => setShowStatsDrawer((v) => !v)}
              title="Inspect statistics for active column"
            >
              <BarChartIcon size={12} />
              <span>Column Stats</span>
            </button>

            <button
              type="button"
              className="sheet-tool-btn"
              onClick={() => void handleCopySelection()}
              title="Copy selected range (Ctrl+C)"
            >
              {copiedSelection ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
              <span>{copiedSelection ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* 3. Formula / Cell Inspector Bar (Name Box | fx) */}
        <div className="sheet-formulabar">
          <div className="sheet-namebox" title={`Active column: ${activeColumnName}`}>
            {formatRangeLabel(selection)}
          </div>
          <div className="sheet-fx-badge" aria-hidden>
            fx
          </div>
          <div className="sheet-fx-input-wrap">
            <input
              type="text"
              readOnly
              value={activeCellValue}
              placeholder="Click any cell to inspect its complete value…"
              aria-label="Active cell value"
              className="sheet-fx-input"
            />
            {activeCellValue ? (
              <button
                type="button"
                className="sheet-fx-copy"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(activeCellValue)
                    setCopiedFormula(true)
                    window.setTimeout(() => setCopiedFormula(false), 1400)
                  } catch {
                    // Ignore
                  }
                }}
                title="Copy full cell value"
              >
                {copiedFormula ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
              </button>
            ) : null}
          </div>
        </div>

        {/* 4. Main Workspace: Excel Grid + Optional Column Stats Drawer */}
        <div className="sheet-workspace">
          <div
            ref={gridContainerRef}
            className={`sheet-grid-scroll ${wrapCells ? 'is-wrapped' : ''}`}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            {loadingSheet ? (
              <div className="sheet-state-box">
                <span className="spinner" />
                <span>Loading spreadsheet rows…</span>
              </div>
            ) : loadError ? (
              <div className="sheet-state-box is-error">{loadError}</div>
            ) : currentSheet.headers.length === 0 ? (
              <div className="sheet-state-box">This sheet has no readable columns.</div>
            ) : (
              <table className="sheet-grid">
                <thead>
                  {/* Row A: Excel Column Letters */}
                  <tr className="sheet-letters-row">
                    <th className="sheet-corner-cell" scope="col" aria-label="Select all">
                      <button
                        type="button"
                        className="sheet-corner-btn"
                        onClick={() => {
                          if (processedRows.length > 0 && currentSheet.headers.length > 0) {
                            setSelection({
                              start: { row: 0, col: 0 },
                              end: {
                                row: processedRows.length - 1,
                                col: currentSheet.headers.length - 1,
                              },
                            })
                          }
                        }}
                        title="Select all visible cells"
                      />
                    </th>
                    {currentSheet.headers.map((_h, colIdx) => {
                      const isColSelected =
                        normRange !== null &&
                        colIdx >= normRange.minCol &&
                        colIdx <= normRange.maxCol
                      const width = computedColWidths[colIdx] ?? 140
                      return (
                        <th
                          key={`letter-${colIdx}`}
                          scope="col"
                          className={`sheet-col-letter ${isColSelected ? 'is-active' : ''}`}
                          style={{ width, minWidth: width, maxWidth: width }}
                          onClick={() => {
                            if (processedRows.length > 0) {
                              setSelection({
                                start: { row: 0, col: colIdx },
                                end: { row: processedRows.length - 1, col: colIdx },
                              })
                            }
                          }}
                          title="Click to select entire column"
                        >
                          <span>{toExcelColumnLetter(colIdx)}</span>
                          <span
                            className="sheet-col-resizer"
                            onMouseDown={(e) => startColumnResize(colIdx, e)}
                            role="separator"
                            aria-orientation="vertical"
                          />
                        </th>
                      )
                    })}
                  </tr>

                  {/* Row B: Dataset Column Headers + Sort & Filter */}
                  <tr className="sheet-headers-row">
                    <th className="sheet-gutter-head" scope="col">
                      #
                    </th>
                    {currentSheet.headers.map((header, colIdx) => {
                      const width = computedColWidths[colIdx] ?? 140
                      const sorted = sortSpec?.columnIndex === colIdx ? sortSpec.direction : null
                      const hasFilter = Boolean(columnFilters[colIdx]?.trim())
                      return (
                        <th
                          key={`head-${colIdx}`}
                          scope="col"
                          className={`sheet-col-head ${sorted ? 'is-sorted' : ''} ${hasFilter ? 'is-filtered' : ''}`}
                          style={{ width, minWidth: width, maxWidth: width }}
                        >
                          <div className="sheet-col-head-inner">
                            <button
                              type="button"
                              className="sheet-col-sort-btn"
                              onClick={() => toggleSort(colIdx)}
                              title={`Click to sort ${header}`}
                            >
                              <span className="sheet-col-name">{header}</span>
                              {sorted ? (
                                <span className="sheet-sort-arrow">
                                  {sorted === 'asc' ? '↑' : '↓'}
                                </span>
                              ) : null}
                            </button>

                            <button
                              type="button"
                              className={`sheet-col-menu-trigger ${hasFilter ? 'is-filtered' : ''}`}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenColMenu((prev) => (prev === colIdx ? null : colIdx))
                              }}
                              title="Sort, filter, or inspect column"
                              aria-label={`Column options for ${header}`}
                            >
                              <ChevronDownIcon size={12} />
                            </button>
                          </div>

                          {openColMenu === colIdx ? (
                            <div
                              className="sheet-col-popover"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="sheet-popover-item"
                                onClick={() => {
                                  toggleSort(colIdx, 'asc')
                                  setOpenColMenu(null)
                                }}
                              >
                                Sort A → Z (Smallest first)
                              </button>
                              <button
                                type="button"
                                className="sheet-popover-item"
                                onClick={() => {
                                  toggleSort(colIdx, 'desc')
                                  setOpenColMenu(null)
                                }}
                              >
                                Sort Z → A (Largest first)
                              </button>
                              <button
                                type="button"
                                className="sheet-popover-item"
                                onClick={() => {
                                  setSelection({
                                    start: { row: 0, col: colIdx },
                                    end: { row: Math.max(0, processedRows.length - 1), col: colIdx },
                                  })
                                  setShowStatsDrawer(true)
                                  setOpenColMenu(null)
                                }}
                              >
                                View Column Stats
                              </button>
                              <div className="sheet-popover-filter">
                                <input
                                  type="text"
                                  autoFocus
                                  value={columnFilters[colIdx] ?? ''}
                                  onChange={(e) =>
                                    setColumnFilters((prev) => ({
                                      ...prev,
                                      [colIdx]: e.target.value,
                                    }))
                                  }
                                  placeholder={`Filter ${header}…`}
                                />
                                {hasFilter ? (
                                  <button
                                    type="button"
                                    className="sheet-popover-clear"
                                    onClick={() => {
                                      setColumnFilters((prev) => {
                                        const next = { ...prev }
                                        delete next[colIdx]
                                        return next
                                      })
                                      setOpenColMenu(null)
                                    }}
                                  >
                                    Clear filter
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ) : null}

                          <span
                            className="sheet-col-resizer"
                            onMouseDown={(e) => startColumnResize(colIdx, e)}
                            role="separator"
                            aria-orientation="vertical"
                          />
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                <tbody>
                  {topSpacerHeight > 0 ? (
                    <tr aria-hidden style={{ height: topSpacerHeight }}>
                      <td colSpan={currentSheet.headers.length + 1} className="sheet-spacer-cell" />
                    </tr>
                  ) : null}

                  {renderedRows.length === 0 ? (
                    <tr>
                      <td colSpan={currentSheet.headers.length + 1} className="sheet-empty-row">
                        No matching rows found. Clear your search or column filters to see all rows.
                      </td>
                    </tr>
                  ) : (
                    renderedRows.map((item, offsetIdx) => {
                      const rowIdx = startRowIdx + offsetIdx
                      const isRowHighlighted =
                        normRange !== null &&
                        rowIdx >= normRange.minRow &&
                        rowIdx <= normRange.maxRow

                      return (
                        <tr key={item.origRowNum} className="sheet-data-row">
                          <th
                            scope="row"
                            className={`sheet-row-num ${isRowHighlighted ? 'is-active' : ''}`}
                            onClick={() =>
                              setSelection({
                                start: { row: rowIdx, col: 0 },
                                end: { row: rowIdx, col: currentSheet.headers.length - 1 },
                              })
                            }
                            title={`Row ${item.origRowNum}`}
                          >
                            {item.origRowNum}
                          </th>
                          {currentSheet.headers.map((_h, colIdx) => {
                            const width = computedColWidths[colIdx] ?? 140
                            const val = item.cells[colIdx] ?? ''
                            const inSelection =
                              normRange !== null &&
                              rowIdx >= normRange.minRow &&
                              rowIdx <= normRange.maxRow &&
                              colIdx >= normRange.minCol &&
                              colIdx <= normRange.maxCol
                            const isActiveCell =
                              activeCoord.row === rowIdx && activeCoord.col === colIdx
                            const isNum =
                              val.trim() !== '' && /^-?[$€£]?[\d,]+(\.\d+)?%?$/.test(val.trim())

                            return (
                              <td
                                key={colIdx}
                                style={{ width, minWidth: width, maxWidth: width }}
                                className={`sheet-cell ${inSelection ? 'is-selected' : ''} ${isActiveCell ? 'is-active' : ''} ${isNum ? 'is-numeric' : ''}`}
                                onMouseDown={(e) => {
                                  if (e.button !== 0) return
                                  if (e.shiftKey && selection) {
                                    setSelection({
                                      start: selection.start,
                                      end: { row: rowIdx, col: colIdx },
                                    })
                                  } else {
                                    setSelection({
                                      start: { row: rowIdx, col: colIdx },
                                      end: { row: rowIdx, col: colIdx },
                                    })
                                    setIsDragging(true)
                                  }
                                }}
                                onMouseEnter={() => {
                                  if (isDragging) {
                                    setSelection((prev) => ({
                                      start: prev?.start ?? { row: rowIdx, col: colIdx },
                                      end: { row: rowIdx, col: colIdx },
                                    }))
                                  }
                                }}
                              >
                                <span className="sheet-cell-text">{val}</span>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  )}

                  {bottomSpacerHeight > 0 ? (
                    <tr aria-hidden style={{ height: bottomSpacerHeight }}>
                      <td colSpan={currentSheet.headers.length + 1} className="sheet-spacer-cell" />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>

          {/* Optional Column Statistics Drawer */}
          {showStatsDrawer && activeColumnStats ? (
            <aside className="sheet-stats-drawer" aria-label="Column statistics">
              <div className="sheet-stats-head">
                <strong>{activeColumnStats.columnName}</strong>
                <button
                  type="button"
                  className="sheet-icon-btn"
                  onClick={() => setShowStatsDrawer(false)}
                  aria-label="Close column stats"
                >
                  <CloseIcon size={14} />
                </button>
              </div>
              <div className="sheet-stats-grid">
                <div className="sheet-stat-card">
                  <span>Rows</span>
                  <strong>{formatCount(activeColumnStats.totalCount)}</strong>
                </div>
                <div className="sheet-stat-card">
                  <span>Unique</span>
                  <strong>{formatCount(activeColumnStats.distinctCount)}</strong>
                </div>
                <div className="sheet-stat-card">
                  <span>Missing</span>
                  <strong>{formatCount(activeColumnStats.nullCount)}</strong>
                </div>
                <div className="sheet-stat-card">
                  <span>Non-empty</span>
                  <strong>{formatCount(activeColumnStats.nonNullCount)}</strong>
                </div>
              </div>

              {activeColumnStats.mean !== null ? (
                <div className="sheet-stats-numeric">
                  <div>
                    <span>Mean</span>
                    <strong>{formatStatNum(activeColumnStats.mean)}</strong>
                  </div>
                  <div>
                    <span>Min</span>
                    <strong>{activeColumnStats.min ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Max</span>
                    <strong>{activeColumnStats.max ?? '—'}</strong>
                  </div>
                </div>
              ) : activeColumnStats.min !== null ? (
                <div className="sheet-stats-numeric">
                  <div>
                    <span>First (A–Z)</span>
                    <strong>{activeColumnStats.min}</strong>
                  </div>
                  <div>
                    <span>Last (Z–A)</span>
                    <strong>{activeColumnStats.max}</strong>
                  </div>
                </div>
              ) : null}

              <div className="sheet-stats-top">
                <div className="sheet-stats-top-title">Top Values</div>
                {activeColumnStats.topValues.length === 0 ? (
                  <span className="sheet-stats-empty">No non-empty values</span>
                ) : (
                  activeColumnStats.topValues.map((tv) => {
                    const pct = Math.round(
                      (tv.count / Math.max(activeColumnStats.nonNullCount, 1)) * 100,
                    )
                    return (
                      <div key={tv.value} className="sheet-top-bar-item">
                        <div className="sheet-top-bar-row">
                          <span className="sheet-top-val" title={tv.value}>
                            {tv.value}
                          </span>
                          <span className="sheet-top-cnt">
                            {formatCount(tv.count)} ({pct}%)
                          </span>
                        </div>
                        <div className="sheet-top-track">
                          <div className="sheet-top-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </aside>
          ) : null}
        </div>

        {/* 5. Bottom Excel Sheet Tabs & Live Selection Math Status Bar */}
        <footer className="sheet-statusbar">
          <div className="sheet-tabs-strip" role="tablist" aria-label="Workbook sheets">
            {sheetList.map((sheet, idx) => (
              <button
                key={`${sheet.name}-${idx}`}
                type="button"
                role="tab"
                aria-selected={activeSheetIdx === idx}
                className={`sheet-bottom-tab ${activeSheetIdx === idx ? 'is-active' : ''}`}
                onClick={() => handleSelectSheet(idx)}
              >
                <span>{sheet.name}</span>
                <span className="sheet-tab-count">{formatCount(sheet.rowCount)}</span>
              </button>
            ))}
          </div>

          <div className="sheet-selection-stats" aria-live="polite">
            {selectionSummary.cellCount > 0 ? (
              <>
                <span>
                  Count: <strong>{selectionSummary.cellCount.toLocaleString()}</strong>
                </span>
                {selectionSummary.numericCount > 0 ? (
                  <>
                    <span>
                      Sum: <strong>{formatStatNum(selectionSummary.sum)}</strong>
                    </span>
                    <span>
                      Avg: <strong>{formatStatNum(selectionSummary.avg)}</strong>
                    </span>
                    <span>
                      Min: <strong>{formatStatNum(selectionSummary.min)}</strong>
                    </span>
                    <span>
                      Max: <strong>{formatStatNum(selectionSummary.max)}</strong>
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <span>Ready · Shift+Click or drag to calculate Sum / Avg / Min / Max</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode
}
