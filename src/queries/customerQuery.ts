import mongoose from "mongoose";
import Customer from "../models/Customer";

/**
 * Query helpers for Customer model
 * Provides reusable query helpers with different population profiles
 *
 * Note: The Customer model has pre-hooks that auto-populate modifiedBy.
 * These query helpers allow explicit control over population for better performance and flexibility.
 */
export class CustomerQuery {
  /**
   * Get base query builder (no population)
   * Use for: count queries, existence checks, simple lookups
   */
  static getBaseQuery(query: any = {}) {
    return Customer.find(query);
  }

  /**
   * Get customer query with minimal population (for list views)
   * Populates: modifiedBy only
   */
  static getCustomerListQuery(query: any = {}) {
    return Customer.find(query).populate("modifiedBy", "name email");
  }

  /**
   * Get customer query with standard population (for detail views)
   * Same as list query for Customer (only modifiedBy to populate)
   */
  static getCustomerDetailQuery(query: any = {}) {
    return Customer.find(query).populate("modifiedBy", "name email");
  }

  /**
   * Get customer by ID with minimal population
   */
  static async getCustomerByIdMinimal(id: string | mongoose.Types.ObjectId) {
    return Customer.findById(id).populate("modifiedBy", "name email");
  }

  /**
   * Get customer by ID with standard population
   */
  static async getCustomerById(id: string | mongoose.Types.ObjectId) {
    return Customer.findById(id).populate("modifiedBy", "name email");
  }

  /**
   * Get customer by name
   */
  static async getCustomerByName(name: string) {
    return Customer.findOne({ name });
  }

  /**
   * Get customers with pagination and filtering
   * Uses list query (minimal population for performance)
   */
  static getCustomersPaginated(
    query: any = {},
    page: number = 1,
    limit: number = 10,
    sort: any = { createdAt: -1 }
  ) {
    const skip = (page - 1) * limit;
    return this.getCustomerListQuery(query).skip(skip).limit(limit).sort(sort);
  }

  /**
   * Count customers matching query
   * No population - just count
   */
  static async countCustomers(query: any = {}) {
    return Customer.countDocuments(query);
  }

  /**
   * Search customers by name or person in charge
   */
  static searchCustomers(searchTerm: string) {
    const regex = new RegExp(searchTerm, "i");
    return this.getCustomerListQuery({
      $or: [
        { name: regex },
        { personInCharge: regex }
      ]
    });
  }
}

