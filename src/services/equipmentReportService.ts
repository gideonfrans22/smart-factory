import ExcelJS from "exceljs";
import { Alert } from "../models/Alert";
import { Device } from "@modules/device";
import { Task } from "../models/Task";
import * as ExcelFormatService from "./excelFormatService";
import { formatDateKorean } from "./excelFormatService";
import { loggerService } from "@shared/services";

/**
 * Equipment Performance Report Data Aggregation Service
 * Handles all data queries and calculations for equipment/device performance reports
 */

// ==================== TRANSLATIONS ====================

const TRANSLATIONS = {
  // Equipment Report
  equipmentReport: {
    title: {
      en: "Equipment Report",
      ko: "설비 보고서"
    },
    period: {
      en: "Period",
      ko: "기간"
    },
    to: {
      en: "to",
      ko: "~"
    },
    equipmentNo: {
      en: "Equipment No",
      ko: "장비번호"
    },
    equipmentName: {
      en: "Equipment Name",
      ko: "장비명"
    },
    operationTime: {
      en: "Operation Time",
      ko: "가동 시간"
    },
    downtime: {
      en: "Downtime",
      ko: "비가동 시간"
    },
    operationRate: {
      en: "Operation Rate",
      ko: "가동률"
    },
    errorCount: {
      en: "Error Count",
      ko: "에러발생횟수"
    },
    productionQuantity: {
      en: "Production Quantity",
      ko: "생산량"
    }
  },
  // Approval workflow
  approval: {
    created: {
      en: "Created",
      ko: "작성"
    },
    reviewed: {
      en: "Reviewed",
      ko: "검토"
    },
    approved: {
      en: "Approved",
      ko: "승인"
    }
  },
  // Legacy Equipment KPI Report (keeping for backward compatibility)
  equipmentKPI: {
    title: {
      en: "EQUIPMENT PERFORMANCE KPI REPORT",
      ko: "장비 성능 KPI 보고서"
    },
    period: {
      en: "Period",
      ko: "기간"
    },
    to: {
      en: "to",
      ko: "~"
    },
    deviceName: {
      en: "Device Name",
      ko: "장비명"
    },
    deviceType: {
      en: "Device Type",
      ko: "장비 유형"
    },
    utilization: {
      en: "Utilization (%)",
      ko: "가동률 (%)"
    },
    actualUptimeHours: {
      en: "Actual Uptime Hours",
      ko: "실제 가동 시간"
    },
    operationalHours: {
      en: "Operational Hours",
      ko: "운영 시간"
    },
    errorCount: {
      en: "Error Count",
      ko: "오류 횟수"
    },
    productionCount: {
      en: "Production Count",
      ko: "생산량"
    }
  },
  // Reuse from workerReportService
  titles: {
    kpi: {
      en: "KPI",
      ko: "KPI"
    },
    kpiValue: {
      en: "Value",
      ko: "값"
    }
  },
  roles: {
    manager: {
      en: "Manager",
      ko: "관리자"
    },
    ceo: {
      en: "CEO",
      ko: "대표"
    },
    worker: {
      en: "Worker",
      ko: "작업자"
    }
  }
};

/**
 * Get translation for a given path and language
 * @param path - Dot-separated path to translation key (e.g., "equipmentKPI.title")
 * @param lang - Language code ("en" or "ko"), defaults to "en"
 * @returns Translated string value
 */
function getTranslation(path: string, lang: string = "en"): string {
  const keys = path.split(".");
  let value: any = TRANSLATIONS;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      console.warn(`Translation not found for path: ${path}`);
      return path;
    }
  }

  if (typeof value === "object" && value !== null && lang in value) {
    return value[lang];
  }

  console.warn(`Language "${lang}" not found for path: ${path}`);
  return path;
}

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
 *
 * endDate가 미래인 경우 (예: 월간 리포트를 월 중에 생성),
 * 현재 시각까지만 경과 시간으로 분모를 계산하여
 * 아직 지나지 않은 시간이 분모에 포함되지 않도록 합니다.
 */
