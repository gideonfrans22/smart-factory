import { RawMaterial } from "../../raw-material.model";
import type { RawMaterialReadPort } from "../../ports/RawMaterialReadPort";

export const mongoRawMaterialReadRepository: RawMaterialReadPort = {
  async list(filters) {
    const { supplier, search, page = 1, limit = 10 } = filters;

    const pageNum = page;
    const limitNum = limit;
    const skip = (pageNum - 1) * limitNum;

    const pipeline: any[] = [];

    const orClauses: any[] = [];
    if (supplier) {
      orClauses.push({ supplier: { $regex: supplier, $options: "i" } });
    }
    if (search) {
      orClauses.push(
        { supplier: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      );
    }

    if (orClauses.length > 0) {
      pipeline.push({ $match: { $or: orClauses } });
    }

    pipeline.push(
      {
        $lookup: {
          from: "rawmaterialtypes",
          localField: "materialType",
          foreignField: "_id",
          as: "materialType"
        }
      },
      {
        $unwind: {
          path: "$materialType",
          preserveNullAndEmptyArrays: true
        }
      }
    );

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "materialType.code": { $regex: search, $options: "i" } },
            { "materialType.name": { $regex: search, $options: "i" } },
            { supplier: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    pipeline.push({
      $facet: {
        items: [
          {
            $sort: {
              "materialType.code": 1,
              "dimensions.length": 1,
              "dimensions.width": 1,
              "dimensions.height": 1,
              _id: 1
            }
          },
          { $skip: skip },
          { $limit: limitNum }
        ],
        total: [{ $count: "count" }]
      }
    });

    const [result] = await RawMaterial.aggregate(pipeline);
    const items = result?.items ?? [];
    const total = result?.total?.[0]?.count ?? 0;

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

