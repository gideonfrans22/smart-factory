import ExcelJS from "exceljs";
import { Alert } from "../models/Alert";
import { Device } from "../models/Device";
import { Task } from "../models/Task";
import * as ExcelFormatService from "./excelFormatService";

/**
 * Equipment Performance Report Data Aggregation Service
 * Handles all data queries and calculations for equipment/device performance reports
 */

// ==================== TRANSLATIONS ====================

const TRANSLATIONS = {
  // Equipment KPI Report
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
 * Generate comprehensive Equipment Performance KPI Sheet
 * Single sheet containing all equipment KPI calculations in A4 portrait format
 */
export async function generateEquipmentPerformanceKPISheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  period?: "daily" | "weekly" | "monthly",
  lang?: string
): Promise<void> {
  console.log("Generating Equipment Performance KPI Sheet...");

  // Adjust date range based on period
  const adjustedDateRange = adjustDateRangeForPeriod(
    dateRange.startDate,
    dateRange.endDate,
    period
  );

  const worksheet = workbook.addWorksheet("Equipment Performance KPIs");

  // Configure page for A4 portrait and fit-to-width (7 columns max)
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

  const formatDate = (date: Date) => date.toISOString().split("T")[0];
  const periodLabel = period
    ? period.charAt(0).toUpperCase() + period.slice(1)
    : "All Time";

  // ===== COMPACT 7-COLUMN HEADER + APPROVAL BLOCK =====
  // Layout (7 columns A-G total):
  // Row 1: [A-C] REPORT_TITLE | [D-E] 관리자 (MANAGER) | [F-G] 대표 (CEO)
  // Row 2: [A-C] REPORT_PERIOD | [D-E] 작업자 (WORKER) | [F-G] blank

  // ===== ROW 1: Title + Manager + CEO =====
  worksheet.mergeCells(currentRow, 1, currentRow, 3); // A-C
  const titleCell = worksheet.getCell(currentRow, 1);
  titleCell.value = `${getTranslation(
    "equipmentKPI.title",
    lang
  )} - ${periodLabel}`;
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true
  };
  titleCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };

  // Manager approval (D-E)
  worksheet.mergeCells(currentRow, 4, currentRow, 5);
  const managerCell = worksheet.getCell(currentRow, 4);
  managerCell.value = `${getTranslation(
    "roles.manager",
    lang
  )}\n____년  __월  __일`;
  managerCell.font = { bold: true, size: 10 };
  managerCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
  };
  managerCell.alignment = {
    horizontal: "center",
    vertical: "top",
    wrapText: true
  };
  managerCell.border = {
    top: { style: "medium" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };

  // CEO approval (F-G)
  worksheet.mergeCells(currentRow, 6, currentRow, 7);
  const ceoCell = worksheet.getCell(currentRow, 6);
  ceoCell.value = `${getTranslation("roles.ceo", lang)}\n____년  __월  __일`;
  ceoCell.font = { bold: true, size: 10 };
  ceoCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
  };
  ceoCell.alignment = {
    horizontal: "center",
    vertical: "top",
    wrapText: true
  };
  ceoCell.border = {
    top: { style: "medium" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "medium" }
  };

  worksheet.getRow(currentRow).height = 100; // Tall for signature space
  currentRow++;

  // ===== ROW 2: Period + Worker =====
  worksheet.mergeCells(currentRow, 1, currentRow, 3); // A-C
  const periodCell = worksheet.getCell(currentRow, 1);
  periodCell.value = `${getTranslation(
    "equipmentKPI.period",
    lang
  )}: ${formatDate(adjustedDateRange.startDate)} ${getTranslation(
    "equipmentKPI.to",
    lang
  )} ${formatDate(adjustedDateRange.endDate)}`;
  periodCell.font = { size: 10, bold: true };
  periodCell.alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true
  };
  periodCell.border = {
    top: { style: "thin" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "thin" }
  };

  // Worker approval (D-E)
  worksheet.mergeCells(currentRow, 4, currentRow, 5);
  const workerCell = worksheet.getCell(currentRow, 4);
  workerCell.value = `${getTranslation(
    "roles.worker",
    lang
  )}\n____년  __월  __일`;
  workerCell.font = { bold: true, size: 10 };
  workerCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
  };
  workerCell.alignment = {
    horizontal: "center",
    vertical: "top",
    wrapText: true
  };
  workerCell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "medium" },
    right: { style: "thin" }
  };

  // Blank space (F-G)
  worksheet.mergeCells(currentRow, 6, currentRow, 7);
  const blankCell = worksheet.getCell(currentRow, 6);
  blankCell.value = "";
  blankCell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "medium" },
    right: { style: "medium" }
  };

  worksheet.getRow(currentRow).height = 100; // Tall for signature space
  currentRow += 2;

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
      errorCount?: number;
      productionCount?: number;
    }
  >();

  // Combine utilization data
  equipmentUtilization.forEach((equipment) => {
    deviceMap.set(equipment.deviceId, {
      deviceId: equipment.deviceId,
      deviceName: equipment.deviceName,
      deviceTypeName: equipment.deviceTypeName,
      utilization: equipment.utilization,
      actualUptimeHours: equipment.actualUptimeHours,
      operationalHours: equipment.operationalHours
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
        errorCount: equipment.errorCount
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
        productionCount: equipment.productionCount
      });
    }
  });

  // ===== KPI DATA SECTION - VERTICAL LABEL-VALUE FORMAT =====
  // Format: 4 columns for label (A-D), 3 columns for value (E-G)
  // KPI DATA HEADER
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const kpiHeaderCell = worksheet.getCell(currentRow, 1);
  kpiHeaderCell.value = getTranslation("titles.kpi", lang);
  kpiHeaderCell.font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
  kpiHeaderCell.alignment = { horizontal: "center", vertical: "top" };
  kpiHeaderCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" }
  };
  kpiHeaderCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  // KPI DATA HEADER VALUES
  worksheet.mergeCells(currentRow, 5, currentRow, 7);
  const kpiHeaderValuesCell = worksheet.getCell(currentRow, 5);
  kpiHeaderValuesCell.value = getTranslation("titles.kpiValue", lang);
  kpiHeaderValuesCell.font = {
    bold: true,
    size: 12,
    color: { argb: "FFFFFF" }
  };
  kpiHeaderValuesCell.alignment = {
    horizontal: "center",
    vertical: "top"
  };
  kpiHeaderValuesCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "medium" }
  };
  kpiHeaderValuesCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  worksheet.getRow(currentRow).height = 30;
  currentRow++;

  // Process each device
  const devices = Array.from(deviceMap.values()).sort((a, b) =>
    (b.deviceName || "").localeCompare(a.deviceName || "")
  );

  devices.forEach((device) => {
    // Device header row (optional - can be merged with first KPI)
    // For now, we'll add device info in the first KPI row

    // Build KPI rows for this device
    const kpiRows: Array<{
      label: string;
      value: string | number;
      type: "utilization" | "number" | "flag";
      flagValue?: number;
    }> = [];

    if (device.utilization !== undefined) {
      kpiRows.push({
        label: getTranslation("equipmentKPI.utilization", lang),
        value: device.utilization.toFixed(2) + "%",
        type: "utilization",
        flagValue: device.utilization
      });
    }

    if (device.actualUptimeHours !== undefined) {
      kpiRows.push({
        label: getTranslation("equipmentKPI.actualUptimeHours", lang),
        value: device.actualUptimeHours.toFixed(2),
        type: "number"
      });
    }

    if (device.operationalHours !== undefined) {
      kpiRows.push({
        label: getTranslation("equipmentKPI.operationalHours", lang),
        value: device.operationalHours.toFixed(2),
        type: "number"
      });
    }

    if (device.errorCount !== undefined) {
      kpiRows.push({
        label: getTranslation("equipmentKPI.errorCount", lang),
        value: device.errorCount,
        type: "flag",
        flagValue: device.errorCount
      });
    }

    if (device.productionCount !== undefined) {
      kpiRows.push({
        label: getTranslation("equipmentKPI.productionCount", lang),
        value: device.productionCount,
        type: "number"
      });
    }

    // Add device name and type as first row (merged with label)
    if (kpiRows.length > 0) {
      // Device info row
      worksheet.mergeCells(currentRow, 1, currentRow, 7);
      const deviceInfoCell = worksheet.getCell(currentRow, 1);
      deviceInfoCell.value = `${device.deviceTypeName} - ${device.deviceName}`;
      deviceInfoCell.font = { bold: true, size: 11 };
      deviceInfoCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "E0E0E0" }
      };
      deviceInfoCell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
        indent: 1
      };
      deviceInfoCell.border = {
        top: { style: "medium" },
        left: { style: "medium" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      worksheet.getRow(currentRow).height = 30;
      currentRow++;

      // KPI rows for this device
      kpiRows.forEach((kpiRow) => {
        // Label cells (A-D)
        worksheet.mergeCells(currentRow, 1, currentRow, 4);
        const labelCell = worksheet.getCell(currentRow, 1);
        labelCell.value = kpiRow.label;
        labelCell.font = { bold: true, size: 11 };
        labelCell.alignment = {
          horizontal: "left",
          vertical: "middle",
          indent: 1
        };
        labelCell.border = {
          top: { style: "thin" },
          left: { style: "medium" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };

        // Value cells (E-G)
        worksheet.mergeCells(currentRow, 5, currentRow, 7);
        const valueCell = worksheet.getCell(currentRow, 5);
        valueCell.value = kpiRow.value;
        valueCell.font = { size: 11 };
        valueCell.alignment = {
          horizontal: "center",
          vertical: "middle"
        };
        valueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "medium" }
        };

        // Apply conditional formatting
        if (kpiRow.type === "utilization" && kpiRow.flagValue !== undefined) {
          const utilization = kpiRow.flagValue;
          if (utilization >= 80) {
            valueCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: ExcelFormatService.COLORS.SUCCESS }
            };
            valueCell.font = {
              bold: true,
              color: { argb: "FFFFFF" },
              size: 11
            };
          } else if (utilization >= 50) {
            valueCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: ExcelFormatService.COLORS.WARNING }
            };
            valueCell.font = {
              bold: true,
              color: { argb: "000000" },
              size: 11
            };
          } else {
            valueCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: ExcelFormatService.COLORS.DANGER }
            };
            valueCell.font = {
              bold: true,
              color: { argb: "FFFFFF" },
              size: 11
            };
          }
        } else if (
          kpiRow.type === "flag" &&
          kpiRow.flagValue !== undefined &&
          kpiRow.flagValue > 0
        ) {
          // Red flag for errors
          valueCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ExcelFormatService.COLORS.DANGER }
          };
          valueCell.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
        }

        worksheet.getRow(currentRow).height = 25;
        currentRow++;
      });

      // Add spacing between devices
      currentRow++;
    }
  });

  // Column widths optimized for 7 columns on A4 portrait
  worksheet.getColumn(1).width = 12; // Label start
  worksheet.getColumn(2).width = 12; // Label middle
  worksheet.getColumn(3).width = 12; // Label middle
  worksheet.getColumn(4).width = 12; // Label end
  worksheet.getColumn(5).width = 12; // Value start
  worksheet.getColumn(6).width = 12; // Value middle
  worksheet.getColumn(7).width = 12; // Value end

  console.log("✓ Equipment Performance KPI Sheet generated successfully");
}
