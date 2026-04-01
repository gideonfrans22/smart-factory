import type {
  RawMaterialTypeRecord,
  RawMaterialTypeRepo
} from "../ports/RawMaterialTypeRepo";
import { RawMaterialTypeDomainError } from "./errors";

export interface UpdateRawMaterialTypeDeps {
  repo: RawMaterialTypeRepo;
}

export interface UpdateRawMaterialTypeInput {
  id: string;
  code?: string;
  name?: string;
  updatedBy?: string;
}

export async function updateRawMaterialType(
  deps: UpdateRawMaterialTypeDeps,
  input: UpdateRawMaterialTypeInput
): Promise<RawMaterialTypeRecord> {
  const current = await deps.repo.findActiveById(input.id);
  if (!current) {
    throw new RawMaterialTypeDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Raw material type not found"
    });
  }

  const nextCode =
    input.code !== undefined ? input.code.trim() : current.code;
  const nextName =
    input.name !== undefined ? input.name.trim() : current.name;

  if (nextCode !== current.code || nextName !== current.name) {
    const other = await deps.repo.findActiveByCodeAndName(nextCode, nextName);
    if (other && other.id !== current.id) {
      throw new RawMaterialTypeDomainError({
        statusCode: 409,
        errorCode: "DUPLICATE_CODE_NAME",
        message:
          "A raw material type with this code and name combination already exists"
      });
    }
  }

  const updated = await deps.repo.updateActive(input.id, {
    code: input.code,
    name: input.name,
    updatedBy: input.updatedBy
  });

  if (!updated) {
    throw new RawMaterialTypeDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Raw material type not found"
    });
  }

  return updated;
}
