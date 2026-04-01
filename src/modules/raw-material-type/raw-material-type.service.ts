import mongoose from "mongoose";
import { mongoRawMaterialTypeRepository } from "./adapters/mongo/raw-material-type.repository";
import { RawMaterialTypeDomainError } from "./domain/errors";
import { createRawMaterialType } from "./domain/raw-material-type.create";
import { softDeleteRawMaterialType } from "./domain/raw-material-type.soft-delete";
import { updateRawMaterialType } from "./domain/raw-material-type.update";
import type { RawMaterialTypeRecord } from "./ports/RawMaterialTypeRepo";
import { RawMaterialTypeServiceError } from "./raw-material-type.service-error";
import type {
  RawMaterialTypeCreateDTO,
  RawMaterialTypeListQuery,
  RawMaterialTypeUpdateDTO
} from "./raw-material-type.types";

export { RawMaterialTypeServiceError } from "./raw-material-type.service-error";

function mapDomainError(error: RawMaterialTypeDomainError): RawMaterialTypeServiceError {
  return new RawMaterialTypeServiceError({
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    message: error.message,
    data: error.data
  });
}

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

export class RawMaterialTypeService {
  constructor(
    private readonly repo = mongoRawMaterialTypeRepository
  ) {}

  async list(query: RawMaterialTypeListQuery): Promise<{
    items: RawMaterialTypeRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { items, total } = await this.repo.listActive({
      page,
      limit,
      search: query.search
    });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  async getById(id: string): Promise<RawMaterialTypeRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return this.repo.findActiveById(id);
  }

  async create(
    data: RawMaterialTypeCreateDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<RawMaterialTypeRecord> {
    try {
      return await createRawMaterialType(
        { repo: this.repo },
        {
          code: data.code,
          name: data.name,
          createdBy: userId?.toString()
        }
      );
    } catch (e) {
      if (e instanceof RawMaterialTypeDomainError) {
        throw mapDomainError(e);
      }
      if (isMongoDuplicateKey(e)) {
        throw new RawMaterialTypeServiceError({
          statusCode: 409,
          errorCode: "DUPLICATE_CODE_NAME",
          message:
            "A raw material type with this code and name combination already exists"
        });
      }
      throw e;
    }
  }

  async update(
    id: string,
    data: RawMaterialTypeUpdateDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<RawMaterialTypeRecord> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new RawMaterialTypeServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "Invalid raw material type ID"
      });
    }
    try {
      return await updateRawMaterialType(
        { repo: this.repo },
        {
          id,
          code: data.code,
          name: data.name,
          updatedBy: userId?.toString()
        }
      );
    } catch (e) {
      if (e instanceof RawMaterialTypeDomainError) {
        throw mapDomainError(e);
      }
      if (isMongoDuplicateKey(e)) {
        throw new RawMaterialTypeServiceError({
          statusCode: 409,
          errorCode: "DUPLICATE_CODE_NAME",
          message:
            "A raw material type with this code and name combination already exists"
        });
      }
      throw e;
    }
  }

  async softDelete(
    id: string,
    userId?: mongoose.Types.ObjectId
  ): Promise<RawMaterialTypeRecord> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new RawMaterialTypeServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "Invalid raw material type ID"
      });
    }
    try {
      return await softDeleteRawMaterialType(
        { repo: this.repo },
        { id, deletedBy: userId?.toString() }
      );
    } catch (e) {
      if (e instanceof RawMaterialTypeDomainError) {
        throw mapDomainError(e);
      }
      throw e;
    }
  }
}

export const rawMaterialTypeService = new RawMaterialTypeService();
