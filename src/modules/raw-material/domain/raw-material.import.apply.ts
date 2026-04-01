import type { ParsedRawMaterialData } from "../raw-material.import.service";
import type { RawMaterialRepo } from "../ports/RawMaterialRepo";
import type { RawMaterialTypeRepo } from "../../raw-material-type/ports/RawMaterialTypeRepo";

export async function applyRawMaterialImport(
  deps: { rawMaterialRepo: RawMaterialRepo; rawMaterialTypeRepo: RawMaterialTypeRepo },
  input: {
    parsed: ParsedRawMaterialData;
    modifiedBy?: string;
  }
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: ParsedRawMaterialData["errors"];
}> {
  let created = 0;
  let updated = 0;
  const skipped = 0;

  for (const material of input.parsed.materials) {
    const type = await deps.rawMaterialTypeRepo.findOrCreateActiveByCodeAndName({
      code: material.materialTypeCode,
      name: material.materialTypeName,
      createdBy: input.modifiedBy
    });

    const result = await deps.rawMaterialRepo.upsertForImport(
      {
        materialType: type.id,
        dimensions: material.dimensions,
        weight: material.weight,
        color: material.color,
        description: material.description,
        supplier: material.supplier,
        unit: material.unit,
        currentStock: material.currentStock
      },
      input.modifiedBy
    );
    if (result.created) {
      created++;
    } else {
      updated++;
    }
  }

  return {
    created,
    updated,
    skipped,
    errors: input.parsed.errors
  };
}

