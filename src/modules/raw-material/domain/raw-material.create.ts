import type { RawMaterialRepo } from "../ports/RawMaterialRepo";

export async function createRawMaterial(
  deps: {
    rawMaterialRepo: RawMaterialRepo;
  },
  input: {
    materialType: string;
    dimensions: {
      length: number;
      width: number;
      height: number;
      unit?: string;
    };
    weight?: { value?: number; unit?: string };
    color?: string;
    description?: string;
    supplier?: string;
    unit?: string;
    currentStock?: number;
    modifiedBy?: string;
  }
): Promise<unknown> {
  return await deps.rawMaterialRepo.create(input);
}

