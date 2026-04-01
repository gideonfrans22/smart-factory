import type { ImportRowError } from "@shared/types";
import type { RawMaterialRepo } from "../ports/RawMaterialRepo";
import type { ParsedRawMaterialData } from "../raw-material.import.service";

export async function verifyParsedRawMaterialImport(
  deps: { rawMaterialRepo: RawMaterialRepo },
  parsed: ParsedRawMaterialData
): Promise<ParsedRawMaterialData> {
  const errors: ImportRowError[] = [...parsed.errors];

  const namesInFile = new Set(parsed.materials.map((m) => m.name));
  const specNames = Array.from(
    new Set(parsed.specifications.map((s) => s.materialName))
  );

  const missingFromFile = specNames.filter((n) => !namesInFile.has(n));
  if (missingFromFile.length === 0) {
    return { ...parsed, errors };
  }

  const existingInDb = new Set(
    await deps.rawMaterialRepo.listExistingNames(missingFromFile)
  );

  for (const spec of parsed.specifications) {
    if (namesInFile.has(spec.materialName)) {
      continue;
    }
    if (existingInDb.has(spec.materialName)) {
      continue;
    }
    errors.push({
      sheet: "Specifications",
      row: spec.rowNumber,
      column: "materialName",
      message: `materialName '${spec.materialName}' not found in file or database.`,
      severity: "error"
    });
  }

  return { ...parsed, errors };
}

