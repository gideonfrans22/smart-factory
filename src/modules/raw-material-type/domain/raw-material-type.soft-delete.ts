import type {
  RawMaterialTypeRecord,
  RawMaterialTypeRepo
} from "../ports/RawMaterialTypeRepo";
import { RawMaterialTypeDomainError } from "./errors";

export interface SoftDeleteRawMaterialTypeDeps {
  repo: RawMaterialTypeRepo;
}

export interface SoftDeleteRawMaterialTypeInput {
  id: string;
  deletedBy?: string;
}

export async function softDeleteRawMaterialType(
  deps: SoftDeleteRawMaterialTypeDeps,
  input: SoftDeleteRawMaterialTypeInput
): Promise<RawMaterialTypeRecord> {
  const row = await deps.repo.findAnyById(input.id);
  if (!row) {
    throw new RawMaterialTypeDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Raw material type not found"
    });
  }
  if (row.deletedAt) {
    return row;
  }

  await deps.repo.applySoftDelete(input.id, input.deletedBy);
  const after = await deps.repo.findAnyById(input.id);
  if (!after) {
    throw new RawMaterialTypeDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Raw material type not found"
    });
  }
  return after;
}
