import mongoose from "mongoose";
import { RawMaterial, RawMaterialDocument } from "./raw-material.model";
import {
  RawMaterialDTO,
  RawMaterialListFilters,
  RawMaterialUpdateDTO
} from "./raw-material.types";
import { ParsedRawMaterialData } from "./raw-material.import.service";
import { ActivityLog } from "@shared/models/ActivityLog";
import { mongoRawMaterialRepository } from "./adapters/mongo/raw-material.repository";
import { mongoRawMaterialReadRepository } from "./adapters/mongo/raw-material.read.repository";
import { RawMaterialDomainError } from "./domain/errors";
import { createRawMaterial } from "./domain/raw-material.create";
import { updateRawMaterial } from "./domain/raw-material.update";
import { removeRawMaterial } from "./domain/raw-material.remove";
import { verifyParsedRawMaterialImport } from "./domain/raw-material.import.verify";
import { applyRawMaterialImport } from "./domain/raw-material.import.apply";

export interface RawMaterialListResult {
  items: RawMaterialDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class RawMaterialService {
  async verifyParsedImport(parsed: ParsedRawMaterialData) {
    return await verifyParsedRawMaterialImport(
      { rawMaterialRepo: mongoRawMaterialRepository },
      parsed
    );
  }

  async list(
    filters: RawMaterialListFilters = {}
  ): Promise<RawMaterialListResult> {
    return (await mongoRawMaterialReadRepository.list(
      filters
    )) as unknown as RawMaterialListResult;
  }

  async getById(id: string): Promise<RawMaterialDocument | null> {
    return (await mongoRawMaterialReadRepository.getById(
      id
    )) as RawMaterialDocument | null;
  }

  async create(
    data: RawMaterialDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<RawMaterialDocument> {
    try {
      return (await createRawMaterial(
        { rawMaterialRepo: mongoRawMaterialRepository },
        {
          ...data,
          modifiedBy: userId ? String(userId) : undefined
        }
      )) as RawMaterialDocument;
    } catch (err) {
      if (err instanceof RawMaterialDomainError) {
        const e: any = new Error(err.message);
        e.code = err.errorCode;
        throw e;
      }
      throw err;
    }
  }

  async update(
    id: string,
    data: RawMaterialUpdateDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<RawMaterialDocument | null> {
    try {
      return (await updateRawMaterial(
        { rawMaterialRepo: mongoRawMaterialRepository },
        {
          id,
          patch: data,
          modifiedBy: userId ? String(userId) : undefined
        }
      )) as RawMaterialDocument | null;
    } catch (err) {
      if (err instanceof RawMaterialDomainError) {
        const e: any = new Error(err.message);
        e.code = err.errorCode;
        throw e;
      }
      throw err;
    }
  }

  async remove(id: string): Promise<RawMaterialDocument | null> {
    return (await removeRawMaterial(
      { rawMaterialRepo: mongoRawMaterialRepository },
      id
    )) as RawMaterialDocument | null;
  }

  async importFromParsedData(
    parsed: ParsedRawMaterialData,
    userId?: mongoose.Types.ObjectId,
    fileName?: string
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: typeof parsed.errors;
  }> {
    const importResult = await applyRawMaterialImport(
      { rawMaterialRepo: mongoRawMaterialRepository },
      {
        parsed,
        modifiedBy: userId ? String(userId) : undefined
      }
    );

    try {
      await ActivityLog.create({
        userId,
        action: "BULK_IMPORT",
        resourceType: "RawMaterial",
        resourceId: null,
        details: {
          created: importResult.created,
          updated: importResult.updated,
          skipped: importResult.skipped,
          fileName
        },
        success: true,
        modifiedBy: userId
      });
    } catch (logError) {
      // ignore logging errors
      // eslint-disable-next-line no-console
      console.error("ActivityLog error (RawMaterial import):", logError);
    }

    return {
      created: importResult.created,
      updated: importResult.updated,
      skipped: importResult.skipped,
      errors: importResult.errors
    };
  }
}
export const rawMaterialService = new RawMaterialService();
