import mongoose from "mongoose";
import { Device } from "../models/Device";

/**
 * Query helpers for Device model
 * Provides reusable query helpers with different population profiles
 *
 * Note: The Device model has pre-hooks that auto-populate deviceType, currentUser, and currentTask.
 * These query helpers allow explicit control over population for better performance and flexibility.
 */
export class DeviceQuery {
  /**
   * Get base query builder (no population)
   * Use for: count queries, existence checks, simple lookups
   */
  static getBaseQuery(query: any = {}) {
    return Device.find(query);
  }

  /**
   * Get device query with minimal population (for list views)
   * Populates: deviceType only
   */
  static getDeviceListQuery(query: any = {}) {
    return Device.find(query).populate("deviceType", "name description");
  }

  /**
   * Get device query with standard population (for detail views)
   * Populates: deviceType, currentUser (basic)
   */
  static getDeviceDetailQuery(query: any = {}) {
    return Device.find(query)
      .populate("deviceType", "name description")
      .populate("currentUser", "name username email");
  }

  /**
   * Get device query with full population (for complete detail views)
   * Populates: deviceType, currentUser, currentTask
   */
  static getDeviceFullQuery(query: any = {}) {
    return Device.find(query)
      .populate("deviceType", "name description")
      .populate("currentUser", "name username email")
      .populate("currentTask", "title status progress priority");
  }

  /**
   * Get device by ID with minimal population
   */
  static async getDeviceByIdMinimal(id: string | mongoose.Types.ObjectId) {
    return Device.findById(id).populate("deviceType", "name description");
  }

  /**
   * Get device by ID with standard population
   */
  static async getDeviceById(id: string | mongoose.Types.ObjectId) {
    return Device.findById(id)
      .populate("deviceType", "name description")
      .populate("currentUser", "name username email");
  }

  /**
   * Get device by ID with full population
   */
  static async getDeviceByIdFull(id: string | mongoose.Types.ObjectId) {
    return Device.findById(id)
      .populate("deviceType", "name description")
      .populate("currentUser", "name username email")
      .populate("currentTask", "title status progress priority");
  }

  /**
   * Get devices with pagination and filtering
   * Uses list query (minimal population for performance)
   */
  static getDevicesPaginated(
    query: any = {},
    page: number = 1,
    limit: number = 10,
    sort: any = { createdAt: -1 }
  ) {
    const skip = (page - 1) * limit;
    return this.getDeviceListQuery(query).skip(skip).limit(limit).sort(sort);
  }

  /**
   * Count devices matching query
   * No population - just count
   */
  static async countDevices(query: any = {}) {
    return Device.countDocuments(query);
  }

  /**
   * Find devices by device type
   */
  static getDevicesByDeviceType(deviceTypeId: string | mongoose.Types.ObjectId) {
    return this.getDeviceListQuery({ deviceTypeId });
  }

  /**
   * Find devices by status
   */
  static getDevicesByStatus(status: "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR") {
    return this.getDeviceListQuery({ status });
  }

  /**
   * Find devices by current user
   */
  static getDevicesByCurrentUser(userId: string | mongoose.Types.ObjectId) {
    return this.getDeviceDetailQuery({ currentUser: userId });
  }

  /**
   * Find devices by current task
   */
  static getDevicesByCurrentTask(taskId: string | mongoose.Types.ObjectId) {
    return this.getDeviceDetailQuery({ currentTask: taskId });
  }
}

