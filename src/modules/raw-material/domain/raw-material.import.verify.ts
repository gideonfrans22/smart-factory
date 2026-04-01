import type { ImportRowError } from "@shared/types";
import type { ParsedRawMaterialData } from "../raw-material.import.service";

export async function verifyParsedRawMaterialImport(
  _deps: Record<string, never>,
  parsed: ParsedRawMaterialData
): Promise<ParsedRawMaterialData> {
  const errors: ImportRowError[] = [...parsed.errors];

  for (const material of parsed.materials) {
    if (!material.materialTypeCode?.trim()) {
      errors.push({
        sheet: "Raw Materials",
        row: material.rowNumber,
        column: "materialTypeCode",
        message: "materialTypeCode is required.",
        severity: "error"
      });
    }
    if (!material.materialTypeName?.trim()) {
      errors.push({
        sheet: "Raw Materials",
        row: material.rowNumber,
        column: "materialTypeName",
        message: "materialTypeName is required.",
        severity: "error"
      });
    }

    const { length, width, height } = material.dimensions ?? ({} as any);
    if (
      length === undefined ||
      width === undefined ||
      height === undefined ||
      Number.isNaN(length) ||
      Number.isNaN(width) ||
      Number.isNaN(height)
    ) {
      errors.push({
        sheet: "Raw Materials",
        row: material.rowNumber,
        column: "dimensions",
        message:
          "Dimensions are required (dim_length, dim_width, dim_height) for each raw material row.",
        severity: "error"
      });
    }
  }

  return { ...parsed, errors };
}

