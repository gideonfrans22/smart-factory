import mongoose from "mongoose";
import { RawMaterial, RawMaterialDocument } from "./raw-material.model";
import {
  RawMaterialDTO,
  RawMaterialListFilters,
  RawMaterialUpdateDTO
} from "./raw-material.types";
import { ParsedRawMaterialData } from "./raw-material.import.service";
import { ActivityLog } from "../../models/ActivityLog";

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
  async list(filters: RawMaterialListFilters = {}): Promise<RawMaterialListResult> {
    const { supplier, search, page = 1, limit = 10 } = filters;

    const query: any = {};
    if (supplier) {
      query.supplier = { $regex: supplier, $options: "i" };
    }
    if (search) {
      query.$or = [
        { materialCode: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } }
      ];
    }

    const pageNum = page;
    const limitNum = limit;
    const skip = (pageNum - 1) * limitNum;

    const total = await RawMaterial.countDocuments(query);
    const items = await RawMaterial.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ materialCode: 1 });

    return {
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    };
  }

  async getById(id: string): Promise<RawMaterialDocument | null> {
    return RawMaterial.findById(id).exec();
  }

  async create(
    data: RawMaterialDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<RawMaterialDocument> {
    const existing = await RawMaterial.findOne({
      name: data.name.toUpperCase()
    });
    if (existing) {
      const error: any = new Error("Material name already exists");
      error.code = "DUPLICATE_NAME";
      throw error;
    }

    const doc = new RawMaterial({
      ...data,
      name: data.name.toUpperCase(),
      modifiedBy: userId
    });
    return doc.save();
  }

  async update(
    id: string,
    data: RawMaterialUpdateDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<RawMaterialDocument | null> {
    const rawMaterial = await RawMaterial.findById(id);
    if (!rawMaterial) {
      return null;
    }

    if (data.name && data.name.toUpperCase() !== rawMaterial.name) {
      const existing = await RawMaterial.findOne({
        name: data.name,
        _id: { $ne: id }
      });
      if (existing) {
        const error: any = new Error("Material code already exists");
        error.code = "DUPLICATE_NAME";
        throw error;
      }
      rawMaterial.name = data.name.toUpperCase();
    }

    if (data.materialCode !== undefined) {
      rawMaterial.materialCode = data.materialCode;
    }
    if (data.description !== undefined) {
      rawMaterial.description = data.description;
    }
    if (data.supplier !== undefined) {
      rawMaterial.supplier = data.supplier;
    }
    if (data.unit !== undefined) {
      rawMaterial.unit = data.unit;
    }
    if (data.currentStock !== undefined) {
      rawMaterial.currentStock = data.currentStock;
    }
    if (userId) {
      rawMaterial.modifiedBy = userId;
    }

    await rawMaterial.save();
    return RawMaterial.findById(id).populate("modifiedBy");
  }

  async remove(id: string): Promise<RawMaterialDocument | null> {
    return RawMaterial.findByIdAndDelete(id).exec();
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
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const material of parsed.materials) {
      const existing = await RawMaterial.findOne({ name: material.name });
      if (existing) {
        existing.materialCode = material.materialCode;
        if (material.description !== undefined) {
          existing.description = material.description;
        }
        if (material.supplier !== undefined) {
          existing.supplier = material.supplier;
        }
        if (material.unit !== undefined) {
          existing.unit = material.unit;
        }
        if (material.currentStock !== undefined) {
          existing.currentStock = material.currentStock;
        }
        if (userId) {
          existing.modifiedBy = userId;
        }
        await existing.save();
        updated++;
      } else {
        await RawMaterial.create({
          materialCode: material.materialCode,
          name: material.name,
          description: material.description,
          supplier: material.supplier,
          unit: material.unit,
          currentStock:
            material.currentStock !== undefined ? material.currentStock : 0,
          modifiedBy: userId
        });
        created++;
      }
    }

    const materialDocs = await RawMaterial.find({
      name: { $in: parsed.specifications.map((s) => s.materialName) }
    });
    const materialMap = new Map<string, RawMaterialDocument>();
    materialDocs.forEach((doc) => {
      materialMap.set(doc.name, doc);
    });

    for (const spec of parsed.specifications) {
      const materialDoc = materialMap.get(spec.materialName);
      if (!materialDoc) {
        continue;
      }

      const specsArray = materialDoc.specifications || [];

      const isDuplicate = specsArray.some((existingSpec) => {
        const dims = existingSpec.dimensions || {};
        const weight = existingSpec.weight || {};

        const sameColor = (existingSpec.color || "") === (spec.color || "");
        const sameLength =
          (dims.length ?? undefined) === (spec.dimensions?.length ?? undefined);
        const sameWidth =
          (dims.width ?? undefined) === (spec.dimensions?.width ?? undefined);
        const sameHeight =
          (dims.height ?? undefined) === (spec.dimensions?.height ?? undefined);
        const sameDimUnit =
          (dims.unit || undefined) === (spec.dimensions?.unit || undefined);
        const sameWeightValue =
          (weight.value ?? undefined) === (spec.weight?.value ?? undefined);
        const sameWeightUnit =
          (weight.unit || undefined) === (spec.weight?.unit || undefined);
        const sameSupplier =
          (existingSpec.supplier || undefined) ===
          (spec.specSupplier || undefined);

        return (
          sameColor &&
          sameLength &&
          sameWidth &&
          sameHeight &&
          sameDimUnit &&
          sameWeightValue &&
          sameWeightUnit &&
          sameSupplier
        );
      });

      if (isDuplicate) {
        skipped++;
        continue;
      }

      specsArray.push({
        color: spec.color,
        dimensions: spec.dimensions,
        weight: spec.weight,
        supplier: spec.specSupplier
      });

      materialDoc.specifications = specsArray;

      if (userId) {
        materialDoc.modifiedBy = userId;
      }

      await materialDoc.save();
    }

    try {
      await ActivityLog.create({
        userId,
        action: "BULK_IMPORT",
        resourceType: "RawMaterial",
        resourceId: null,
        details: {
          created,
          updated,
          skipped,
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
      created,
      updated,
      skipped,
      errors: parsed.errors
    };
  }
}
export const rawMaterialService = new RawMaterialService();
