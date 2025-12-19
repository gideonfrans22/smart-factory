import ExcelJS from "exceljs";
import { Alert } from "../models/Alert";
import { Device } from "../models/Device";
import { Task } from "../models/Task";
import * as ExcelFormatService from "./excelFormatService";

/**
 * Equipment Performance Report Data Aggregation Service
 * Handles all data queries and calculations for equipment/device performance reports
 */

// ==================== INTERFACES ====================

export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

export interface EquipmentUtilization {
  deviceId: string;
  deviceName: string;
  deviceTypeId: string;
  deviceTypeName: string;
  actualUptimeHours: number; // Sum of task actualDuration in hours
  operationalHours: number; // Total hours in date range
  utilization: number; // (actualUptimeHours / operationalHours) × 100
}

export interface EquipmentErrorCount {
  deviceId: string;
  deviceName: string;
  deviceTypeId: string;
  deviceTypeName: string;
  errorCount: number;
}

export interface EquipmentProductionCount {
  deviceId: string;
  deviceName: string;
  deviceTypeId: string;
  deviceTypeName: string;
  productionCount: number; // Number of completed tasks
}

// ==================== KPI CALCULATION FUNCTIONS ====================

/**
 * Adjust date range based on period type
 */
export function adjustDateRangeForPeriod(
  startDate: Date,
  endDate: Date,
  period?: "daily" | "weekly" | "monthly"
): DateRangeFilter {
  if (!period) {
    return { startDate, endDate };
  }

  const adjustedStart = new Date(startDate);
  const adjustedEnd = new Date(endDate);

  switch (period) {
    case "daily":
      // Set to start of day and end of same day
      adjustedStart.setHours(0, 0, 0, 0);
      adjustedEnd.setTime(adjustedStart.getTime());
      adjustedEnd.setHours(23, 59, 59, 999);
      break;

    case "weekly":
      // Set to Monday of the week containing startDate
      const dayOfWeek = adjustedStart.getDay();
      const diff =
        adjustedStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      adjustedStart.setDate(diff);
      adjustedStart.setHours(0, 0, 0, 0);
      // Set to Sunday of the same week
      adjustedEnd.setTime(adjustedStart.getTime());
      adjustedEnd.setDate(adjustedStart.getDate() + 6);
      adjustedEnd.setHours(23, 59, 59, 999);
      break;

    case "monthly":
      // Set to first day of month
      adjustedStart.setDate(1);
      adjustedStart.setHours(0, 0, 0, 0);
      // Set to last day of month
      adjustedEnd.setMonth(adjustedStart.getMonth() + 1);
      adjustedEnd.setDate(0);
      adjustedEnd.setHours(23, 59, 59, 999);
      break;
  }

  return { startDate: adjustedStart, endDate: adjustedEnd };
}

/**
 * Calculate overall device utilization: (Actual uptime/operational hours) x 100
 */
