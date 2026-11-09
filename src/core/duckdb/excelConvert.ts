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

function sheetToCsv(sheet: XLSX.WorkSheet): string | null {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  if (!Array.isArray(matrix) || matrix.length === 0) return null;

  const headerRow = Array.isArray(matrix[0]) ? matrix[0] : [];
  const dataRows = Array.isArray(matrix) ? matrix.slice(1) : [];
  const width = dataRows.reduce(
    (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
    headerRow.length,
  );
  if (width === 0) return null;

  const columns = buildColumnNames(headerRow, width);
  const lines: string[] = [columns.map((name) => csvCell(name)).join(",")];

  for (const row of dataRows) {
    if (!Array.isArray(row)) continue;
    const cells: string[] = [];
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
