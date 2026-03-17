import { GridLayout, GridLayoutDocument } from "./grid-layout.model";
  import { GridLayoutDTO, GridLayoutFilters } from "./grid-layout.types";
  export class GridLayoutService {
    async list(filters: GridLayoutFilters = {}): Promise<GridLayoutDocument[]> {
      // TODO: apply filters
      return GridLayout.find().exec();
    }
    async getById(id: string): Promise<GridLayoutDocument | null> {
      return GridLayout.findById(id).exec();
    }
    async create(data: GridLayoutDTO): Promise<GridLayoutDocument> {
      const doc = new GridLayout(data);
      return doc.save();
    }
    async update(id: string, data: Partial<GridLayoutDTO>): Promise<GridLayoutDocument | null> {
      return GridLayout.findByIdAndUpdate(id, data, { new: true }).exec();
    }
    async remove(id: string): Promise<GridLayoutDocument | null> {
      return GridLayout.findByIdAndDelete(id).exec();
    }
  }
  export const gridLayoutService = new GridLayoutService();
  