import { loggerService } from "@/shared/services";
import { ReportGenerationResult } from "@/modules/report";
import ExcelJS from "exceljs";
import { WorkerSheetBuilder } from "./worker.sheet-builder";
import { aggregateWorkerPerformanceSummary } from "./worker.data-loaders";
import { generateReportFileName } from "../helpers/generateReportFileName";
import { getWorkerReportTranslation } from "./worker.translations";
import { saveWorkbook } from "../helpers/saveWorkbook";
import { Report } from "@/modules/report";

export class WorkerReportGenerator {
  public static async generateKPIReport(
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
        `[WorkerKPIReport] Starting generation for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // Create new workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Smart Factory System";
      workbook.created = new Date();
      workbook.modified = new Date();

      // Generate summary sheet
      const sheetsGenerated: string[] = [];
      const dateRange = { startDate, endDate };

      await WorkerSheetBuilder.buildPerformanceSummary(
        workbook,
        dateRange,
        lang
      );
      sheetsGenerated.push("Worker Performance Summary");

      // Get record count
      const summaryData = await aggregateWorkerPerformanceSummary(dateRange);
      const recordCount = summaryData.length;

      // Save workbook to file
      const fileName = generateReportFileName(
        `${getWorkerReportTranslation(
          "workerPerformanceSummary",
          lang
        )}_${getWorkerReportTranslation(`periods.${period}`, lang)}`,
        startDate,
        endDate
      );
      const filePath = await saveWorkbook(workbook, fileName);

      const generationTime = Date.now() - startTime;
      loggerService.info(
        `[WorkerKPIReport] Generation complete in ${generationTime}ms. File: ${filePath}`
      );

      // Update report status if reportId provided
      if (reportId) {
        await Report.findByIdAndUpdate(reportId, {
          status: "COMPLETED",
          filePath,
          completedAt: new Date(),
          metadata: {
            sheetsGenerated,
            recordCount,
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
          recordCount,
          generationTime
        }
      };
    } catch (error: any) {
      console.error("[WorkerKPIReport] Generation failed:", error);

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
