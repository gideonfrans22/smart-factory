import { RawMaterial } from "../../raw-material.model";
import type { RawMaterialRepo } from "../../ports/RawMaterialRepo";

export const mongoRawMaterialRepository: RawMaterialRepo = {
  async loadForUpdate(id: string) {
    const doc = await RawMaterial.findById(id, { _id: 1 }).lean();
    if (!doc?._id) {
      return null;
    }
    return { id: String(doc._id) };
  },

  async create(input) {
    const doc = new RawMaterial({
      materialType: input.materialType,
      dimensions: input.dimensions,
      weight: input.weight,
      color: input.color,
      description: input.description,
      supplier: input.supplier,
      unit: input.unit,
      currentStock: input.currentStock ?? 0,
      modifiedBy: input.modifiedBy
    });
    return await doc.save();
  },

  async persistUpdate(input) {
    const doc = await RawMaterial.findById(input.id);
    if (!doc) {
      return null;
    }

    if (input.materialType !== undefined) {
      (doc as any).materialType = input.materialType;
    }
    if (input.dimensions !== undefined) {
      (doc as any).dimensions = input.dimensions;
    }
    if (input.weight !== undefined) {
      (doc as any).weight = input.weight;
    }
    if (input.color !== undefined) {
      (doc as any).color = input.color;
    }
    if (input.description !== undefined) {
      (doc as any).description = input.description;
    }
    if (input.supplier !== undefined) {
      (doc as any).supplier = input.supplier;
    }
    if (input.unit !== undefined) {
      (doc as any).unit = input.unit;
    }
    if (input.currentStock !== undefined) {
      (doc as any).currentStock = input.currentStock;
    }
    if (input.modifiedBy) {
      (doc as any).modifiedBy = input.modifiedBy;
    }

    await doc.save();
    return RawMaterial.findById(input.id)
      .populate("modifiedBy")
      .populate("materialType", "code name");
  },

  async deleteById(id: string) {
    return RawMaterial.findByIdAndDelete(id).exec();
  },

  async upsertForImport(material, modifiedBy) {
    const existing = await RawMaterial.findOne({
      materialType: material.materialType,
      "dimensions.length": material.dimensions.length,
      "dimensions.width": material.dimensions.width,
      "dimensions.height": material.dimensions.height
    });
    if (existing) {
      (existing as any).materialType = material.materialType;
      (existing as any).dimensions = material.dimensions;
      if (material.weight !== undefined) {
        (existing as any).weight = material.weight;
      }
      if (material.color !== undefined) {
        (existing as any).color = material.color;
      }
      if (material.description !== undefined) {
        (existing as any).description = material.description;
      }
      if (material.supplier !== undefined) {
        (existing as any).supplier = material.supplier;
      }
      if (material.unit !== undefined) {
        (existing as any).unit = material.unit;
      }
      if (material.currentStock !== undefined) {
        (existing as any).currentStock = material.currentStock;
      }
      if (modifiedBy) {
        (existing as any).modifiedBy = modifiedBy;
      }
      await existing.save();
      return { created: false };
    }

    await RawMaterial.create({
      materialType: material.materialType,
      dimensions: material.dimensions,
      weight: material.weight,
      color: material.color,
      description: material.description,
      supplier: material.supplier,
      unit: material.unit,
      currentStock: material.currentStock !== undefined ? material.currentStock : 0,
      modifiedBy
    });
    return { created: true };
  }
};

