import * as ExcelFormatService from "@shared/services/excelFormatService";
import { formatDateKorean } from "@shared/services/excelFormatService";
import ExcelJS from "exceljs";
import { DateRangeFilter } from "../helpers/adjustDateRangeForPeriod";
import { getWorkerReportTranslation as getTranslation } from "./worker.translations";
import { aggregateWorkerPerformanceSummary } from "./worker.data-loaders";
import { formatTimeDuration } from "../helpers/formatTimeDuration";

export class WorkerSheetBuilder {
  /**
   * Generate Worker Performance Summary Sheet
   * New format: List of all workers with performance metrics
   */
  public static async generateWorkerPerformanceSummarySheet(
    workbook: ExcelJS.Workbook,
    dateRange: DateRangeFilter,
    lang: string = "ko"
  ): Promise<void> {
    console.log("Generating Worker Performance Summary Sheet...");

    const worksheet = workbook.addWorksheet("Worker Performance Summary");

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

    let currentRow = 1;

    // Get summary data for all workers
    const summaryData = await aggregateWorkerPerformanceSummary(dateRange);

    const periodText = `${formatDateKorean(
      dateRange.startDate
    )}~${formatDateKorean(dateRange.endDate)}`;

    // ===== TITLE ROW =====
    worksheet.mergeCells(currentRow, 1, currentRow, 9);
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = getTranslation("titles.workerPerformanceReport", lang);
    titleCell.font = { size: 18, bold: true };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(currentRow).height = 35;
    currentRow++;

    // ===== PERIOD AND SIGNATURE BLOCK ROW =====
    // Left side: Period
    worksheet.mergeCells(currentRow, 1, currentRow, 3);
    const periodCell = worksheet.getCell(currentRow, 1);
    periodCell.value = `${getTranslation(
      "workerKPI.period",
      lang
    )}: ${periodText}`;
    periodCell.font = { size: 11, bold: true };
    periodCell.alignment = {
      horizontal: "left",
      vertical: "middle",
      indent: 1
    };

    // Approval section (작성/검토/승인) - right side
    const approvalCols = [
      { col: 7, label: "workerKPI.prepared" },
      { col: 8, label: "workerKPI.reviewed" },
      { col: 9, label: "workerKPI.approved" }
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

    // ===== TABLE HEADERS =====
    const headers = [
      "순번", // Sequence
      "이름", // Name
      "소속", // Department
      "총 작업시간", // Total Work Hours
      "초과 근무시간", // Overtime
      "생산량", // Production Volume
      "불량 발생건 수", // Defect Count
      "작업 지연률", // Work Delay Rate
      "비고" // Remarks
    ];

    headers.forEach((header, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = header;
      cell.font = { bold: true, size: 11, color: { argb: "FFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    worksheet.getRow(currentRow).height = 25;
    currentRow++;

    // ===== DATA ROWS =====
    summaryData.forEach((worker, index) => {
      const row = [
        worker.sequence,
        worker.workerName,
        worker.department,
        formatTimeDuration(worker.totalWorkMinutes),
        formatTimeDuration(worker.overtimeMinutes),
        worker.productionVolume,
        worker.defectCount,
        `${worker.workDelayRate.toFixed(0)}%`,
        worker.remarks || ""
      ];

      row.forEach((val, idx) => {
        const cell = worksheet.getCell(currentRow, idx + 1);
        cell.value = val;
        cell.alignment = {
          horizontal:
            idx === 0 || idx === 4 || idx === 5 || idx === 6 || idx === 7
              ? "center"
              : "left",
          vertical: "middle"
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };

        // Alternating row colors
        if (index % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
          };
        }
      });

      worksheet.getRow(currentRow).height = 20;
      currentRow++;
    });

    // Column widths
    worksheet.getColumn(1).width = 8; // 순번
    worksheet.getColumn(2).width = 15; // 이름
    worksheet.getColumn(3).width = 15; // 소속
    worksheet.getColumn(4).width = 18; // 총 작업시간
    worksheet.getColumn(5).width = 18; // 초과 근무시간
    worksheet.getColumn(6).width = 12; // 생산량
    worksheet.getColumn(7).width = 15; // 불량 발생건 수
    worksheet.getColumn(8).width = 15; // 작업 지연률
    worksheet.getColumn(9).width = 15; // 비고

    console.log(
      `✓ Worker Performance Summary Sheet generated with ${summaryData.length} workers`
    );
  }
}
