/**
 * Equipment Performance Report Data Aggregation Service
 * Handles all data queries and calculations for equipment/device performance reports
 */

import { Alert } from "@modules/alert";
import { Device } from "@modules/device";
import { Task } from "@modules/task";
import { DateRangeFilter } from "../helpers/adjustDateRangeForPeriod";

export interface EquipmentUtilization {
  deviceId: string;
  deviceName: string;
  deviceTypeId: string;
  deviceTypeName: string;
  actualUptimeHours: number; // Sum of task actualDuration in hours
  operationalHours: number; // Total hours in date range
  utilization: number; // (actualUptimeHours / operationalHours) × 100
}

/**
 * Calculate overall device utilization: (Actual uptime/operational hours) x 100
 *
 * endDate가 미래인 경우 (예: 월간 리포트를 월 중에 생성),
 * 현재 시각까지만 경과 시간으로 분모를 계산하여
 * 아직 지나지 않은 시간이 분모에 포함되지 않도록 합니다.
 */
export async function aggregateEquipmentUtilization(
  dateRange: DateRangeFilter
): Promise<EquipmentUtilization[]> {
  const { startDate, endDate } = dateRange;

  // endDate가 현재 시각보다 미래이면, 현재 시각까지만 경과 시간으로 계산
  const now = new Date();
  const effectiveEndDate = endDate > now ? now : endDate;

  // Calculate operational hours for the date range (경과 시간만)
  const operationalHours =
    (effectiveEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

  // Get all devices to ensure we include devices with no tasks
  const allDevices = await Device.find()
    .populate("deviceTypeId", "name")
    .setOptions({ includeDeleted: false })
    .lean();

  // Get task statistics per device
  const taskStats = await Task.aggregate([
    {
      $match: {
        status: "COMPLETED",
        deviceId: { $exists: true, $ne: null },
        completedAt: { $gte: startDate, $lte: endDate },
        actualDuration: { $exists: true, $gt: 0 }
      }
    },
    {
      $group: {
        _id: "$deviceId",
        totalActualDuration: { $sum: "$actualDuration" } // in minutes
      }
    }
  ]);

  // Create a map for quick lookup
  const taskStatsMap = new Map(
    taskStats.map((stat) => [stat._id.toString(), stat.totalActualDuration])
  );

  // Build utilization data for all devices
  const utilization: EquipmentUtilization[] = allDevices.map((device) => {
    const totalActualDurationMinutes =
      taskStatsMap.get(device._id.toString()) || 0;
    const actualUptimeHours = totalActualDurationMinutes / 60;
    const utilization =
      operationalHours > 0 ? (actualUptimeHours / operationalHours) * 100 : 0;

    return {
      deviceId: device._id.toString(),
      deviceName: device.name,
      deviceTypeId: device.deviceTypeId._id.toString(),
      deviceTypeName: (device.deviceTypeId as any)?.name || "Unknown Type",
      actualUptimeHours,
      operationalHours,
      utilization
    };
  });

  return utilization.sort((a, b) => b.utilization - a.utilization);
}

export interface EquipmentErrorCount {
  deviceId: string;
  deviceName: string;
  deviceTypeId: string;
  deviceTypeName: string;
  errorCount: number;
}

/**
 * Calculate error count per equipment
 */
export async function aggregateEquipmentErrorCount(
  dateRange: DateRangeFilter
): Promise<EquipmentErrorCount[]> {
  const { startDate, endDate } = dateRange;

  const errorStats = await Alert.aggregate([
    {
      $match: {
        type: "EQUIPMENT_DEFECT",
        device: { $exists: true, $ne: null },
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$device",
        errorCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "devices",
        localField: "_id",
        foreignField: "_id",
        as: "device"
      }
    },
    {
      $unwind: {
        path: "$device",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: "devicetypes",
        localField: "device.deviceTypeId",
        foreignField: "_id",
        as: "deviceType"
      }
    },
    {
      $unwind: {
        path: "$deviceType",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        deviceId: { $toString: "$_id" },
        deviceName: {
          $ifNull: ["$device.name", "Unknown Device"]
        },
        deviceTypeId: {
          $toString: "$device.deviceTypeId"
        },
        deviceTypeName: {
          $ifNull: ["$deviceType.name", "Unknown Type"]
        },
        errorCount: 1
      }
    },
    {
      $sort: { errorCount: -1 }
    }
  ]);

  // Get all devices to include those with zero errors
  const allDevices = await Device.find()
    .populate("deviceTypeId", "name")
    .setOptions({ includeDeleted: false })
    .lean();

  const errorStatsMap = new Map(
    errorStats.map((stat) => [stat.deviceId, stat])
  );

  // Build complete list including devices with zero errors
  const allErrorCounts: EquipmentErrorCount[] = allDevices.map((device) => {
    const existing = errorStatsMap.get(device._id.toString());
    if (existing) {
      return existing;
    }

    return {
      deviceId: device._id.toString(),
      deviceName: device.name,
      deviceTypeId: device.deviceTypeId._id.toString(),
      deviceTypeName: (device.deviceTypeId as any)?.name || "Unknown Type",
      errorCount: 0
    };
  });

  return allErrorCounts.sort((a, b) => b.errorCount - a.errorCount);
}

export interface EquipmentProductionCount {
  deviceId: string;
  deviceName: string;
  deviceTypeId: string;
  deviceTypeName: string;
  productionCount: number; // Number of completed tasks
}

/**
 * Calculate production count per equipment
 */
export async function aggregateEquipmentProductionCount(
  dateRange: DateRangeFilter
): Promise<EquipmentProductionCount[]> {
  const { startDate, endDate } = dateRange;

  const productionStats = await Task.aggregate([
    {
      $match: {
        status: "COMPLETED",
        deviceId: { $exists: true, $ne: null },
        completedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$deviceId",
        productionCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "devices",
        localField: "_id",
        foreignField: "_id",
        as: "device"
      }
    },
    {
      $unwind: {
        path: "$device",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: "devicetypes",
        localField: "device.deviceTypeId",
        foreignField: "_id",
        as: "deviceType"
      }
    },
    {
      $unwind: {
        path: "$deviceType",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        deviceId: { $toString: "$_id" },
        deviceName: {
          $ifNull: ["$device.name", "Unknown Device"]
        },
        deviceTypeId: {
          $toString: "$device.deviceTypeId"
        },
        deviceTypeName: {
          $ifNull: ["$deviceType.name", "Unknown Type"]
        },
        productionCount: 1
      }
    },
    {
      $sort: { productionCount: -1 }
    }
  ]);

  // Get all devices to include those with zero production
  const allDevices = await Device.find()
    .populate("deviceTypeId", "name")
    .setOptions({ includeDeleted: false })
    .lean();

  const productionStatsMap = new Map(
    productionStats.map((stat) => [stat.deviceId, stat])
  );

  // Build complete list including devices with zero production
  const allProductionCounts: EquipmentProductionCount[] = allDevices.map(
    (device) => {
      const existing = productionStatsMap.get(device._id.toString());
      if (existing) {
        return existing;
      }

      return {
        deviceId: device._id.toString(),
        deviceName: device.name,
        deviceTypeId: device.deviceTypeId._id.toString(),
        deviceTypeName: (device.deviceTypeId as any)?.name || "Unknown Type",
        productionCount: 0
      };
    }
  );

  return allProductionCounts.sort(
    (a, b) => b.productionCount - a.productionCount
  );
}
