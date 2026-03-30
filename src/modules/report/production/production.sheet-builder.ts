import * as ExcelFormatService from "@/shared/services/excelFormatService";
import { formatDateKorean } from "@/shared/services/excelFormatService";
import ExcelJS from "exceljs";
import { getProductionReportTranslation as getTranslation } from "../translations/production.translations";
import { ProductStatusData } from "./production.data-loaders";
import { formatTimeDuration } from "../helpers/formatTimeDuration";

export class ProductionSheetBuilder {
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
