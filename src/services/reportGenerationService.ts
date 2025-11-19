import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { Report } from "../models/Report";
import * as TaskReportService from "./taskReportService";
import * as WorkerReportService from "./workerReportService";
import * as ProductionReportService from "./productionReportService";

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
  reportId?: string
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
    await TaskReportService.generateTaskReportSummarySheet(workbook, dateRange);
    sheetsGenerated.push("Executive Summary");

    // Sheet 2: Task Details
    await TaskReportService.generateTaskDetailsSheet(workbook, dateRange);
    sheetsGenerated.push("Task Details");

    // Sheet 3: Recipe Execution Tracking
    await TaskReportService.generateRecipeExecutionSheet(workbook, dateRange);
    sheetsGenerated.push("Recipe Execution Tracking");

    // Sheet 4: Device Utilization
    await TaskReportService.generateDeviceUtilizationSheet(workbook, dateRange);
    sheetsGenerated.push("Device Utilization");

    // Sheet 5: Raw Task Data
    await TaskReportService.generateRawTaskDataSheet(workbook, dateRange);
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
  reportId?: string
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
    let totalRecords = 0;

    // Sheet 1: Performance Rankings
    console.log("[WorkerReport] Generating Performance Rankings sheet...");
    workbook.addWorksheet("Performance Rankings");
    const workerPerformance =
      await WorkerReportService.getWorkerPerformanceData({
        startDate,
        endDate
      });
    totalRecords += workerPerformance.length;
    // TODO: Implement generateWorkerRankingsSheet()
    sheetsGenerated.push("Performance Rankings");

    // Sheet 2: Individual Worker Details
    console.log("[WorkerReport] Generating Individual Worker Details sheet...");
    workbook.addWorksheet("Individual Worker Details");
    // TODO: Implement generateWorkerDetailsSheet()
    sheetsGenerated.push("Individual Worker Details");

    // Sheet 3: Device Type Proficiency
    console.log("[WorkerReport] Generating Device Type Proficiency sheet...");
    workbook.addWorksheet("Device Type Proficiency");
    // TODO: Implement generateDeviceProficiencySheet()
    sheetsGenerated.push("Device Type Proficiency");

    // Sheet 4: Time Tracking & Quality
    console.log("[WorkerReport] Generating Time Tracking & Quality sheet...");
    workbook.addWorksheet("Time Tracking & Quality");
    // TODO: Implement generateTimeTrackingSheet()
    sheetsGenerated.push("Time Tracking & Quality");

    // Sheet 5: Raw Worker Data
    console.log("[WorkerReport] Generating Raw Worker Data sheet...");
    workbook.addWorksheet("Raw Worker Data");
    // TODO: Implement generateRawWorkerDataSheet()
    sheetsGenerated.push("Raw Worker Data");

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
 * Generate Production Rate Report
 * Includes 5 sheets: Production Overview, Step-by-Step Efficiency, Bottleneck Analysis, Week-over-Week Trends, Raw Data
 */
export async function generateProductionRateReport(
  startDate: Date,
  endDate: Date,
  _userId: string,
  reportId?: string
): Promise<ReportGenerationResult> {
  const startTime = Date.now();

  try {
    console.log(
      `[ProductionReport] Starting generation for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Create new workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Smart Factory System";
    workbook.created = new Date();
    workbook.modified = new Date();

    // Generate each sheet
    const sheetsGenerated: string[] = [];
    let totalRecords = 0;

    // Sheet 1: Production Overview
    console.log("[ProductionReport] Generating Production Overview sheet...");
    workbook.addWorksheet("Production Overview");
    const productionData =
      await ProductionReportService.aggregateProductionByRecipe({
        startDate,
        endDate
      });
    totalRecords += productionData.length;
    // TODO: Implement generateProductionOverviewSheet()
    sheetsGenerated.push("Production Overview");

    // Sheet 2: Step-by-Step Efficiency
    console.log(
      "[ProductionReport] Generating Step-by-Step Efficiency sheet..."
    );
    workbook.addWorksheet("Step-by-Step Efficiency");
    // TODO: Implement generateStepEfficiencySheet()
    sheetsGenerated.push("Step-by-Step Efficiency");

    // Sheet 3: Bottleneck Analysis
    console.log("[ProductionReport] Generating Bottleneck Analysis sheet...");
    workbook.addWorksheet("Bottleneck Analysis");
    // TODO: Implement generateBottleneckAnalysisSheet()
    sheetsGenerated.push("Bottleneck Analysis");

    // Sheet 4: Week-over-Week Trends
    console.log("[ProductionReport] Generating Week-over-Week Trends sheet...");
    workbook.addWorksheet("Week-over-Week Trends");
    // TODO: Implement generateWeekTrendsSheet()
    sheetsGenerated.push("Week-over-Week Trends");

    // Sheet 5: Raw Production Data
    console.log("[ProductionReport] Generating Raw Production Data sheet...");
    workbook.addWorksheet("Raw Production Data");
    // TODO: Implement generateRawProductionDataSheet()
    sheetsGenerated.push("Raw Production Data");

    // Save workbook to file
    const fileName = generateReportFileName(
      "ProductionRateReport",
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
