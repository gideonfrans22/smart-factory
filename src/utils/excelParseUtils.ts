import type ExcelJS from "exceljs";

export function parseHeaderRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number
): Map<string, number> {
  const headerRow = worksheet.getRow(rowNumber);
  const map = new Map<string, number>();

  headerRow.eachCell((cell, colNumber) => {
    const raw = cell.value;
    if (raw == null) return;
    const header = String(
      typeof raw === "object" && "text" in (raw as any)
        ? (raw as any).text
        : raw
    ).trim();
    if (header) {
      map.set(header, colNumber);
    }
  });

  return map;
}

export function readSheetRows<T extends Record<string, any>>(
  worksheet: ExcelJS.Worksheet,
  headerMap: Map<string, number>,
  startRow: number
): Array<{ rowNumber: number; data: Partial<T> }> {
  const results: Array<{ rowNumber: number; data: Partial<T> }> = [];

  for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const data: Partial<T> = {};
    let hasAnyValue = false;

    headerMap.forEach((colIndex, headerName) => {
      const cell = row.getCell(colIndex);
      const value = cell.value;
      if (
        value !== null &&
        value !== undefined &&
        !(typeof value === "string" && value.trim() === "")
      ) {
        (data as any)[headerName] = value;
        hasAnyValue = true;
      }
    });

    if (hasAnyValue) {
      results.push({ rowNumber, data });
    }
  }

  return results;
}

export function cellToString(cell: ExcelJS.Cell): string | null {
  const raw = cell.value;
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "object" && "text" in (raw as any)) {
    const text = String((raw as any).text).trim();
    return text === "" ? null : text;
  }

  const str = String(raw).trim();
  return str === "" ? null : str;
}

export function cellToNumber(cell: ExcelJS.Cell): number | null {
  const raw = cell.value;
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") {
    return Number.isNaN(raw) ? null : raw;
  }

  if (typeof raw === "object" && "result" in (raw as any)) {
    const result = (raw as any).result;
    if (typeof result === "number") {
      return Number.isNaN(result) ? null : result;
    }
    if (typeof result === "string") {
      const parsed = Number(result.trim());
      return Number.isNaN(parsed) ? null : parsed;
    }
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

