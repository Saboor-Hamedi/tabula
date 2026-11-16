import * as XLSX from "xlsx";
import type { SheetInfo } from "../types";
import { normalizeIdentifier, uniqueIdentifier } from "./sql";

/** Fully converted worksheet, ready for DuckDB ingestion. */
export interface ConvertedSheet {
  name: string;
  csv: string;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = typeof value === "string" ? value : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildColumnNames(headerRow: unknown[], width: number): string[] {
  const used = new Set<string>();
  const names: string[] = [];
  const safeHeader = Array.isArray(headerRow) ? headerRow : [];

  for (let index = 0; index < width; index += 1) {
    const rawHeader = safeHeader[index];
    const fallback = `column_${index + 1}`;
    const headerText =
      rawHeader === null || rawHeader === undefined
        ? fallback
        : String(rawHeader).trim();
    const base = normalizeIdentifier(
      headerText.length > 0 ? headerText : fallback,
      fallback,
    );
    names.push(uniqueIdentifier(base, used));
  }

  return names;
}

function countNonEmptyCells(row: unknown[]): { total: number; strings: number } {
  let total = 0;
  let strings = 0;
  for (const cell of row) {
    if (cell === null || cell === undefined) continue;
    if (typeof cell === "string") {
      const trimmed = cell.trim();
      if (trimmed.length === 0) continue;
      total += 1;
      if (Number.isNaN(Number(trimmed))) strings += 1;
    } else {
      total += 1;
    }
  }
  return { total, strings };
}

function parseBannerTitle(bannerTitle: string): { colName: string; value: string } {
  const cleaned = bannerTitle.replace(/\s+/g, " ").trim();
  const match = /^([A-Za-z][A-Za-z0-9 _-]{1,20}?)\s*[:\-–]?\s+([A-Za-z0-9._-]+)$/.exec(cleaned);
  if (match) {
    return {
      colName: normalizeIdentifier(match[1], "group"),
      value: match[2].trim(),
    };
  }
  return { colName: "sheet_title", value: cleaned };
}

function detectHeaderRowIndex(
  matrix: unknown[][],
  width: number,
): { headerIndex: number; bannerTitle: string | null } {
  if (width < 3 || matrix.length < 2) {
    return { headerIndex: 0, bannerTitle: null };
  }
  const firstRow = Array.isArray(matrix[0]) ? matrix[0] : [];
  const firstCounts = countNonEmptyCells(firstRow);
  if (firstCounts.total > 2) {
    return { headerIndex: 0, bannerTitle: null };
  }

  const minHeaderCells = Math.max(3, Math.ceil(width * 0.5));
  const limit = Math.min(5, matrix.length);
  for (let r = 1; r < limit; r += 1) {
    const row = Array.isArray(matrix[r]) ? matrix[r] : [];
    const counts = countNonEmptyCells(row);
    if (counts.total >= minHeaderCells && counts.strings >= Math.ceil(counts.total * 0.6)) {
      let banner: string | null = null;
      for (let b = 0; b < r; b += 1) {
        const bRow = Array.isArray(matrix[b]) ? matrix[b] : [];
        for (const cell of bRow) {
          if (cell !== null && cell !== undefined && String(cell).trim().length > 0) {
            banner = String(cell).trim();
            break;
          }
        }
        if (banner) break;
      }
      return { headerIndex: r, bannerTitle: banner };
    }
  }

  return { headerIndex: 0, bannerTitle: null };
}

function sheetToCsv(sheet: XLSX.WorkSheet): string | null {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  if (!Array.isArray(matrix) || matrix.length === 0) return null;

  const firstRow = Array.isArray(matrix[0]) ? matrix[0] : [];
  const width = matrix.reduce(
    (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
    firstRow.length,
  );
  if (width === 0) return null;

  const { headerIndex, bannerTitle } = detectHeaderRowIndex(matrix, width);
  const headerRow = Array.isArray(matrix[headerIndex]) ? matrix[headerIndex] : [];
  const dataRows = matrix.slice(headerIndex + 1);

  const columns = buildColumnNames(headerRow, width);
  let bannerCol: { colName: string; value: string } | null = null;
  if (bannerTitle) {
    const parsed = parseBannerTitle(bannerTitle);
    if (!columns.includes(parsed.colName)) {
      bannerCol = parsed;
    }
  }

  const finalColumns = bannerCol ? [bannerCol.colName, ...columns] : columns;
  const lines: string[] = [finalColumns.map((name) => csvCell(name)).join(",")];

  for (const row of dataRows) {
    if (!Array.isArray(row)) continue;
    const cells: string[] = bannerCol ? [csvCell(bannerCol.value)] : [];
    for (let index = 0; index < width; index += 1) {
      cells.push(csvCell(row[index]));
    }
    lines.push(cells.join(","));
  }

  return lines.join("\n");
}

/** Reads sheet names and approximate dimensions without converting them. */
export function inspectWorkbook(data: ArrayBuffer): SheetInfo[] {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const reference = sheet?.["!ref"];
    if (!reference) return { name, rowCount: 0, columnCount: 0 };
    const range = XLSX.utils.decode_range(reference);
    return {
      name,
      rowCount: Math.max(0, range.e.r - range.s.r + 1),
      columnCount: Math.max(0, range.e.c - range.s.c + 1),
    };
  });
}

/** Converts the selected worksheets to CSV. Runs inside a Web Worker. */
export function convertWorkbookToSheets(
  data: ArrayBuffer,
  selectedSheets?: string[],
): ConvertedSheet[] {
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const names = selectedSheets
    ? workbook.SheetNames.filter((name) => selectedSheets.includes(name))
    : workbook.SheetNames;
  const sheets: ConvertedSheet[] = [];

  for (const name of names) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const csv = sheetToCsv(sheet);
    if (!csv) continue;
    sheets.push({ name, csv });
  }

  return sheets;
}