export async function calculateEquipmentUtilization(
  dateRange: DateRangeFilter
): Promise<EquipmentUtilization[]> {
  const { startDate, endDate } = dateRange;

  // Calculate operational hours for the date range
  const operationalHours =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

  // Get all devices to ensure we include devices with no tasks
  const allDevices = await Device.find()
    .populate("deviceTypeId", "name")
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

/**
 * Calculate error count per equipment
 */
export async function calculateEquipmentErrorCount(
  dateRange: DateRangeFilter
): Promise<EquipmentErrorCount[]> {
  const { startDate, endDate } = dateRange;

  const errorStats = await Alert.aggregate([
    {
      $match: {
        type: { $in: ["MACHINE_ERROR", "ERROR"] },
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

/**
 * Calculate production count per equipment
 */
export async function calculateEquipmentProductionCount(
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

// ==================== SHEET GENERATION FUNCTION ====================

/**
 * Generate comprehensive Equipment Performance KPI Sheet
 * Single sheet containing all equipment KPI calculations
 */
export async function generateEquipmentPerformanceKPISheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  period?: "daily" | "weekly" | "monthly"
): Promise<void> {
  console.log("Generating Equipment Performance KPI Sheet...");

  // Adjust date range based on period
  const adjustedDateRange = adjustDateRangeForPeriod(
    dateRange.startDate,
    dateRange.endDate,
    period
  );

  const worksheet = workbook.addWorksheet("Equipment Performance KPIs");
  let currentRow = 1;

  // ===== TITLE =====
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  const periodLabel = period
    ? period.charAt(0).toUpperCase() + period.slice(1)
    : "All Time";
  titleCell.value = `EQUIPMENT PERFORMANCE KPI REPORT - ${periodLabel}`;
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // Date range info
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const dateRangeCell = worksheet.getCell(`A${currentRow}`);
  dateRangeCell.value = `Date Range: ${adjustedDateRange.startDate.toLocaleDateString()} - ${adjustedDateRange.endDate.toLocaleDateString()}`;
  dateRangeCell.font = { size: 11 };
  dateRangeCell.alignment = { horizontal: "center" };
  currentRow += 2;

  // Calculate all KPIs in parallel
  const [equipmentUtilization, equipmentErrorCount, equipmentProductionCount] =
    await Promise.all([
      calculateEquipmentUtilization(adjustedDateRange),
      calculateEquipmentErrorCount(adjustedDateRange),
      calculateEquipmentProductionCount(adjustedDateRange)
    ]);

  // ===== SECTION 1: Overall Device Utilization =====
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const section1Header = worksheet.getCell(`A${currentRow}`);
  section1Header.value = "Overall Device Utilization";
  section1Header.font = { size: 14, bold: true };
  section1Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  // Headers
  const utilizationHeaders = [
    "Device Name",
    "Device Type",
    "Actual Uptime (Hours)",
    "Operational Hours",
    "Utilization (%)"
  ];
  utilizationHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center" };
  });
  currentRow++;

  // Data rows
  equipmentUtilization.forEach((equipment) => {
    worksheet.getCell(`A${currentRow}`).value = equipment.deviceName;
    worksheet.getCell(`B${currentRow}`).value = equipment.deviceTypeName;
    worksheet.getCell(`C${currentRow}`).value = equipment.actualUptimeHours;
    worksheet.getCell(`C${currentRow}`).numFmt = "0.00";
    worksheet.getCell(`D${currentRow}`).value = equipment.operationalHours;
    worksheet.getCell(`D${currentRow}`).numFmt = "0.00";
    worksheet.getCell(`E${currentRow}`).value = equipment.utilization;
    worksheet.getCell(`E${currentRow}`).numFmt = "0.00";

    // Color code utilization
    const utilization = equipment.utilization;
    if (utilization >= 80) {
      worksheet.getCell(`E${currentRow}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.SUCCESS }
      };
    } else if (utilization >= 50) {
      worksheet.getCell(`E${currentRow}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.WARNING }
      };
    } else {
      worksheet.getCell(`E${currentRow}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.DANGER }
      };
    }

    currentRow++;
  });
  currentRow += 2;

  // ===== SECTION 2: Error Count per Equipment =====
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  const section2Header = worksheet.getCell(`A${currentRow}`);
  section2Header.value = "Error Count per Equipment";
  section2Header.font = { size: 14, bold: true };
  section2Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  // Headers
  const errorHeaders = ["Device Name", "Device Type", "Error Count"];
  errorHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center" };
  });
  currentRow++;

  // Data rows
  equipmentErrorCount.forEach((equipment) => {
    worksheet.getCell(`A${currentRow}`).value = equipment.deviceName;
    worksheet.getCell(`B${currentRow}`).value = equipment.deviceTypeName;
    worksheet.getCell(`C${currentRow}`).value = equipment.errorCount;
    worksheet.getCell(`C${currentRow}`).numFmt = "#,##0";
    currentRow++;
  });
  currentRow += 2;

  // ===== SECTION 3: Production Count per Equipment =====
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  const section3Header = worksheet.getCell(`A${currentRow}`);
  section3Header.value = "Production Count per Equipment";
  section3Header.font = { size: 14, bold: true };
  section3Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  // Headers
  const productionHeaders = ["Device Name", "Device Type", "Production Count"];
  productionHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center" };
  });
  currentRow++;

  // Data rows
  equipmentProductionCount.forEach((equipment) => {
    worksheet.getCell(`A${currentRow}`).value = equipment.deviceName;
    worksheet.getCell(`B${currentRow}`).value = equipment.deviceTypeName;
    worksheet.getCell(`C${currentRow}`).value = equipment.productionCount;
    worksheet.getCell(`C${currentRow}`).numFmt = "#,##0";
    currentRow++;
  });

  // Set column widths
  worksheet.getColumn(1).width = 25;
  worksheet.getColumn(2).width = 20;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 18;

  // Freeze header rows
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  console.log("✓ Equipment Performance KPI Sheet generated successfully");
}
