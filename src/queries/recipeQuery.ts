import mongoose from "mongoose";
import { Recipe } from "../models/Recipe";

/**
 * Query helpers for Recipe model
 * Provides reusable query helpers with different population profiles
 *
 * Note: The Recipe model has pre-hooks that auto-populate steps.mediaIds.
 * These query helpers allow explicit control over population for better performance and flexibility.
 */
export class RecipeQuery {
  /**
   * Get base query builder (no population)
   * Use for: count queries, existence checks, simple lookups
   * Automatically excludes soft-deleted recipes (via model pre-hook)
   */
  static getBaseQuery(query: any = {}) {
    return Recipe.find(query);
  }

  /**
   * Get recipe query with minimal population (for list views)
   * Populates: modifiedBy only
   */
  static getRecipeListQuery(query: any = {}) {
    return Recipe.find(query)
      .populate("modifiedBy", "name email")
      .select("-steps"); // Exclude steps for list view (lighter payload)
  }

  /**
   * Get recipe query with standard population (for detail views)
   * Populates: modifiedBy, steps.mediaIds (basic)
   */
  static getRecipeDetailQuery(query: any = {}) {
    return Recipe.find(query)
      .populate("modifiedBy", "name email")
      .populate({
        path: "steps.mediaIds",
        select: "filename originalName mimeType fileSize filePath"
      });
  }

  /**
   * Get recipe query with full population (for complete detail views)
   * Populates: modifiedBy, steps.mediaIds, steps.deviceTypeId, rawMaterials.materialId
   */
  static getRecipeFullQuery(query: any = {}) {
    return Recipe.find(query)
      .populate("modifiedBy", "name email")
      .populate({
        path: "steps.mediaIds",
        select: "filename originalName mimeType fileSize filePath"
      })
      .populate({
        path: "steps.deviceTypeId",
        select: "name description"
      })
      .populate({
        path: "rawMaterials.materialId",
        select: "materialCode name specifications supplier unit"
      })
      .populate({
        path: "mediaIds",
        select: "filename originalName mimeType fileSize filePath"
      });
  }

  /**
   * Get recipe by ID with minimal population
   */
  static async getRecipeByIdMinimal(id: string | mongoose.Types.ObjectId) {
    return Recipe.findById(id).populate("modifiedBy", "name email");
  }

  /**
   * Get recipe by ID with standard population
   */
  static async getRecipeById(id: string | mongoose.Types.ObjectId) {
    return Recipe.findById(id)
      .populate("modifiedBy", "name email")
      .populate({
        path: "steps.mediaIds",
        select: "filename originalName mimeType fileSize filePath"
      });
  }

  /**
   * Get recipe by ID with full population
   */
  static async getRecipeByIdFull(id: string | mongoose.Types.ObjectId) {
    return Recipe.findById(id)
      .populate("modifiedBy", "name email")
      .populate({
        path: "steps.mediaIds",
        select: "filename originalName mimeType fileSize filePath"
      })
      .populate({
        path: "steps.deviceTypeId",
        select: "name description"
      })
      .populate({
        path: "rawMaterials.materialId",
        select: "materialCode name specifications supplier unit"
      })
      .populate({
        path: "mediaIds",
        select: "filename originalName mimeType fileSize filePath"
      });
  }

  /**
   * Get recipe by recipe number and version
   */
  static async getRecipeByNumberAndVersion(
    recipeNumber: string,
    version: number
  ) {
    return Recipe.findOne({ recipeNumber, version });
  }

  /**
   * Get recipes by product ID
   */
  static getRecipesByProduct(productId: string | mongoose.Types.ObjectId) {
    return this.getRecipeListQuery({ product: productId });
  }

  /**
   * Get recipes with pagination and filtering
   * Uses list query (minimal population for performance)
   */
  static getRecipesPaginated(
    query: any = {},
    page: number = 1,
    limit: number = 10,
    sort: any = { createdAt: -1 }
  ) {
    const skip = (page - 1) * limit;
    return this.getRecipeListQuery(query).skip(skip).limit(limit).sort(sort);
  }

  /**
   * Count recipes matching query
   * No population - just count
   */
  static async countRecipes(query: any = {}) {
    return Recipe.countDocuments(query);
  }
}

