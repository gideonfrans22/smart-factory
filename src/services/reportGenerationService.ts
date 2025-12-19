import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { Report } from "../models/Report";
import * as EquipmentReportService from "./equipmentReportService";
import * as ProductionReportService from "./productionReportService";
import * as TaskReportService from "./taskReportService";
import * as WorkerReportService from "./workerReportService";

/**
 * Main Report Generation Service
 * Orchestrates the generation of all report types
 */

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
 * Generate Task Completion Report
 * Includes 5 sheets: Executive Summary, Task Details, Recipe Execution Tracking, Device Utilization, Raw Data
 */
export async function generateTaskReport(
  startDate: Date,
  endDate: Date,
  _userId: string,
  reportId?: string,
  lang?: string
): Promise<ReportGenerationResult> {
  const startTime = Date.now();

  try {
    console.log(
      `[TaskReport] Starting generation for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Create new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Smart Factory System";
    workbook.created = new Date();
    workbook.modified = new Date();

    // Generate each sheet
    const sheetsGenerated: string[] = [];
    const dateRange = { startDate, endDate };

    // Sheet 1: Executive Summary
    await TaskReportService.generateTaskReportSummarySheet(
      workbook,
      dateRange,
      lang
    );
    sheetsGenerated.push("Executive Summary");

    // Sheet 2: Task Details
    await TaskReportService.generateTaskDetailsSheet(workbook, dateRange, lang);
    sheetsGenerated.push("Task Details");

    // Sheet 3: Recipe Execution Tracking
    await TaskReportService.generateRecipeExecutionSheet(
      workbook,
      dateRange,
      lang
    );
    sheetsGenerated.push("Recipe Execution Tracking");

    // Sheet 4: Device Utilization
    await TaskReportService.generateDeviceUtilizationSheet(
      workbook,
      dateRange,
      lang
    );
    sheetsGenerated.push("Device Utilization");

    // Sheet 5: Raw Task Data
    await TaskReportService.generateRawTaskDataSheet(workbook, dateRange, lang);
    sheetsGenerated.push("Raw Task Data");

    // Get total record count from raw data sheet
    const rawDataSheet = workbook.getWorksheet("Raw Task Data");
    const totalRecords = rawDataSheet ? rawDataSheet.rowCount - 3 : 0; // Subtract header rows

    // Save workbook to file
    const fileName = generateReportFileName("TaskReport", startDate, endDate);
    const filePath = await saveWorkbook(workbook, fileName);

    const generationTime = Date.now() - startTime;
    console.log(
      `[TaskReport] Generation complete in ${generationTime}ms. File: ${filePath}`
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
    console.error("[TaskReport] Generation failed:", error);

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
 * Generate Worker Performance Report
 * Includes 5 sheets: Performance Rankings, Individual Worker Details, Device Type Proficiency, Time Tracking & Quality, Raw Data
 */
export async function generateWorkerPerformanceReport(
  startDate: Date,
  endDate: Date,
  _userId: string,
  reportId?: string,
  lang?: string
): Promise<ReportGenerationResult> {
  const startTime = Date.now();

  try {
    console.log(
      `[WorkerReport] Starting generation for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Create new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Smart Factory System";
    workbook.created = new Date();
    workbook.modified = new Date();

    // Generate each sheet
    const sheetsGenerated: string[] = [];
    const dateRange = { startDate, endDate };

    // Sheet 1: Performance Rankings
    await WorkerReportService.generateWorkerRankingsSheet(
      workbook,
      dateRange,
      lang
    );
    sheetsGenerated.push("Performance Rankings");

    // Sheet 2: Individual Worker Details
    await WorkerReportService.generateWorkerDetailsSheet(
      workbook,
      dateRange,
      lang
    );
    sheetsGenerated.push("Worker Details");

    // Sheet 3: Device Type Proficiency
    await WorkerReportService.generateDeviceProficiencySheet(
      workbook,
      dateRange,
      lang
    );
    sheetsGenerated.push("Device Proficiency");

    // Sheet 4: Time Tracking & Quality
    await WorkerReportService.generateTimeTrackingSheet(
      workbook,
      dateRange,
      lang
    );
    sheetsGenerated.push("Time Tracking & Quality");

    // Sheet 5: Raw Worker Data
    await WorkerReportService.generateRawWorkerDataSheet(
      workbook,
      dateRange,
      lang
    );
    sheetsGenerated.push("Raw Worker Data");

    // Get total record count from raw data sheet
    const rawDataSheet = workbook.getWorksheet("Raw Worker Data");
    const totalRecords = rawDataSheet ? rawDataSheet.rowCount - 3 : 0;

    // Save workbook to file
    const fileName = generateReportFileName(
      "WorkerPerformanceReport",
      startDate,
      endDate
    );
    const filePath = await saveWorkbook(workbook, fileName);

    const generationTime = Date.now() - startTime;
    console.log(
      `[WorkerReport] Generation complete in ${generationTime}ms. File: ${filePath}`
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
    console.error("[WorkerReport] Generation failed:", error);

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
 * Generate Worker Performance KPI Report
 * Single sheet with personalized KPI data for one worker
 */
export async function generateWorkerPerformanceKPIReport(
  startDate: Date,
  endDate: Date,
  _userId: string,
  workerId: string,
  reportId?: string,
  lang?: string
): Promise<ReportGenerationResult> {
  const startTime = Date.now();

  try {
    console.log(
      `[WorkerKPIReport] Starting generation for worker: ${workerId}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Create new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Smart Factory System";
    workbook.created = new Date();
    workbook.modified = new Date();

    // Generate KPI sheet
    const sheetsGenerated: string[] = [];
    const dateRange = { startDate, endDate };

    await WorkerReportService.generateWorkerKPISheet(
      workbook,
      dateRange,
      workerId,
      lang
    );
    sheetsGenerated.push("Worker KPI");

    // Save workbook to file
    const fileName = generateReportFileName(
      "WorkerPerformanceKPI",
      startDate,
      endDate
    );
    const filePath = await saveWorkbook(workbook, fileName);

    const generationTime = Date.now() - startTime;
    console.log(
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
          recordCount: 1, // One worker row
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
        recordCount: 1,
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

/**
 * Generate Production Rate Report
 * Single comprehensive KPI sheet with all production metrics
 */
export async function generateProductionRateReport(
  startDate: Date,
  endDate: Date,
  _userId: string,
  reportId?: string,
  lang?: string,
  period?: "daily" | "weekly" | "monthly"
): Promise<ReportGenerationResult> {
  const startTime = Date.now();
  console.log(lang);

  try {
    console.log(
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
    await ProductionReportService.generateProductionRateKPISheet(
      workbook,
      dateRange,
      period
    );
    sheetsGenerated.push("Production Rate KPIs");

    // Get total record count (approximate based on sections)
    const kpiSheet = workbook.getWorksheet("Production Rate KPIs");
    const totalRecords = kpiSheet ? kpiSheet.rowCount - 10 : 0;

    // Save workbook to file
    const periodSuffix = period ? `_${period.toUpperCase()}` : "";
    const fileName = generateReportFileName(
      `ProductionRateReport${periodSuffix}`,
      startDate,
      endDate
    );
    const filePath = await saveWorkbook(workbook, fileName);

    const generationTime = Date.now() - startTime;
    console.log(
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
  lang?: string,
  period?: "daily" | "weekly" | "monthly"
): Promise<ReportGenerationResult> {
  const startTime = Date.now();
  console.log(lang);

  try {
    console.log(
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
    const periodSuffix = period ? `_${period.toUpperCase()}` : "";
    const fileName = generateReportFileName(
      `EquipmentPerformanceReport${periodSuffix}`,
      startDate,
      endDate
    );
    const filePath = await saveWorkbook(workbook, fileName);

    const generationTime = Date.now() - startTime;
    console.log(
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

// ==================== UTILITY FUNCTIONS ====================

/**
 * Generate standardized report file name
 * Format: ReportType_StartDate_EndDate_Timestamp.xlsx
 */
function generateReportFileName(
  reportType: string,
  startDate: Date,
  endDate: Date
): string {
  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  };

  const timestamp = Date.now();
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  return `${reportType}_${start}_${end}_${timestamp}.xlsx`;
}

/**
 * Save workbook to file system
 * Ensures uploads/reports directory exists
 */
async function saveWorkbook(
  workbook: ExcelJS.Workbook,
  fileName: string
): Promise<string> {
  // Ensure reports directory exists
  const reportsDir = path.join(process.cwd(), "uploads", "reports");

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    console.log(`[ReportGeneration] Created reports directory: ${reportsDir}`);
  }

  // Generate full file path
  const filePath = path.join(reportsDir, fileName);

  // Write workbook to file
  await workbook.xlsx.writeFile(filePath);

  console.log(`[ReportGeneration] Saved workbook to: ${filePath}`);

  return filePath;
}

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

    console.log(
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
          console.log(`[ReportCleanup] Deleted file: ${report.filePath}`);
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

    console.log(
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
