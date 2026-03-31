import { loggerService } from "@shared/services";
import * as ExcelFormatService from "@shared/services/excelFormatService";
import { formatDateKorean } from "@shared/services/excelFormatService";
import ExcelJS from "exceljs";
import {
  aggregateEquipmentErrorCount,
  aggregateEquipmentProductionCount,
  aggregateEquipmentUtilization
} from "./equipment.data-loaders";
import {
  DateRangeFilter,
  adjustDateRangeForPeriod
} from "../helpers/adjustDateRangeForPeriod";
import { getEquipmentReportTranslation as getTranslation } from "./equipment.translations";

// ==================== SHEET GENERATION FUNCTION ====================
export class EquipmentSheetBuilder {
  /**
   * Generate comprehensive Equipment Performance Report Sheet
   * Single sheet with table format matching the specified layout
   */
  public static async buildPerformanceSummary(
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
    const [
      equipmentUtilization,
      equipmentErrorCount,
      equipmentProductionCount
    ] = await Promise.all([
      aggregateEquipmentUtilization(adjustedDateRange),
      aggregateEquipmentErrorCount(adjustedDateRange),
      aggregateEquipmentProductionCount(adjustedDateRange)
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
}
