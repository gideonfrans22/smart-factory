import { loggerService } from "@shared/services";
import ExcelJS from "exceljs";
import fs from "fs";
import * as EquipmentReportService from "./equipment/equipment.sheet-builder";
import { generateReportFileName } from "./helpers/generateReportFileName";
import { saveWorkbook } from "./helpers/saveWorkbook";
import { ProductionSheetBuilder } from "./production/production.sheet-builder";
import { Report } from "./report.model";
import { SummarySheetBuilder } from "./summary/summary.sheet-builder";
/**
 * Main Report Generation Service
 * Orchestrates the generation of all report types
 */

// Translations
const TRANSLATIONS = {
  productionRate: {
    en: "Production Rate",
    ko: "생산율 리포트"
  },
  equipmentPerformance: {
    en: "Equipment Performance",
    ko: "장비 성능 리포트"
  },
  summary: {
    en: "Summary",
    ko: "요약 보고서"
  },
  periods: {
    daily: {
      en: "Daily",
      ko: "일간"
    },
    weekly: {
      en: "Weekly",
      ko: "주간"
    },
    monthly: {
      en: "Monthly",
      ko: "월간"
    }
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get translation value from TRANSLATIONS object
 * @param path Dot notation path to translation (e.g., "titles.workerPerformanceRankings")
 * @param lang Language code ("en" or "ko"), defaults to "en"
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

export interface ReportGenerationOptions {
  startDate: Date;
  endDate: Date;
  userId: string;
  reportType: "TASK_COMPLETION" | "WORKER_PERFORMANCE" | "PRODUCTION_RATE";
  filters?: {
    projectId?: string;
    workerId?: string;
    deviceTypeId?: string;
  };
}

export interface ReportGenerationResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
  reportId?: string;
  metadata?: {
    sheetsGenerated: string[];
    recordCount: number;
    generationTime: number; // in milliseconds
    period?: "daily" | "weekly" | "monthly" | "all-time";
  };
}

// ==================== MAIN REPORT GENERATION FUNCTIONS ====================

/**
 * Generate Production Rate Report
 * Single comprehensive KPI sheet with all production metrics
 */
export async function generateProductionRateReport(
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

/**
 * Generate Equipment Performance Report
 * Single comprehensive KPI sheet with all equipment metrics
 */
export async function generateEquipmentPerformanceReport(
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
    await EquipmentReportService.generateEquipmentPerformanceKPISheet(
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
      `${getTranslation("equipmentPerformance", lang)}_${getTranslation(
        `periods.${period}`,
        lang
      )}`,
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

/**
 * Generate Summary Report
 * Single comprehensive sheet with production/manufacturing status summary
 */
export async function generateSummaryReport(
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
      `${getTranslation("summary", lang)}_${getTranslation(
        `periods.${period}`,
        lang
      )}`,
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

// ==================== UTILITY FUNCTIONS ====================

/**
 * Validate date range
 */
export function validateDateRange(
  startDate: Date,
  endDate: Date
): {
  valid: boolean;
  error?: string;
} {
  // Check if dates are valid
  if (isNaN(startDate.getTime())) {
    return { valid: false, error: "Invalid start date" };
  }

  if (isNaN(endDate.getTime())) {
    return { valid: false, error: "Invalid end date" };
  }

  // Check if end date is after start date
  if (endDate < startDate) {
    return { valid: false, error: "End date must be after start date" };
  }

  // Check if date range is not too large (e.g., max 1 year)
  const maxDays = 365;
  const daysDiff =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff > maxDays) {
    return { valid: false, error: `Date range cannot exceed ${maxDays} days` };
  }

  return { valid: true };
}

/**
 * Cleanup expired reports
 * Deletes files and database records older than specified days
 */
export async function cleanupExpiredReports(daysOld: number = 7): Promise<{
  filesDeleted: number;
  recordsDeleted: number;
}> {
  try {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - daysOld);

    loggerService.info(
      `[ReportCleanup] Cleaning up reports older than ${expirationDate.toISOString()}`
    );

    // Find expired reports
    const expiredReports = await Report.find({
      createdAt: { $lt: expirationDate }
    });

    let filesDeleted = 0;

    // Delete files from file system
    for (const report of expiredReports) {
      if (report.filePath && fs.existsSync(report.filePath)) {
        try {
          fs.unlinkSync(report.filePath);
          filesDeleted++;
          loggerService.info(
            `[ReportCleanup] Deleted file: ${report.filePath}`
          );
        } catch (error) {
          console.error(
            `[ReportCleanup] Failed to delete file: ${report.filePath}`,
            error
          );
        }
      }
    }

    // Delete database records
    const deleteResult = await Report.deleteMany({
      createdAt: { $lt: expirationDate }
    });

    const recordsDeleted = deleteResult.deletedCount || 0;

    loggerService.info(
      `[ReportCleanup] Cleanup complete. Files deleted: ${filesDeleted}, Records deleted: ${recordsDeleted}`
    );

    return { filesDeleted, recordsDeleted };
  } catch (error) {
    console.error("[ReportCleanup] Cleanup failed:", error);
    throw error;
  }
}

/**
 * Get report file path from database
 */
export async function getReportFilePath(
  reportId: string
): Promise<string | null> {
  try {
    const report = await Report.findById(reportId);

    if (!report) {
      return null;
    }

    if (!report.filePath || !fs.existsSync(report.filePath)) {
      return null;
    }

    return report.filePath;
  } catch (error) {
    console.error("[ReportGeneration] Failed to get report file path:", error);
    return null;
  }
}

/**
 * Check if report file exists
 */
export function reportFileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
