import type {
  RawMaterialTypeRecord,
  RawMaterialTypeRepo
} from "../ports/RawMaterialTypeRepo";
import { RawMaterialTypeDomainError } from "./errors";

export interface CreateRawMaterialTypeDeps {
  repo: RawMaterialTypeRepo;
}

export interface CreateRawMaterialTypeInput {
  code: string;
  name: string;
  createdBy?: string;
}

export async function createRawMaterialType(
  deps: CreateRawMaterialTypeDeps,
  input: CreateRawMaterialTypeInput
): Promise<RawMaterialTypeRecord> {
  const code = input.code.trim();
  const name = input.name.trim();
  const existing = await deps.repo.findActiveByCodeAndName(code, name);
  if (existing) {
    throw new RawMaterialTypeDomainError({
      statusCode: 409,
      errorCode: "DUPLICATE_CODE_NAME",
      message:
        "A raw material type with this code and name combination already exists"
    });
  }
  return deps.repo.insert({
    code,
    name,
    createdBy: input.createdBy
  });
}
