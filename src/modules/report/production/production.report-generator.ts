import { Report, ReportGenerationResult } from "@/modules/report";
import { loggerService } from "@/shared/services";
import ExcelJS from "exceljs";
import { generateReportFileName } from "../helpers/generateReportFileName";
import { saveWorkbook } from "../helpers/saveWorkbook";
import { ProductionSheetBuilder } from "./production.sheet-builder";
import { getProductionReportTranslation as getTranslation } from "./production.translations";

export class ProductionReportGenerator {
  public static async generateProductionRateReport(
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
        `[ProductionReport] Starting generation for date range: ${startDate.toISOString()} to ${endDate.toISOString()}${
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
      await ProductionSheetBuilder.generateProductionRateKPISheet(
        workbook,
        dateRange,
        period,
        lang
      );
      sheetsGenerated.push("Production Rate KPIs");

      // Get total record count (approximate based on sections)
      const kpiSheet = workbook.getWorksheet("Production Rate KPIs");
      const totalRecords = kpiSheet ? kpiSheet.rowCount - 10 : 0;

      // Save workbook to file
      const fileName = generateReportFileName(
        `${getTranslation("productionRate", lang)}_${getTranslation(
          `periods.${period}`,
          lang
        )}`,
        startDate,
        endDate
      );
      const filePath = await saveWorkbook(workbook, fileName);

      const generationTime = Date.now() - startTime;
      loggerService.info(
        `[ProductionReport] Generation complete in ${generationTime}ms. File: ${filePath}`
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
      console.error("[ProductionReport] Generation failed:", error);

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
