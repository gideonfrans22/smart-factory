import type { RawMaterialRepo } from "../ports/RawMaterialRepo";
import { RawMaterialDomainError } from "./errors";

export async function createRawMaterial(
  deps: {
    rawMaterialRepo: RawMaterialRepo;
  },
  input: {
    materialCode: string;
    name: string;
    description?: string;
    supplier?: string;
    unit?: string;
    currentStock?: number;
    modifiedBy?: string;
  }
): Promise<unknown> {
  const normalizedName = input.name.trim().toUpperCase();
  const existing = await deps.rawMaterialRepo.findByNormalizedName(normalizedName);
  if (existing) {
    throw new RawMaterialDomainError({
      statusCode: 409,
      errorCode: "DUPLICATE_NAME",
      message: "Material name already exists",
      data: { name: normalizedName }
    });
  }

  return await deps.rawMaterialRepo.create({
    ...input,
    name: normalizedName
  });
}

