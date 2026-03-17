import { RawMaterial, RawMaterialDocument } from "./raw-material.model";
import { RawMaterialDTO, RawMaterialFilters } from "./raw-material.types";
export class RawMaterialService {
  async list(
    _filters: RawMaterialFilters = {}
  ): Promise<RawMaterialDocument[]> {
    // TODO: apply filters
    return RawMaterial.find().exec();
  }
  async getById(id: string): Promise<RawMaterialDocument | null> {
    return RawMaterial.findById(id).exec();
  }
  async create(data: RawMaterialDTO): Promise<RawMaterialDocument> {
    const doc = new RawMaterial(data);
    return doc.save();
  }
  async update(
    id: string,
    data: Partial<RawMaterialDTO>
  ): Promise<RawMaterialDocument | null> {
    return RawMaterial.findByIdAndUpdate(id, data, { new: true }).exec();
  }
  async remove(id: string): Promise<RawMaterialDocument | null> {
    return RawMaterial.findByIdAndDelete(id).exec();
  }
}
export const rawMaterialService = new RawMaterialService();
