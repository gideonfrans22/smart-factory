import * as ExcelFormatService from "@/shared/services/excelFormatService";
import {
  formatDateKorean,
  formatDateMM
} from "@/shared/services/excelFormatService";
import ExcelJS from "exceljs";
import {
  getCustomerOrderRanking,
  getDeliveryStatusData,
  getEquipmentUsageRanking,
  getEquipmentUtilizationData,
  getErrorFrequencyData,
  getPartWorkloadRanking,
  getProductionStatusData,
  getProductWorkloadRanking,
  getWorkerStatusData
} from "./summary.data-loaders";
import { getSummaryReportTranslation as getTranslation } from "./summary.translations";
import { DateRangeFilter } from "../helpers/adjustDateRangeForPeriod";

export class SummarySheetBuilder {
  /**
   * Summary Report Service
   * Generates comprehensive production/manufacturing status summary report
   */
  public static async generateSummaryReportSheet(
    workbook: ExcelJS.Workbook,
    dateRange: DateRangeFilter,
    lang?: string
  ): Promise<void> {
    const langCode = lang || "en";
    const worksheet = workbook.addWorksheet("Summary Report");

    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: "landscape",
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

    // Get all data
    const productionStatus = await getProductionStatusData(dateRange);
    const deliveryStatus = await getDeliveryStatusData(dateRange);
    const equipmentUtilization = await getEquipmentUtilizationData();
    const errorFrequencies = await getErrorFrequencyData(dateRange);
    const workerStatus = await getWorkerStatusData(dateRange);
    const productWorkload = await getProductWorkloadRanking(dateRange);
    const partWorkload = await getPartWorkloadRanking(dateRange);
    const customerOrders = await getCustomerOrderRanking(dateRange);
    const equipmentUsage = await getEquipmentUsageRanking(dateRange);

    // ===== HEADER SECTION =====
    // Title
    worksheet.mergeCells(currentRow, 1, currentRow, 10);
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = getTranslation("summaryReport.title", langCode);
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(currentRow).height = 30;
    currentRow += 2;

    // Reference Date/Time - left side
    worksheet.mergeCells(currentRow, 1, currentRow, 3);
    const refDateCell = worksheet.getCell(currentRow, 1);
    refDateCell.value = `${getTranslation(
      "summaryReport.referenceDateTime",
      langCode
    )}: ${formatDateKorean(dateRange.startDate)} 00:00~23:59`;
    refDateCell.font = { size: 11 };

    // Approval section (작성/검토/승인) - right side
    const approvalCols = [
      { col: 6, label: "summaryReport.prepared" },
      { col: 7, label: "summaryReport.reviewed" },
      { col: 8, label: "summaryReport.approved" }
    ];

    approvalCols.forEach((col) => {
      const cell = worksheet.getCell(currentRow, col.col);
      cell.value = `${getTranslation(col.label, langCode)}`;
      cell.font = { size: 12 };
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

    // Report Generation Date - left side
    worksheet.mergeCells(currentRow, 1, currentRow, 3);
    const genDateCell = worksheet.getCell(currentRow, 1);
    const today = new Date();
    genDateCell.value = `${getTranslation(
      "summaryReport.reportGenerationDate",
      langCode
    )}: ${formatDateKorean(today)}`;
    genDateCell.font = { size: 11 };

    // Blank Signature cells - right side
    approvalCols.forEach((col) => {
      worksheet.mergeCells(currentRow, col.col, currentRow + 2, col.col);
      const cell = worksheet.getCell(currentRow, col.col);
      cell.value = "";
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
      // Date Row
      worksheet.mergeCells(currentRow + 3, col.col, currentRow + 3, col.col);
      const dateCell = worksheet.getCell(currentRow + 3, col.col);
      dateCell.value = formatDateKorean(new Date());
      dateCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
      dateCell.font = { size: 12 };
      dateCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(currentRow + 3).height = 24;
    });
    currentRow += 5;

    // ===== PRODUCTION STATUS SECTIONS =====
    // Daily Production Status - left side
    worksheet.mergeCells(currentRow, 1, currentRow, 2);
    const dailyHeader = worksheet.getCell(currentRow, 1);
    dailyHeader.value = getTranslation(
      "summaryReport.dailyProductionStatus",
      langCode
    );
    dailyHeader.font = { size: 12, bold: true };
    dailyHeader.alignment = { horizontal: "center", vertical: "middle" };
    dailyHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    dailyHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };

    // Weekly Production Status - center side
    worksheet.mergeCells(currentRow, 3, currentRow, 4);
    const weeklyHeader = worksheet.getCell(currentRow, 3);
    weeklyHeader.value = getTranslation(
      "summaryReport.weeklyProductionStatus",
      langCode
    );
    weeklyHeader.font = { size: 12, bold: true };
    weeklyHeader.alignment = { horizontal: "center", vertical: "middle" };
    weeklyHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    weeklyHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };

    // Monthly Production Status - right side
    worksheet.mergeCells(currentRow, 5, currentRow, 8);
    const monthlyHeader = worksheet.getCell(currentRow, 5);
    monthlyHeader.value = getTranslation(
      "summaryReport.monthlyProductionStatus",
      langCode
    );
    monthlyHeader.font = { size: 12, bold: true };
    monthlyHeader.alignment = { horizontal: "center", vertical: "middle" };
    monthlyHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    monthlyHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
    currentRow++;

    // Daily Production Status - headers - left side
    const dailyRows = [
      {
        label: getTranslation("summaryReport.progressRate", langCode),
        value: `${productionStatus.daily.progressRate}%`
      },
      {
        label: getTranslation("summaryReport.totalWorkCount", langCode),
        value: productionStatus.daily.totalWorkCount
      },
      {
        label: getTranslation("summaryReport.completedWorkCount", langCode),
        value: productionStatus.daily.completedWorkCount
      }
    ];
    dailyRows.forEach((row, idx) => {
      const labelCell = worksheet.getCell(currentRow + idx, 1);
      labelCell.value = row.label;
      labelCell.font = { size: 11 };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      const valueCell = worksheet.getCell(currentRow + idx, 2);
      valueCell.value = row.value;
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    // Weekly Production Status - headers - center side
    const weeklyRows = [
      {
        label: getTranslation("summaryReport.progressRate", langCode),
        value: `${productionStatus.weekly.progressRate}%`
      },
      {
        label: getTranslation("summaryReport.totalWorkCount", langCode),
        value: productionStatus.weekly.totalWorkCount
      },
      {
        label: getTranslation("summaryReport.completedWorkCount", langCode),
        value: productionStatus.weekly.completedWorkCount
      }
    ];
    weeklyRows.forEach((row, idx) => {
      const labelCell = worksheet.getCell(currentRow + idx, 3);
      labelCell.value = row.label;
      labelCell.font = { size: 11 };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      const valueCell = worksheet.getCell(currentRow + idx, 4);
      valueCell.value = row.value;
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    // Monthly Production Status - headers - right side
    const monthlyRows = [
      {
        label: getTranslation("summaryReport.month", langCode),
        value: productionStatus.monthly.map((month) =>
          formatDateMM(month.month, langCode)
        )
      },
      {
        label: getTranslation("summaryReport.progressRate", langCode),
        value: productionStatus.monthly.map((month) => `${month.progressRate}%`)
      },
      {
        label: getTranslation("summaryReport.totalWorkCount", langCode),
        value: productionStatus.monthly.map((month) => month.totalWorkCount)
      },
      {
        label: getTranslation("summaryReport.completedWorkCount", langCode),
        value: productionStatus.monthly.map((month) => month.completedWorkCount)
      }
    ];
    monthlyRows.forEach((row, idx) => {
      const labelCell = worksheet.getCell(currentRow + idx, 5);
      labelCell.value = row.label;
      labelCell.font = { size: 11 };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      row.value.forEach((value, valueIdx) => {
        const valueCell = worksheet.getCell(currentRow + idx, 6 + valueIdx);
        valueCell.value = value;
        valueCell.alignment = { horizontal: "center", vertical: "middle" };
        valueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      });
    });

    currentRow += 5;

    // DELIVERY STATUS - headers - left side
    worksheet.mergeCells(currentRow, 1, currentRow, 2);
    const deliveryHeader = worksheet.getCell(currentRow, 1);
    deliveryHeader.value = getTranslation(
      "summaryReport.deliveryDateBasedStatus",
      langCode
    );
    deliveryHeader.font = { size: 12, bold: true };
    deliveryHeader.alignment = { horizontal: "center", vertical: "middle" };
    deliveryHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    deliveryHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };

    // EQUIPMENT UTILIZATION - headers - center side
    worksheet.mergeCells(currentRow, 3, currentRow, 4);
    const equipmentHeader = worksheet.getCell(currentRow, 3);
    equipmentHeader.value = getTranslation(
      "summaryReport.equipmentUtilizationRate",
      langCode
    );
    equipmentHeader.font = { size: 12, bold: true };
    equipmentHeader.alignment = { horizontal: "center", vertical: "middle" };
    equipmentHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    equipmentHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };

    // ERROR FREQUENCIES - headers - center right side
    worksheet.mergeCells(currentRow, 5, currentRow, 6);
    const errorHeader = worksheet.getCell(currentRow, 5);
    errorHeader.value = getTranslation(
      "summaryReport.topErrorFrequencies",
      langCode
    );
    errorHeader.font = { size: 12, bold: true };
    errorHeader.alignment = { horizontal: "center", vertical: "middle" };
    errorHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    errorHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };

    // WORKER STATUS - headers - right side
    worksheet.mergeCells(currentRow, 7, currentRow, 8);
    const workerHeader = worksheet.getCell(currentRow, 7);
    workerHeader.value = getTranslation("summaryReport.workerStatus", langCode);
    workerHeader.font = { size: 12, bold: true };
    workerHeader.alignment = { horizontal: "center", vertical: "middle" };
    workerHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    workerHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
    currentRow++;

    // DELIVERY STATUS - values - left side
    const deliveryRows = [
      {
        label: getTranslation("summaryReport.delayedDeliveries", langCode),
        value: deliveryStatus.delayed
      },
      {
        label: getTranslation("summaryReport.imminentDeliveries", langCode),
        value: deliveryStatus.imminent
      },
      {
        label: getTranslation("summaryReport.onTimeDeliveries", langCode),
        value: deliveryStatus.onTime
      }
    ];
    deliveryRows.forEach((row, idx) => {
      const cell = worksheet.getCell(currentRow + idx, 1);
      cell.value = row.label;
      cell.font = { size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      const valueCell = worksheet.getCell(currentRow + idx, 2);
      valueCell.value = row.value;
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    const equipmentRows = [
      {
        label: getTranslation(
          "summaryReport.equipmentUtilizationRate",
          langCode
        ),
        value: `${equipmentUtilization.utilizationRate}%`
      },
      {
        label: getTranslation(
          "summaryReport.operatingEquipmentCount",
          langCode
        ),
        value: equipmentUtilization.operatingCount
      },
      {
        label: getTranslation("summaryReport.totalEquipmentCount", langCode),
        value: equipmentUtilization.totalCount
      }
    ];
    equipmentRows.forEach((row, idx) => {
      if (idx === 0) {
        worksheet.mergeCells(currentRow + idx, 3, currentRow + idx, 4);
        const valueCell = worksheet.getCell(currentRow + idx, 3);
        valueCell.value = row.value;
        valueCell.font = { size: 11 };
        valueCell.alignment = { horizontal: "center", vertical: "middle" };
        valueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      } else {
        const cell = worksheet.getCell(currentRow + idx, 3);
        cell.value = row.label;
        cell.font = { size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };

        const valueCell = worksheet.getCell(currentRow + idx, 4);
        valueCell.value = row.value;
        valueCell.alignment = { horizontal: "center", vertical: "middle" };
        valueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      }
    });

    const errorRows = errorFrequencies.map((error) => ({
      label: error.type,
      value: [error.count, `${error.percentage}%`]
    }));
    errorRows.forEach((row, idx) => {
      worksheet.mergeCells(currentRow + idx, 5, currentRow + idx, 6);
      const cell = worksheet.getCell(currentRow + idx, 5);
      cell.value = `${row.label} ${row.value[1]}`;
      cell.font = { size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    const workerRows = [
      {
        label: getTranslation("summaryReport.overallStatus", langCode),
        value: `${workerStatus.overallStatus}%`
      },
      {
        label: getTranslation("summaryReport.workersInProgress", langCode),
        value: workerStatus.workersInProgress
      },
      {
        label: getTranslation("summaryReport.totalWorkers", langCode),
        value: workerStatus.totalWorkers
      }
    ];
    workerRows.forEach((row, idx) => {
      if (idx === 0) {
        worksheet.mergeCells(currentRow + idx, 7, currentRow + idx, 8);
        const valueCell = worksheet.getCell(currentRow + idx, 7);
        valueCell.value = row.value;
        valueCell.font = { size: 11 };
        valueCell.alignment = { horizontal: "center", vertical: "middle" };
        valueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      } else {
        const cell = worksheet.getCell(currentRow + idx, 7);
        cell.value = row.label;
        cell.font = { size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };

        const valueCell = worksheet.getCell(currentRow + idx, 8);
        valueCell.value = row.value;
        valueCell.font = { size: 11 };
        valueCell.alignment = { horizontal: "center", vertical: "middle" };
        valueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      }
    });

    currentRow +=
      Math.max(
        deliveryRows.length,
        equipmentRows.length,
        errorRows.length,
        workerRows.length
      ) + 1;

    // ===== RANKINGS =====
    // Top 10 Product Workload - headers - left side
    worksheet.mergeCells(currentRow, 1, currentRow, 2);
    const productRankHeader = worksheet.getCell(currentRow, 1);
    productRankHeader.value = getTranslation(
      "summaryReport.top10ProductWorkload",
      langCode
    );
    productRankHeader.font = { size: 12, bold: true };
    productRankHeader.alignment = { horizontal: "center", vertical: "middle" };
    productRankHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    productRankHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };

    // Top 10 Part Workload - headers - center left side
    worksheet.mergeCells(currentRow, 3, currentRow, 4);
    const partRankHeader = worksheet.getCell(currentRow, 3);
    partRankHeader.value = getTranslation(
      "summaryReport.top10PartWorkload",
      langCode
    );
    partRankHeader.font = { size: 12, bold: true };
    partRankHeader.alignment = { horizontal: "center", vertical: "middle" };
    partRankHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    partRankHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };

    // Top 10 Customer Order Count - headers - center right side
    worksheet.mergeCells(currentRow, 5, currentRow, 6);
    const customerRankHeader = worksheet.getCell(currentRow, 5);
    customerRankHeader.value = getTranslation(
      "summaryReport.top10CustomerOrderCount",
      langCode
    );
    customerRankHeader.font = { size: 12, bold: true };
    customerRankHeader.alignment = { horizontal: "center", vertical: "middle" };
    customerRankHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    customerRankHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };

    // Top 10 Equipment Usage - headers - right side
    worksheet.mergeCells(currentRow, 7, currentRow, 8);
    const equipmentRankHeader = worksheet.getCell(currentRow, 7);
    equipmentRankHeader.value = getTranslation(
      "summaryReport.top10EquipmentUsage",
      langCode
    );
    equipmentRankHeader.font = { size: 12, bold: true };
    equipmentRankHeader.alignment = {
      horizontal: "center",
      vertical: "middle"
    };
    equipmentRankHeader.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    equipmentRankHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
    currentRow++;

    // Top 10 values arrays
    const rankRows = [
      { values: productWorkload.map((item) => item.name) },
      { values: productWorkload.map((item) => item.value) },

      { values: partWorkload.map((item) => item.name) },
      { values: partWorkload.map((item) => item.value) },

      { values: customerOrders.map((item) => item.name) },
      { values: customerOrders.map((item) => item.value) },

      { values: equipmentUsage.map((item) => item.name) },
      { values: equipmentUsage.map((item) => item.unit || item.value) }
    ];
    rankRows.forEach((row, idx) => {
      row.values.forEach((value, valueIdx) => {
        const cell = worksheet.getCell(currentRow + valueIdx, idx + 1);
        cell.value = value;
        cell.font = { size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      });
    });

    // Set column widths
    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 20;
    worksheet.getColumn(3).width = 20;
    worksheet.getColumn(4).width = 20;
    worksheet.getColumn(5).width = 14;
    worksheet.getColumn(6).width = 14;
    worksheet.getColumn(7).width = 14;
    worksheet.getColumn(8).width = 14;

    console.log("✓ Summary Report Sheet generated successfully");
  }
}
