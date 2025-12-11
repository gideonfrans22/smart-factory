import mongoose from "mongoose";
import { RawMaterial } from "../models/RawMaterial";

/**
 * Query helpers for RawMaterial model
 * Provides reusable query helpers with different population profiles
 *
 * Note: The RawMaterial model has pre-hooks that auto-populate modifiedBy.
 * These query helpers allow explicit control over population for better performance and flexibility.
 */
export class RawMaterialQuery {
  /**
   * Get base query builder (no population)
   * Use for: count queries, existence checks, simple lookups
   */
  static getBaseQuery(query: any = {}) {
    return RawMaterial.find(query);
  }

  /**
   * Get raw material query with minimal population (for list views)
   * Populates: modifiedBy only
   */
  static getRawMaterialListQuery(query: any = {}) {
    return RawMaterial.find(query).populate("modifiedBy", "name email");
  }

  /**
   * Get raw material query with standard population (for detail views)
   * Same as list query for RawMaterial (only modifiedBy to populate)
   */
  static getRawMaterialDetailQuery(query: any = {}) {
    return RawMaterial.find(query).populate("modifiedBy", "name email");
  }

  /**
   * Get raw material by ID with minimal population
   */
  static async getRawMaterialByIdMinimal(id: string | mongoose.Types.ObjectId) {
    return RawMaterial.findById(id).populate("modifiedBy", "name email");
  }

  /**
   * Get raw material by ID with standard population
   */
  static async getRawMaterialById(id: string | mongoose.Types.ObjectId) {
    return RawMaterial.findById(id).populate("modifiedBy", "name email");
  }

  /**
   * Get raw material by material code
   */
  static async getRawMaterialByCode(materialCode: string) {
    return RawMaterial.findOne({ materialCode });
  }

  /**
   * Get raw materials with pagination and filtering
   * Uses list query (minimal population for performance)
   */
  static getRawMaterialsPaginated(
    query: any = {},
    page: number = 1,
    limit: number = 10,
    sort: any = { createdAt: -1 }
  ) {
    const skip = (page - 1) * limit;
    return this.getRawMaterialListQuery(query).skip(skip).limit(limit).sort(sort);
  }

  /**
   * Count raw materials matching query
   * No population - just count
   */
  static async countRawMaterials(query: any = {}) {
    return RawMaterial.countDocuments(query);
  }

  /**
   * Search raw materials by name or material code
   */
  static searchRawMaterials(searchTerm: string) {
    const regex = new RegExp(searchTerm, "i");
    return this.getRawMaterialListQuery({
      $or: [
        { name: regex },
        { materialCode: regex }
      ]
    });
  }
}

