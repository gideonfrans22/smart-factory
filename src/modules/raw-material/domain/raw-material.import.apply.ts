import type { ParsedRawMaterialData } from "../raw-material.import.service";
import type { RawMaterialRepo } from "../ports/RawMaterialRepo";

export async function applyRawMaterialImport(
  deps: { rawMaterialRepo: RawMaterialRepo },
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
  let skipped = 0;

  for (const material of input.parsed.materials) {
    const result = await deps.rawMaterialRepo.upsertForImport(
      {
        materialCode: material.materialCode,
        name: material.name,
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

  const specMaterialNames = Array.from(
    new Set(input.parsed.specifications.map((s) => s.materialName))
  );
  const materialDocs = await deps.rawMaterialRepo.loadForImportByNames(
    specMaterialNames
  );
  const materialMap = new Map<string, (typeof materialDocs)[number]>();
  materialDocs.forEach((doc) => materialMap.set(doc.name, doc));

  for (const spec of input.parsed.specifications) {
    const materialDoc = materialMap.get(spec.materialName);
    if (!materialDoc) {
      continue;
    }

    const specsArray = Array.isArray(materialDoc.specifications)
      ? [...materialDoc.specifications]
      : [];

    const isDuplicate = specsArray.some((existingSpec: any) => {
      const dims = existingSpec?.dimensions || {};
      const weight = existingSpec?.weight || {};

      const sameColor = (existingSpec?.color || "") === (spec.color || "");
      const sameLength =
        (dims.length ?? undefined) === (spec.dimensions?.length ?? undefined);
      const sameWidth =
        (dims.width ?? undefined) === (spec.dimensions?.width ?? undefined);
      const sameHeight =
        (dims.height ?? undefined) === (spec.dimensions?.height ?? undefined);
      const sameDimUnit =
        (dims.unit || undefined) === (spec.dimensions?.unit || undefined);
      const sameWeightValue =
        (weight.value ?? undefined) === (spec.weight?.value ?? undefined);
      const sameWeightUnit =
        (weight.unit || undefined) === (spec.weight?.unit || undefined);
      const sameSupplier =
        (existingSpec?.supplier || undefined) === (spec.specSupplier || undefined);

      return (
        sameColor &&
        sameLength &&
        sameWidth &&
        sameHeight &&
        sameDimUnit &&
        sameWeightValue &&
        sameWeightUnit &&
        sameSupplier
      );
    });

    if (isDuplicate) {
      skipped++;
      continue;
    }

    specsArray.push({
      color: spec.color,
      dimensions: spec.dimensions,
      weight: spec.weight,
      supplier: spec.specSupplier
    });

    materialDoc.specifications = specsArray;
  }

  for (const doc of materialDocs) {
    await deps.rawMaterialRepo.persistSpecificationsForImport({
      id: doc.id,
      specifications: doc.specifications ?? [],
      modifiedBy: input.modifiedBy
    });
  }

  return {
    created,
    updated,
    skipped,
    errors: input.parsed.errors
  };
}