export async function calculateEquipmentUtilization(
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

// ==================== SHEET GENERATION FUNCTION ====================

/**
 * Generate comprehensive Equipment Performance Report Sheet
 * Single sheet with table format matching the specified layout
 */
export async function generateEquipmentPerformanceKPISheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  period?: "daily" | "weekly" | "monthly",
  lang?: string
): Promise<void> {
  loggerService.info("Generating Equipment Performance Report Sheet...");

  // Adjust date range based on period
  const adjustedDateRange = adjustDateRangeForPeriod(
    dateRange.startDate,
    dateRange.endDate,
    period
  );

  const worksheet = workbook.addWorksheet("Equipment Performance KPIs");

  // Configure page for A4 portrait
  worksheet.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3
    }
  };

  let currentRow = 1;
  const langCode = lang || "ko";

  // ===== TITLE SECTION =====
  // Row 1: Centered title "설비 보고서"
  worksheet.mergeCells(currentRow, 1, currentRow, 7); // Merge all 7 columns
  const titleCell = worksheet.getCell(currentRow, 1);
  titleCell.value = getTranslation("equipmentReport.title", langCode);
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = {
    horizontal: "center",
    vertical: "middle"
  };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2; // Skip one row for spacing

  // ===== HEADER SECTION =====
  // Row 2: Period (left) + Approval Box (right)
  // Period on left (columns A-D)
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const periodCell = worksheet.getCell(currentRow, 1);
  const periodText = `${getTranslation(
    "equipmentReport.period",
    langCode
  )}: ${formatDateKorean(adjustedDateRange.startDate)}${getTranslation(
    "equipmentReport.to",
    langCode
  )}${formatDateKorean(adjustedDateRange.endDate)}`;
  periodCell.value = periodText;
  periodCell.font = { size: 11, bold: true };
  periodCell.alignment = {
    horizontal: "left",
    vertical: "middle"
  };

  // Approval section (작성/검토/승인) - right side
  const approvalCols = [
    { col: 5, label: "approval.created" },
    { col: 6, label: "approval.reviewed" },
    { col: 7, label: "approval.approved" }
  ];

  approvalCols.forEach((col) => {
    const cell = worksheet.getCell(currentRow, col.col);
    cell.value = `${getTranslation(col.label, lang)}`;
    cell.font = { size: 14 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  worksheet.getRow(currentRow).height = 24;
  currentRow++;

  // Row 4: Blank Signature cells
  // Blank Signature cells
  approvalCols.forEach((col) => {
    worksheet.mergeCells(currentRow, col.col, currentRow + 3, col.col);
    const cell = worksheet.getCell(currentRow, col.col);
    cell.value = "";
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    // Date Row
    worksheet.mergeCells(currentRow + 4, col.col, currentRow + 4, col.col);
    const dateCell = worksheet.getCell(currentRow + 4, col.col);
    dateCell.value = formatDateKorean(new Date());
    dateCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    dateCell.font = { size: 14 };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(currentRow + 4).height = 24;
  });
  currentRow += 6;

  // Calculate all KPIs in parallel
  const [equipmentUtilization, equipmentErrorCount, equipmentProductionCount] =
    await Promise.all([
      calculateEquipmentUtilization(adjustedDateRange),
      calculateEquipmentErrorCount(adjustedDateRange),
      calculateEquipmentProductionCount(adjustedDateRange)
    ]);

  // Create a map to combine all device data
  const deviceMap = new Map<
    string,
    {
      deviceId: string;
      deviceName: string;
      deviceTypeName: string;
      utilization?: number;
      actualUptimeHours?: number;
      operationalHours?: number;
      downtime?: number; // Calculated: operationalHours - actualUptimeHours
      errorCount?: number;
      productionCount?: number;
    }
  >();

  // Combine utilization data
  equipmentUtilization.forEach((equipment) => {
    const downtime = equipment.operationalHours - equipment.actualUptimeHours;
    deviceMap.set(equipment.deviceId, {
      deviceId: equipment.deviceId,
      deviceName: equipment.deviceName,
      deviceTypeName: equipment.deviceTypeName,
      utilization: equipment.utilization,
      actualUptimeHours: equipment.actualUptimeHours,
      operationalHours: equipment.operationalHours,
      downtime: Math.max(0, downtime) // Ensure non-negative
    });
  });

  // Add error count data
  equipmentErrorCount.forEach((equipment) => {
    const existing = deviceMap.get(equipment.deviceId);
    if (existing) {
      existing.errorCount = equipment.errorCount;
    } else {
      deviceMap.set(equipment.deviceId, {
        deviceId: equipment.deviceId,
        deviceName: equipment.deviceName,
        deviceTypeName: equipment.deviceTypeName,
        errorCount: equipment.errorCount,
        downtime: 0
      });
    }
  });

  // Add production count data
  equipmentProductionCount.forEach((equipment) => {
    const existing = deviceMap.get(equipment.deviceId);
    if (existing) {
      existing.productionCount = equipment.productionCount;
    } else {
      deviceMap.set(equipment.deviceId, {
        deviceId: equipment.deviceId,
        deviceName: equipment.deviceName,
        deviceTypeName: equipment.deviceTypeName,
        productionCount: equipment.productionCount,
        downtime: 0
      });
    }
  });

  // Convert to array and sort by device name
  const devices = Array.from(deviceMap.values()).sort((a, b) =>
    (a.deviceName || "").localeCompare(b.deviceName || "")
  );

  // ===== TABLE SECTION =====
  // Table with 7 columns: 장비번호, 장비명, 가동 시간, 비가동 시간, 가동률, 에러발생횟수, 생산량

  // Table header row
  const tableHeaders = [
    getTranslation("equipmentReport.equipmentNo", langCode),
    getTranslation("equipmentReport.equipmentName", langCode),
    getTranslation("equipmentReport.operationTime", langCode),
    getTranslation("equipmentReport.downtime", langCode),
    getTranslation("equipmentReport.operationRate", langCode),
    getTranslation("equipmentReport.errorCount", langCode),
    getTranslation("equipmentReport.productionQuantity", langCode)
  ];

  tableHeaders.forEach((header, colIndex) => {
    const col = colIndex + 1; // Columns A-G (1-7)
    const headerCell = worksheet.getCell(currentRow, col);
    headerCell.value = header;
    headerCell.font = { bold: true, size: 11 };
    headerCell.alignment = {
      horizontal: "center",
      vertical: "middle"
    };
    headerCell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" }
    };
    headerCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    headerCell.font.color = { argb: ExcelFormatService.COLORS.HEADER_TEXT };
  });

  worksheet.getRow(currentRow).height = 25;
  currentRow++;

  // Table data rows
  devices.forEach((device) => {
    // Column 1: Equipment Name
    const nameCell = worksheet.getCell(currentRow, 1);
    nameCell.value = device.deviceName || "";
    nameCell.font = { size: 10 };
    nameCell.alignment = {
      horizontal: "left",
      vertical: "middle"
    };
    nameCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // Column 2: Equipment Type Name
    const typeNameCell = worksheet.getCell(currentRow, 2);
    typeNameCell.value = device.deviceTypeName || "";
    typeNameCell.font = { size: 10 };
    typeNameCell.alignment = {
      horizontal: "left",
      vertical: "middle"
    };
    typeNameCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // Column 3: Operation Time (가동 시간) - actualUptimeHours
    const operationTimeCell = worksheet.getCell(currentRow, 3);
    operationTimeCell.value =
      device.actualUptimeHours !== undefined
        ? device.actualUptimeHours.toFixed(2)
        : "0.00";
    operationTimeCell.font = { size: 10 };
    operationTimeCell.alignment = {
      horizontal: "center",
      vertical: "middle"
    };
    operationTimeCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // Column 4: Downtime (비가동 시간) - calculated
    const downtimeCell = worksheet.getCell(currentRow, 4);
    downtimeCell.value =
      device.downtime !== undefined ? device.downtime.toFixed(2) : "0.00";
    downtimeCell.font = { size: 10 };
    downtimeCell.alignment = {
      horizontal: "center",
      vertical: "middle"
    };
    downtimeCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // Column 5: Operation Rate (가동률) - utilization percentage
    const operationRateCell = worksheet.getCell(currentRow, 5);
    const utilization =
      device.utilization !== undefined ? device.utilization : 0;
    operationRateCell.value = utilization.toFixed(2) + "%";
    operationRateCell.font = { size: 10 };
    operationRateCell.alignment = {
      horizontal: "center",
      vertical: "middle"
    };
    operationRateCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // Apply conditional formatting for operation rate
    if (utilization >= 80) {
      operationRateCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.SUCCESS }
      };
      operationRateCell.font.color = { argb: "FFFFFF" };
      operationRateCell.font.bold = true;
    } else if (utilization >= 50) {
      operationRateCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.WARNING }
      };
      operationRateCell.font.bold = true;
    } else if (utilization > 0) {
      operationRateCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.DANGER }
      };
      operationRateCell.font.color = { argb: "FFFFFF" };
      operationRateCell.font.bold = true;
    }

    // Column 6: Error Count (에러발생횟수)
    const errorCountCell = worksheet.getCell(currentRow, 6);
    errorCountCell.value =
      device.errorCount !== undefined ? device.errorCount : 0;
    errorCountCell.font = { size: 10 };
    errorCountCell.alignment = {
      horizontal: "center",
      vertical: "middle"
    };
    errorCountCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // Apply red background if errors exist
    if (device.errorCount && device.errorCount > 0) {
      errorCountCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.DANGER }
      };
      errorCountCell.font.color = { argb: "FFFFFF" };
      errorCountCell.font.bold = true;
    }

    // Column 7: Production Quantity (생산량)
    const productionCell = worksheet.getCell(currentRow, 7);
    productionCell.value =
      device.productionCount !== undefined ? device.productionCount : 0;
    productionCell.font = { size: 10 };
    productionCell.alignment = {
      horizontal: "center",
      vertical: "middle"
    };
    productionCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    worksheet.getRow(currentRow).height = 20;
    currentRow++;
  });

  // Column widths optimized for 7 columns on A4 portrait
  worksheet.getColumn(1).width = 12; // Equipment No
  worksheet.getColumn(2).width = 18; // Equipment Name
  worksheet.getColumn(3).width = 14; // Operation Time
  worksheet.getColumn(4).width = 14; // Downtime
  worksheet.getColumn(5).width = 16; // Operation Rate
  worksheet.getColumn(6).width = 16; // Error Count
  worksheet.getColumn(7).width = 16; // Production Quantity

  loggerService.info(
    "✓ Equipment Performance Report Sheet generated successfully"
  );
}
