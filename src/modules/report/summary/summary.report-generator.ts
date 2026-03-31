import { loggerService } from "@/shared/services";
import { ReportGenerationResult } from "../report.generation.service";
import { SummarySheetBuilder } from "./summary.sheet-builder";
import ExcelJS from "exceljs";
import { generateReportFileName } from "../helpers/generateReportFileName";
import { saveWorkbook } from "../helpers/saveWorkbook";
import { Report } from "@/modules/report";
import { getSummaryReportTranslation } from "./summary.translations";

export class SummaryReportGenerator {
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
        `[SummaryReport] Starting generation for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // Create new workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Smart Factory System";
      workbook.created = new Date();
      workbook.modified = new Date();

      // Generate summary sheet
      const sheetsGenerated: string[] = [];
      const dateRange = { startDate, endDate };

      await SummarySheetBuilder.generateSummaryReportSheet(
        workbook,
        dateRange,
        lang
      );
      sheetsGenerated.push("Summary Report");

      // Get approximate record count
      const summarySheet = workbook.getWorksheet("Summary Report");
      const totalRecords = summarySheet ? summarySheet.rowCount - 10 : 0;

      // Save workbook to file
      const fileName = generateReportFileName(
        `${getSummaryReportTranslation(
          "summary",
          lang
        )}_${getSummaryReportTranslation(`periods.${period}`, lang)}`,
        startDate,
        endDate
      );
      const filePath = await saveWorkbook(workbook, fileName);

      const generationTime = Date.now() - startTime;
      loggerService.info(
        `[SummaryReport] Generation complete in ${generationTime}ms. File: ${filePath}`
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
            generationTime
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
          generationTime
        }
      };
    } catch (error: any) {
      console.error("[SummaryReport] Generation failed:", error);

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
