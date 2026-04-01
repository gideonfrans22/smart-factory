import mongoose from "mongoose";
import { RawMaterialType } from "../../raw-material-type.model";
import type {
  RawMaterialTypeInsertInput,
  RawMaterialTypeListParams,
  RawMaterialTypeListResult,
  RawMaterialTypeRecord,
  RawMaterialTypeRepo,
  RawMaterialTypeUpdateInput
} from "../../ports/RawMaterialTypeRepo";

const includeDeletedOption = { includeDeleted: true } as const;

function toRecord(doc: unknown): RawMaterialTypeRecord {
  const d = doc as Record<string, unknown>;
  return {
    id: String(d._id),
    code: String(d.code),
    name: String(d.name),
    deletedAt: (d.deletedAt as Date | null | undefined) ?? null,
    createdBy: d.createdBy != null ? String(d.createdBy) : undefined,
    updatedBy: d.updatedBy != null ? String(d.updatedBy) : undefined,
    deletedBy: d.deletedBy != null ? String(d.deletedBy) : undefined,
    createdAt: d.createdAt as Date,
    updatedAt: d.updatedAt as Date
  };
}

export class MongoRawMaterialTypeRepository implements RawMaterialTypeRepo {
  async findActiveById(id: string): Promise<RawMaterialTypeRecord | null> {
    const doc = await RawMaterialType.findById(id).lean();
    if (!doc) {
      return null;
    }
    return toRecord(doc);
  }

  async findAnyById(id: string): Promise<RawMaterialTypeRecord | null> {
    const doc = await RawMaterialType.findById(id)
      .setOptions(includeDeletedOption)
      .lean();
    if (!doc) {
      return null;
    }
    return toRecord(doc);
  }

  async findActiveByCodeAndName(
    code: string,
    name: string
  ): Promise<RawMaterialTypeRecord | null> {
    const doc = await RawMaterialType.findOne({
      code: code.trim(),
      name: name.trim()
    }).lean();
    if (!doc) {
      return null;
    }
    return toRecord(doc);
  }

  async findOrCreateActiveByCodeAndName(input: {
    code: string;
    name: string;
    createdBy?: string;
  }): Promise<RawMaterialTypeRecord> {
    const code = input.code.trim();
    const name = input.name.trim();

    const existing = await this.findActiveByCodeAndName(code, name);
    if (existing) {
      return existing;
    }

    try {
      return await this.insert({
        code,
        name,
        createdBy: input.createdBy
      });
    } catch (err: any) {
      // If another request created it concurrently, read it back.
      if (err?.code === 11000) {
        const after = await this.findActiveByCodeAndName(code, name);
        if (after) {
          return after;
        }
      }
      throw err;
    }
  }

  async listActive(
    params: RawMaterialTypeListParams
  ): Promise<RawMaterialTypeListResult> {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};
    if (search?.trim()) {
      const q = search.trim();
      filter.$or = [
        { code: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
      ];
    }

    const [items, total] = await Promise.all([
      RawMaterialType.find(filter)
        .sort({ code: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      RawMaterialType.countDocuments(filter)
    ]);

    return {
      items: items.map((d) => toRecord(d)),
      total,
      page,
      limit
    };
  }

  async insert(input: RawMaterialTypeInsertInput): Promise<RawMaterialTypeRecord> {
    const doc = await RawMaterialType.create({
      code: input.code.trim(),
      name: input.name.trim(),
      ...(input.createdBy && {
        createdBy: new mongoose.Types.ObjectId(input.createdBy)
      })
    });
    const lean = await RawMaterialType.findById(doc._id)
      .setOptions(includeDeletedOption)
      .lean();
    return toRecord(lean);
  }

  async updateActive(
    id: string,
    input: RawMaterialTypeUpdateInput
  ): Promise<RawMaterialTypeRecord | null> {
    const $set: Record<string, unknown> = {};
    if (input.code !== undefined) {
      $set.code = input.code.trim();
    }
    if (input.name !== undefined) {
      $set.name = input.name.trim();
    }
    if (input.updatedBy !== undefined && input.updatedBy) {
      $set.updatedBy = new mongoose.Types.ObjectId(input.updatedBy);
    }
    if (Object.keys($set).length === 0) {
      return this.findActiveById(id);
    }

    const updated = await RawMaterialType.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set },
      { new: true }
    )
      .setOptions(includeDeletedOption)
      .lean();

    if (!updated) {
      return null;
    }
    return toRecord(updated);
  }

  async applySoftDelete(id: string, deletedBy?: string): Promise<void> {
    const $set: Record<string, unknown> = {
      deletedAt: new Date()
    };
    if (deletedBy) {
      $set.deletedBy = new mongoose.Types.ObjectId(deletedBy);
    }
    await RawMaterialType.updateOne({ _id: id, deletedAt: null }, { $set });
  }
}

export const mongoRawMaterialTypeRepository = new MongoRawMaterialTypeRepository();
