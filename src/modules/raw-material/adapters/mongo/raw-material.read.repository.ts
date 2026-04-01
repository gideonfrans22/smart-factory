import { RawMaterial } from "../../raw-material.model";
import type { RawMaterialReadPort } from "../../ports/RawMaterialReadPort";

export const mongoRawMaterialReadRepository: RawMaterialReadPort = {
  async list(filters) {
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
      .populate("materialType", "code name")
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
  },

  async getById(id: string) {
    return RawMaterial.findById(id).populate("materialType", "code name").exec();
  }
};

