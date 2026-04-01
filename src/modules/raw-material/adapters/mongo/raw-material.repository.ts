import { RawMaterial } from "../../raw-material.model";
import type { RawMaterialRepo, RawMaterialPersisted } from "../../ports/RawMaterialRepo";

function normalizeName(name: string): string {
  return name.trim().toUpperCase();
}

export const mongoRawMaterialRepository: RawMaterialRepo = {
  async findByNormalizedName(name: string): Promise<RawMaterialPersisted | null> {
    const normalized = normalizeName(name);
    const doc = await RawMaterial.findOne({ name: normalized }, { _id: 1 }).lean();
    if (!doc?._id) {
      return null;
    }
    return { id: String(doc._id) };
  },

  async findByNormalizedNameExcludingId(
    name: string,
    excludeId: string
  ): Promise<RawMaterialPersisted | null> {
    const normalized = normalizeName(name);
    const doc = await RawMaterial.findOne(
      { name: normalized, _id: { $ne: excludeId } },
      { _id: 1 }
    ).lean();
    if (!doc?._id) {
      return null;
    }
    return { id: String(doc._id) };
  },

  async loadForUpdate(id: string) {
    const doc = await RawMaterial.findById(id, { name: 1 }).lean();
    if (!doc?._id) {
      return null;
    }
    return { id: String(doc._id), name: String((doc as any).name) };
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
      materialCode: input.materialCode,
      name: normalizeName(input.name),
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

    if (input.materialCode !== undefined) {
      (doc as any).materialCode = input.materialCode;
    }
    if (input.name !== undefined) {
      (doc as any).name = normalizeName(input.name);
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
    return RawMaterial.findById(input.id).populate("modifiedBy");
  },

  async deleteById(id: string) {
    return RawMaterial.findByIdAndDelete(id).exec();
  },

  async upsertForImport(material, modifiedBy) {
    const existing = await RawMaterial.findOne({ name: material.name });
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
      name: material.name,
      description: material.description,
      supplier: material.supplier,
      unit: material.unit,
      currentStock: material.currentStock !== undefined ? material.currentStock : 0,
      modifiedBy
    });
    return { created: true };
  },

  async loadForImportByNames(names: string[]) {
    const docs = await RawMaterial.find({ name: { $in: names } });
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

