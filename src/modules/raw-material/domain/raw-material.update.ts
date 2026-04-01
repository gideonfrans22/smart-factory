import type { RawMaterialRepo } from "../ports/RawMaterialRepo";

export async function updateRawMaterial(
  deps: { rawMaterialRepo: RawMaterialRepo },
  input: {
    id: string;
    patch: {
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

  return await deps.rawMaterialRepo.persistUpdate({
    id: input.id,
    ...input.patch,
    modifiedBy: input.modifiedBy
  });
}

