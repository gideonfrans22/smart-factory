import { RawMaterial } from "../../raw-material.model";
import type { RawMaterialRepo } from "../../ports/RawMaterialRepo";

function normalizeName(name: string): string {
  return name.trim().toUpperCase();
}

export const mongoRawMaterialRepository: RawMaterialRepo = {
  async loadForUpdate(id: string) {
    const doc = await RawMaterial.findById(id, { _id: 1 }).lean();
    if (!doc?._id) {
      return null;
    }
    return { id: String(doc._id) };
  },

  async listExistingNames(names: string[]) {
    const docs = await RawMaterial.find(
      { name: { $in: names } },
      { name: 1 }
    ).lean();
    return docs.map((d: any) => String(d.name));
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
    const existing = await RawMaterial.findOne({ name: normalizeName(material.name) });
    if (existing) {
      (existing as any).materialCode = material.materialCode;
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
      materialCode: material.materialCode,
      name: normalizeName(material.name),
      description: material.description,
      supplier: material.supplier,
      unit: material.unit,
      currentStock: material.currentStock !== undefined ? material.currentStock : 0,
      modifiedBy
    });
    return { created: true };
  },

  async loadForImportByNames(names: string[]) {
    const normalizedNames = names.map(normalizeName);
    const docs = await RawMaterial.find({ name: { $in: normalizedNames } });
    return docs.map((d: any) => ({
      id: String(d._id),
      name: String(d.name),
      specifications: d.specifications ?? []
    }));
  },

  async persistSpecificationsForImport(input) {
    await RawMaterial.updateOne(
      { _id: input.id },
      {
        $set: {
          specifications: input.specifications,
          ...(input.modifiedBy ? { modifiedBy: input.modifiedBy } : {})
        }
      }
    );
  }
};

