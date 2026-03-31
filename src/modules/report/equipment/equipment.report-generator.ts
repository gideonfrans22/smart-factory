import { ReportGenerationResult } from "../report.generation.service";
import { loggerService } from "@/shared/services";
import ExcelJS from "exceljs";
import { generateReportFileName } from "../helpers/generateReportFileName";
import { saveWorkbook } from "../helpers/saveWorkbook";
import { Report } from "@/modules/report";
import { EquipmentSheetBuilder } from "./equipment.sheet-builder";
import { getEquipmentReportTranslation } from "./equipment.translations";

export class EquipmentReportGenerator {
  public static async generateReport(
    startDate: Date,
    endDate: Date,
    _userId: string,
    reportId?: string,
    lang: "en" | "ko" = "ko",
    period?: "daily" | "weekly" | "monthly"
  ): Promise<ReportGenerationResult> {
    const startTime = Date.now();

    try {
      loggerService.info(
        `[EquipmentReport] Starting generation for date range: ${startDate.toISOString()} to ${endDate.toISOString()}${
          period ? ` (${period})` : ""
        }`
      );

      // Create new workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Smart Factory System";
      workbook.created = new Date();
      workbook.modified = new Date();

      // Generate single KPI sheet
      const sheetsGenerated: string[] = [];
      const dateRange = { startDate, endDate };

      // Single comprehensive KPI sheet
      await EquipmentSheetBuilder.buildPerformanceSummary(
        workbook,
        dateRange,
        period,
        lang
      );
      sheetsGenerated.push("Equipment Performance KPIs");

      // Get total record count (approximate based on sections)
      const kpiSheet = workbook.getWorksheet("Equipment Performance KPIs");
      const totalRecords = kpiSheet ? kpiSheet.rowCount - 10 : 0;

      // Save workbook to file
      const fileName = generateReportFileName(
        `${getEquipmentReportTranslation(
          "equipmentPerformance",
          lang
        )}_${getEquipmentReportTranslation(`periods.${period}`, lang)}`,
        startDate,
        endDate
      );
      const filePath = await saveWorkbook(workbook, fileName);

      const generationTime = Date.now() - startTime;
      loggerService.info(
        `[EquipmentReport] Generation complete in ${generationTime}ms. File: ${filePath}`
      );

      // Update report status if reportId provided
      if (reportId) {
        await Report.findByIdAndUpdate(reportId, {
          status: "COMPLETED",
          filePath,
          completedAt: new Date(),
          metadata: {
            sheetsGenerated,
            recordCount: totalRecords,
            generationTime,
            period: period || "all-time"
          }
        });
      }

      return {
        success: true,
        filePath,
        fileName,
        reportId,
        metadata: {
          sheetsGenerated,
          recordCount: totalRecords,
          generationTime,
          period: period || "all-time"
        }
      };
    } catch (error: any) {
      console.error("[EquipmentReport] Generation failed:", error);

      // Update report status if reportId provided
      if (reportId) {
        await Report.findByIdAndUpdate(reportId, {
          status: "FAILED",
          errorMessage: error.message,
          completedAt: new Date()
        });
      }

      return {
        success: false,
        error: error.message,
        reportId
      };
    }
  }
}
