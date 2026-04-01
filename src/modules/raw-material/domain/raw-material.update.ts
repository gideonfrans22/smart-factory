import type { RawMaterialRepo } from "../ports/RawMaterialRepo";
import { RawMaterialDomainError } from "./errors";

export async function updateRawMaterial(
  deps: { rawMaterialRepo: RawMaterialRepo },
  input: {
    id: string;
    patch: {
      materialCode?: string;
      name?: string;
      materialType?: string;
      dimensions?: {
        length?: number;
        width?: number;
        height?: number;
        unit?: string;
      };
      weight?: { value?: number; unit?: string };
      color?: string;
      description?: string;
      supplier?: string;
      unit?: string;
      currentStock?: number;
    };
    modifiedBy?: string;
  }
): Promise<unknown | null> {
  const existing = await deps.rawMaterialRepo.loadForUpdate(input.id);
  if (!existing) {
    return null;
  }

  if (
    input.patch.name &&
    input.patch.name.trim().toUpperCase() !== existing.name
  ) {
    const dup = await deps.rawMaterialRepo.findByNormalizedNameExcludingId(
      input.patch.name,
      input.id
    );
    if (dup) {
      throw new RawMaterialDomainError({
        statusCode: 409,
        errorCode: "DUPLICATE_NAME",
        message: "Material code already exists"
      });
    }
  }

  return await deps.rawMaterialRepo.persistUpdate({
    id: input.id,
    ...input.patch,
    modifiedBy: input.modifiedBy
  });
}

