import type { RawMaterialRepo } from "../ports/RawMaterialRepo";

export async function removeRawMaterial(
  deps: { rawMaterialRepo: RawMaterialRepo },
  id: string
): Promise<unknown | null> {
  return await deps.rawMaterialRepo.deleteById(id);
}

