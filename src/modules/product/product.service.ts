import { Product, ProductDocument } from "./product.model";
import { ProductDTO, ProductFilters } from "./product.types";
export class ProductService {
  async list(_filters: ProductFilters = {}): Promise<ProductDocument[]> {
    // TODO: apply filters
    return Product.find().exec();
  }
  async getById(id: string): Promise<ProductDocument | null> {
    return Product.findById(id).exec();
  }
  async create(data: ProductDTO): Promise<ProductDocument> {
    const doc = new Product(data);
    return doc.save();
  }
  async update(
    id: string,
    data: Partial<ProductDTO>
  ): Promise<ProductDocument | null> {
    return Product.findByIdAndUpdate(id, data, { new: true }).exec();
  }
  async remove(id: string): Promise<ProductDocument | null> {
    return Product.findByIdAndDelete(id).exec();
  }
}
export const productService = new ProductService();
