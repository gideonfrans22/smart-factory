import mongoose from "mongoose";
import { Product } from "../models/Product";

/**
 * Service for product-related query operations
 * Provides reusable query helpers with different population profiles
 *
 * Note: Soft-delete filtering is handled by the model's pre-hook.
 * To include deleted products, use: Product.find({ ...query, deletedAt: { $ne: null } })
 */
export class ProductService {
  /**
   * Get base query builder (no population)
   * Use for: count queries, existence checks, simple lookups
   * Automatically excludes soft-deleted products (via model pre-hook)
   */
  static getBaseQuery(query: any = {}) {
    return Product.find(query);
  }

  /**
   * Get product query with minimal population (for list views)
   * Populates: modifiedBy only
   */
  static getProductListQuery(query: any = {}) {
    return Product.find(query)
      .populate("modifiedBy", "name email")
      .select("-recipes"); // Exclude recipes for list view (lighter payload)
  }

  /**
   * Get product query with standard population (for detail views)
   * Populates: modifiedBy, recipes.recipeId (basic)
   */
  static getProductDetailQuery(query: any = {}) {
    return Product.find(query)
      .populate("modifiedBy", "name email")
      .populate({
        path: "recipes.recipeId",
        select: "name recipeNumber version description estimatedDuration",
        options: { sort: { createdAt: 1 } }
      });
  }

  /**
   * Get product query with full population (for complete detail views)
   * Populates: modifiedBy, recipes.recipeId with nested populations
   */
  static getProductFullQuery(query: any = {}) {
    return Product.find(query)
      .populate("modifiedBy", "name email")
      .populate({
        path: "recipes.recipeId",
        select:
          "name recipeNumber version description estimatedDuration dwgNo unit outsourcing remarks",
        options: { sort: { createdAt: 1 } },
        populate: [
          {
            path: "modifiedBy",
            select: "name email"
          },
          {
            path: "rawMaterials.materialId",
            select: "materialCode name specifications supplier unit"
          },
          {
            path: "mediaIds",
            select: "filename originalName mimeType fileSize filePath"
          },
          {
            path: "steps.deviceTypeId",
            select: "name description"
          }
        ]
      });
  }

  /**
   * Get product by ID with minimal population
   */
  static async getProductByIdMinimal(id: string | mongoose.Types.ObjectId) {
    return Product.findById(id).populate("modifiedBy", "name email");
  }

  /**
   * Get product by ID with standard population
   */
  static async getProductById(id: string | mongoose.Types.ObjectId) {
    return Product.findById(id)
      .populate("modifiedBy", "name email")
      .populate({
        path: "recipes.recipeId",
        select: "name recipeNumber version description estimatedDuration",
        options: { sort: { createdAt: 1 } }
      });
  }

  /**
   * Get product by ID with full population
   */
  static async getProductByIdFull(id: string | mongoose.Types.ObjectId) {
    return Product.findById(id)
      .populate("modifiedBy", "name email")
      .populate({
        path: "recipes.recipeId",
        select:
          "name recipeNumber version description estimatedDuration dwgNo unit outsourcing remarks",
        options: { sort: { createdAt: 1 } },
        populate: [
          {
            path: "modifiedBy",
            select: "name email"
          },
          {
            path: "rawMaterials.materialId",
            select: "materialCode name specifications supplier unit"
          },
          {
            path: "mediaIds",
            select: "filename originalName mimeType fileSize filePath"
          },
          {
            path: "steps.deviceTypeId",
            select: "name description"
          }
        ]
      });
  }

  /**
   * Get product by design number (for duplicate checks)
   * No population - just existence check
   */
  static async getProductByDesignNumber(designNumber: string) {
    return Product.findOne({ designNumber });
  }

  /**
   * Get products with recipes populated (for product recipes endpoint)
   */
  static async getProductWithRecipes(id: string | mongoose.Types.ObjectId) {
    return Product.findById(id).populate({
      path: "recipes.recipeId",
      options: { sort: { createdAt: 1 } }
    });
  }

  /**
   * Find products using a recipe (for dependency checks)
   * No population needed - just finding references
   */
  static getProductsUsingRecipe(recipeId: string | mongoose.Types.ObjectId) {
    return Product.find({
      "recipes.recipeId": recipeId
    });
  }

  /**
   * Get products with pagination and filtering
   * Uses list query (minimal population for performance)
   */
  static getProductsPaginated(
    query: any = {},
    page: number = 1,
    limit: number = 10,
    sort: any = { createdAt: -1 }
  ) {
    const skip = (page - 1) * limit;
    return this.getProductListQuery(query).skip(skip).limit(limit).sort(sort);
  }

  /**
   * Count products matching query
   * No population - just count
   */
  static async countProducts(query: any = {}) {
    return Product.countDocuments(query);
  }
}
