import * as ExcelFormatService from "@/shared/services/excelFormatService";
import { formatDateKorean } from "@/shared/services/excelFormatService";
import ExcelJS from "exceljs";
import { getProductionReportTranslation as getTranslation } from "../translations/production.translations";
import {
  aggregateOverallKPIs,
  aggregateProductStatusData,
  ProductStatusData
} from "./production.data-loaders";
import { formatTimeDuration } from "../helpers/formatTimeDuration";
import {
  adjustDateRangeForPeriod,
  DateRangeFilter
} from "../helpers/adjustDateRangeForPeriod";

export class ProductionSheetBuilder {
  /**
   * Generate comprehensive Production Rate KPI Sheet (Productivity Report)
   * New format: Overall KPIs → Approval → Product Status → Part Details with Work Content
   */

  public static async generateProductionRateKPISheet(
    workbook: ExcelJS.Workbook,
    dateRange: DateRangeFilter,
    period?: "daily" | "weekly" | "monthly",
    lang?: string
  ): Promise<void> {
    console.log(
      "Generating Production Rate KPI Sheet (Productivity Report)..."
    );
    const langCode = lang || "ko";

    // Adjust date range based on period
    const adjustedDateRange = adjustDateRangeForPeriod(
      dateRange.startDate,
      dateRange.endDate,
      period
    );

    // Aggregate data for the new format
    const [overallKPIs, productStatusData] = await Promise.all([
      aggregateOverallKPIs(adjustedDateRange),
      aggregateProductStatusData(adjustedDateRange)
    ]);

    const worksheet = workbook.addWorksheet(
      getTranslation("productionReport.title", langCode) ||
        "Production Rate KPI"
    );

    // Configure page for A4 landscape
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

    worksheet.properties.defaultRowHeight = 24;

    let currentRow = 1;

    // ===== HEADER SECTION =====
    // Row 1: Title
    worksheet.mergeCells(currentRow, 1, currentRow, 17); // Title spans multiple columns
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = getTranslation("productionReport.title", langCode);
    titleCell.font = { size: 36, bold: true };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(currentRow).height = 58;
    currentRow += 2;

    // === DATE + Approval section (작성/검토/승인) ====
    // Row 3: Period (기준일시)
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const periodCell = worksheet.getCell(currentRow, 1);
    periodCell.value = `${getTranslation(
      "productionReport.referenceDateTime",
      langCode
    )}: ${formatDateKorean(adjustedDateRange.startDate)}~${formatDateKorean(
      adjustedDateRange.endDate
    )}`;
    periodCell.font = { size: 14 };
    periodCell.alignment = { horizontal: "left", vertical: "middle" };

    // Approval section (작성/검토/승인) - right side
    const approvalCols = [
      { col: 15, label: "productionReport.prepared" },
      { col: 16, label: "productionReport.reviewed" },
      { col: 17, label: "productionReport.approved" }
    ];

    approvalCols.forEach((col) => {
      const cell = worksheet.getCell(currentRow, col.col);
      cell.value = `${getTranslation(col.label, langCode)}`;
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
      worksheet.mergeCells(currentRow, col.col, currentRow + 4, col.col);
      const cell = worksheet.getCell(currentRow, col.col);
      cell.value = "";
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
      // Date Row
      worksheet.mergeCells(currentRow + 5, col.col, currentRow + 5, col.col);
      const dateCell = worksheet.getCell(currentRow + 5, col.col);
      dateCell.value = formatDateKorean(new Date());
      dateCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
      dateCell.font = { size: 14 };
      dateCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(currentRow + 5).height = 24;
    });
    currentRow++;

    // Row 5: Overall KPIs
    // Section header
    worksheet.mergeCells(currentRow, 1, currentRow, 3);
    const kpiHeaderCell = worksheet.getCell(currentRow, 1);
    kpiHeaderCell.value = getTranslation(
      "productionReport.overallKPIs",
      langCode
    );
    kpiHeaderCell.font = { bold: true, size: 12 };
    kpiHeaderCell.alignment = { horizontal: "left", vertical: "middle" };
    currentRow++;

    // Row 6: KPI Columns
    // KPI Columns: Label | Value format
    const kpiColumns = [
      {
        label: "productionReport.totalProductProduction",
        value: overallKPIs.totalProductProduction,
        startCol: 1,
        endCol: 3
      },
      {
        label: "productionReport.totalPartProduction",
        value: overallKPIs.totalPartProduction,
        startCol: 4,
        endCol: 5
      },
      {
        label: "productionReport.overallDeliveryComplianceRate",
        value: `${overallKPIs.overallDeliveryComplianceRate.toFixed(0)}%`,
        startCol: 6,
        endCol: 7
      },
      {
        label: "productionReport.totalWorkers",
        value: overallKPIs.totalWorkers,
        startCol: 8,
        endCol: 9
      }
    ];

    kpiColumns.forEach((kpi) => {
      // Label Row
      worksheet.mergeCells(currentRow, kpi.startCol, currentRow, kpi.endCol);
      const labelCell = worksheet.getCell(currentRow, kpi.startCol);
      labelCell.value = getTranslation(kpi.label, langCode);
      labelCell.font = { size: 12, bold: true };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
      };
      labelCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Value Row
      worksheet.mergeCells(
        currentRow + 1,
        kpi.startCol,
        currentRow + 2,
        kpi.endCol
      );
      const valueCell = worksheet.getCell(currentRow + 1, kpi.startCol);
      valueCell.value = kpi.value;
      valueCell.font = { size: 12 };
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    currentRow += 4;

    // Row 10
    // ===== SECTION 2: Product Status (제품별 현황) =====
    // Section header
    worksheet.mergeCells(currentRow, 1, currentRow, 4);
    const productStatusHeader = worksheet.getCell(currentRow, 1);
    productStatusHeader.value = getTranslation(
      "productionReport.productStatus",
      langCode
    );
    productStatusHeader.font = { bold: true, size: 12 };
    productStatusHeader.alignment = { horizontal: "left", vertical: "middle" };
    currentRow++;

    // Product data rows
    for (
      let productIndex = 0;
      productIndex < productStatusData.length;
      productIndex++
    ) {
      const productData = productStatusData[productIndex];
      currentRow = ProductionSheetBuilder.formatProductStatusDataToExcelJsTable(
        productData,
        productIndex,
        worksheet,
        langCode,
        currentRow
      );
    }

    // Set column widths optimized for the new format
    worksheet.getColumn(1).width = 4.5; // Product info / Part name
    worksheet.getColumn(2).width = 4.5; // Instruction No / Drawing No
    worksheet.getColumn(3).width = 21; // Design No / Part name
    worksheet.getColumn(4).width = 12; // Customer
    worksheet.getColumn(5).width = 12; // Department
    worksheet.getColumn(6).width = 9.5; // Person in Charge
    worksheet.getColumn(7).width = 12; // Order Date
    worksheet.getColumn(8).width = 12; // Delivery Date
    worksheet.getColumn(9).width = 10; // Quantity
    worksheet.getColumn(10).width = 12; // Production Quantity
    worksheet.getColumn(11).width = 12; // Remaining Quantity
    worksheet.getColumn(12).width = 12; // Completion Rate
    worksheet.getColumn(13).width = 15; // Work Time
    worksheet.getColumn(14).width = 12; // Delivery Delays
    worksheet.getColumn(15).width = 15; // Delivery Compliance Rate
    worksheet.getColumn(16).width = 15; // Work details columns start here
    worksheet.getColumn(17).width = 15; // Work details columns start here

    console.log(
      "✓ Production Rate KPI Sheet (Productivity Report) generated successfully"
    );
  }
  /**
   * Format Project Data to ExcelJs Table
   * @param projectData Project Data
   * @param worksheet ExcelJS Worksheet
   * @param lang Language
   * @param currentRow Current Row
   * @returns number of rows formatted
   */
  public static formatProjectDataToExcelJsTable(
    projectData: ProductStatusData["projects"],
    worksheet: ExcelJS.Worksheet,
    langCode: string,
    currentRow: number
  ): number {
    const initialRow = currentRow;

    for (const project of projectData) {
      let colNum = 4;
      const formattedProjectData = [
        project.instructionNo,
        project.designNumber,
        project.customerName,
        project.personInCharge,
        project.department,
        project.orderDate ? formatDateKorean(project.orderDate) : "",
        project.deliveryDate ? formatDateKorean(project.deliveryDate) : "",
        project.quantity,
        project.productionQuantity,
        project.remainingQuantity,
        project.completionRate,
        formatTimeDuration(project.workTime, langCode),
        project.deliveryDelays,
        project.deliveryComplianceRate || 0
      ];
      formattedProjectData.forEach((data, idx) => {
        const cell = worksheet.getCell(currentRow, colNum + idx);
        cell.value = data;
        cell.font = { size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      });
      worksheet.getRow(currentRow).height = 20;
      currentRow++;
    }
    return initialRow + projectData.length;
  }

  /**  Format Product Status Data to ExcelJs Table
   * @param productStatusData Product Status Data
   * @param worksheet ExcelJS Worksheet
   * @param lang Language
   * @param currentRow Current Row
   * @returns number of rows formatted
   */
  public static formatProductStatusDataToExcelJsTable(
    productData: ProductStatusData,
    productIndex: number,
    worksheet: ExcelJS.Worksheet,
    lang: string,
    currentRow: number
  ): number {
    const initialRow = currentRow;
    const langCode = lang || "ko";

    // Product Status table headers
    const productHeaders = [
      getTranslation("productionReport.no", langCode),
      getTranslation("productionReport.productInfo", langCode),
      getTranslation("productionReport.instructionNo", langCode),
      getTranslation("productionReport.designNo", langCode),
      getTranslation("productionReport.customer", langCode),
      getTranslation("productionReport.department", langCode),
      getTranslation("productionReport.personInCharge", langCode),
      getTranslation("productionReport.orderDate", langCode),
      getTranslation("productionReport.deliveryDate", langCode),
      getTranslation("productionReport.quantity", langCode),
      getTranslation("productionReport.productionQuantity", langCode),
      getTranslation("productionReport.remainingQuantity", langCode),
      getTranslation("productionReport.completionRate", langCode),
      getTranslation("productionReport.workTime", langCode),
      getTranslation("productionReport.deliveryDelays", langCode),
      getTranslation("productionReport.deliveryComplianceRate", langCode)
    ];

    productHeaders.forEach((header, idx) => {
      let colNum = idx + 1;
      if (idx === 1) {
        worksheet.mergeCells(currentRow, colNum, currentRow, colNum + 1);
      } else if (idx > 1) {
        colNum += 1;
      }
      const cell = worksheet.getCell(currentRow, colNum);
      cell.value = header;
      cell.font = { bold: true, size: 9 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    worksheet.getRow(currentRow).height = 40;
    currentRow++;

    // Product Number Colomn (1 column)
    // Row Height: Product Number + Project + Part
    const productNumberRowHeight =
      productData.projects.length +
      1 +
      productData.parts.reduce(
        (sum, p) =>
          sum + (Math.max(...p.steps.map((s) => s.workDetails.length)) || 1),
        0
      );
    worksheet.mergeCells(currentRow, 1, currentRow + productNumberRowHeight, 1);
    const productNumberCell = worksheet.getCell(currentRow, 1);
    productNumberCell.value = productIndex + 1;
    productNumberCell.font = { size: 10 };
    productNumberCell.alignment = { horizontal: "center", vertical: "middle" };
    productNumberCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
    productNumberCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // Product Info Colomn (2 columns)
    const projectCount = productData.projects.length - 1;
    worksheet.mergeCells(currentRow, 2, currentRow + projectCount, 3);
    const productInfo = worksheet.getCell(currentRow, 2);
    productInfo.value = productData.product.name || "";
    productInfo.font = { size: 10 };
    productInfo.alignment = { horizontal: "center", vertical: "middle" };
    productInfo.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // project data rows (projectCount rows)
    // From column 4 to column 17
    currentRow = ProductionSheetBuilder.formatProjectDataToExcelJsTable(
      productData.projects,
      worksheet,
      langCode,
      currentRow
    );

    // part data rows (partCount rows)
    // Part Status Table Headers (from column 2 to column 8)
    const partHeaders = [
      getTranslation("productionReport.drawingNo", langCode),
      getTranslation("productionReport.partName", langCode),
      getTranslation("productionReport.quantity", langCode),
      getTranslation("productionReport.productionQuantity", langCode),
      getTranslation("productionReport.remainingQuantity", langCode),
      getTranslation("productionReport.completionRate", langCode),
      getTranslation("productionReport.totalWorkTime", langCode)
    ];
    partHeaders.forEach((header, idx) => {
      let colNum = idx + 2;
      worksheet.mergeCells(currentRow, colNum, currentRow + 1, colNum);
      const cell = worksheet.getCell(currentRow, colNum);
      cell.value = header;
      cell.font = { bold: true, size: 9 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    // Part Worker Table Headers
    // From Column 9 Until the last step
    // Each step has 4 columns: Device Type Name, Worker, Work Quantity, Work Time
    const maxStepCount = Math.max(
      ...productData.parts.map((p) => p.steps.length)
    );
    const lastStepCol = 9 + maxStepCount * 4 - 1;
    worksheet.mergeCells(currentRow, 9, currentRow, lastStepCol);
    const workDetails = worksheet.getCell(currentRow, 9);
    workDetails.value = getTranslation(
      "productionReport.workDetails",
      langCode
    );
    workDetails.font = { bold: true, size: 9 };
    workDetails.alignment = { horizontal: "center", vertical: "middle" };
    workDetails.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
    workDetails.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    currentRow++;

    const partWorkerHeaders = [
      getTranslation("productionReport.deviceTypeName", langCode),
      getTranslation("productionReport.worker", langCode),
      getTranslation("productionReport.workQuantity", langCode),
      getTranslation("productionReport.workTime", langCode)
    ];

    for (let i = 0; i < maxStepCount; i++) {
      partWorkerHeaders.forEach((header, idx) => {
        let colNum = 9 + i * 4 + idx;
        const cell = worksheet.getCell(currentRow, colNum);
        cell.value = header;
        cell.font = { bold: true, size: 9 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      });
    }
    worksheet.getRow(currentRow).height = 20;
    currentRow++;

    // Part Worker Data Rows
    for (const part of productData.parts) {
      // Part Row Height = Max(Part Step's Worker Count) default 1
      const partRowHeight =
        Math.max(...part.steps.map((s) => s.workDetails.length)) || 1;
      // Part Info Columns
      const partInfo = [
        part.dwgNo,
        part.partName,
        part.quantity,
        part.productionQuantity,
        part.remainingQuantity,
        part.completionRate,
        formatTimeDuration(part.totalWorkTime, langCode)
      ];
      partInfo.forEach((info, idx) => {
        if (partRowHeight > 1) {
          worksheet.mergeCells(
            currentRow,
            idx + 2,
            currentRow + partRowHeight - 1,
            idx + 2
          );
        }
        const cell = worksheet.getCell(currentRow, idx + 2);
        cell.value = info;
        cell.font = { size: 9 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (idx === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
          };
        }
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      });
      let stepCount = 0;
      for (const step of part.steps) {
        const stepStartCol = 9 + stepCount * 4;
        // Step Device Type Name Column Same for all workers in the step
        worksheet.mergeCells(
          currentRow,
          stepStartCol,
          currentRow + (step.workDetails.length || 1) - 1,
          stepStartCol
        );
        const deviceTypeNameCell = worksheet.getCell(currentRow, stepStartCol);
        deviceTypeNameCell.value = step.deviceTypeName;
        deviceTypeNameCell.font = { size: 9 };
        deviceTypeNameCell.alignment = {
          horizontal: "center",
          vertical: "middle"
        };
        deviceTypeNameCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };

        let workerCount = 0;
        for (const worker of step.workDetails) {
          // Worker Info Columns (From Column 9 to Column 17)
          const workerInfo = [
            worker.worker,
            worker.workQuantity,
            formatTimeDuration(worker.workTime, langCode)
          ];
          workerInfo.forEach((info, idx) => {
            const cell = worksheet.getCell(
              currentRow + workerCount,
              stepStartCol + idx + 1
            );
            cell.value = info;
            cell.font = { size: 9 };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" }
            };
          });
          workerCount++;
        }
        stepCount++;
      }
      worksheet.getRow(currentRow).height = 24;
      currentRow += partRowHeight;
    }

    return initialRow + productNumberRowHeight + 2;
  }
}
