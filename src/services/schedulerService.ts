import * as cron from "node-cron";
import { Report } from "../models/Report";
import { ActivityLog } from "../models/ActivityLog";
import * as ReportGenerationService from "./reportGenerationService";
import {
  getPreviousDayRange,
  getPreviousWeekRange,
  getPreviousMonthRange,
  formatDateRange,
  DateRange
} from "../utils/dateRangeUtils";
import { DateTime } from "luxon";
import { loggerService } from "./loggerService";

/**
 * Scheduler Service for Auto-Generating Reports
 * Manages cron jobs for scheduled report generation
 */

const TIMEZONE = "Asia/Seoul";
const SYSTEM_USER_ID = "SYSTEM_SCHEDULER"; // Special identifier for system-generated reports

interface ScheduledReportConfig {
  type: "PRODUCTION_RATE" | "EQUIPMENT_PERFORMANCE" | "WORKER_PERFORMANCE_KPI";
  period: "daily" | "weekly" | "monthly";
  dateRange: DateRange;
}

/**
 * Initialize the scheduler with all cron jobs
 */
export function initializeScheduler(): void {
  const enableScheduler = process.env.ENABLE_SCHEDULER !== "false"; // Default to true

  if (!enableScheduler) {
    loggerService.logSchedulerEvent(
      "Scheduler disabled via ENABLE_SCHEDULER environment variable"
    );
    return;
  }

  loggerService.logSchedulerEvent("Initializing report scheduler");

  // Schedule daily reports (02:00 every day) - WORKER_PERFORMANCE_KPI only
  scheduleDailyReports();

  // Schedule weekly reports (02:00 every Monday) - All 3 types
  scheduleWeeklyReports();

  // Schedule monthly reports (02:00 on 1st of month) - All 3 types
  scheduleMonthlyReports();

  logActivity(
    "SCHEDULER_INITIALIZED",
    {
      message: "Report scheduler initialized successfully",
      schedules: {
        daily: "02:00 every day (WORKER_PERFORMANCE_KPI)",
        weekly: "02:00 every Monday (All 3 types)",
        monthly: "02:00 on 1st of month (All 3 types)"
      }
    },
    true
  ).catch((err) => {
    loggerService.logSchedulerEvent(
      "Failed to log scheduler initialization",
      {},
      err as Error
    );
  });

  loggerService.logSchedulerEvent("Report scheduler initialized");
}

/**
 * Schedule daily reports - WORKER_PERFORMANCE_KPI only
 * Runs at 02:00 every day
 */
function scheduleDailyReports(): void {
  // Cron: 0 2 * * * (02:00 every day)
  cron.schedule(
    "0 2 * * *",
    async () => {
      loggerService.logSchedulerEvent("Daily report schedule triggered");
      try {
        const dateRange = getPreviousDayRange();
        loggerService.logSchedulerEvent(
          "Generating daily WORKER_PERFORMANCE_KPI report",
          {
            dateRange: formatDateRange(dateRange)
          }
        );

        await generateScheduledReport({
          type: "WORKER_PERFORMANCE_KPI",
          period: "daily",
          dateRange
        });
      } catch (error: any) {
        loggerService.logSchedulerEvent(
          "Error in daily report schedule",
          {},
          error
        );
        await logActivity(
          "SCHEDULED_REPORT_FAILED",
          {
            type: "WORKER_PERFORMANCE_KPI",
            period: "daily",
            error: error.message
          },
          false
        ).catch((err) => {
          loggerService.logSchedulerEvent(
            "Failed to log error",
            {},
            err as Error
          );
        });
      }
    },
    {
      timezone: TIMEZONE
    }
  );

  loggerService.logSchedulerEvent("Daily reports scheduled (02:00 every day)");
}

/**
 * Schedule weekly reports - All 3 types
 * Runs at 02:00 every Monday
 */
function scheduleWeeklyReports(): void {
  // Cron: 0 2 * * 1 (02:00 every Monday)
  cron.schedule(
    "0 2 * * 1",
    async () => {
      loggerService.logSchedulerEvent("Weekly report schedule triggered");
      const dateRange = getPreviousWeekRange();
      loggerService.logSchedulerEvent("Generating weekly reports", {
        dateRange: formatDateRange(dateRange)
      });

      const reports: ScheduledReportConfig[] = [
        {
          type: "PRODUCTION_RATE",
          period: "weekly",
          dateRange
        },
        {
          type: "EQUIPMENT_PERFORMANCE",
          period: "weekly",
          dateRange
        },
        {
          type: "WORKER_PERFORMANCE_KPI",
          period: "weekly",
          dateRange
        }
      ];

      // Generate all reports in parallel, but continue even if one fails
      await Promise.allSettled(
        reports.map((config) => generateScheduledReport(config))
      );
    },
    {
      timezone: TIMEZONE
    }
  );

  loggerService.logSchedulerEvent(
    "Weekly reports scheduled (02:00 every Monday)"
  );
}

/**
 * Schedule monthly reports - All 3 types
 * Runs at 02:00 on 1st of every month
 */
function scheduleMonthlyReports(): void {
  // Cron: 0 2 1 * * (02:00 on 1st of month)
  cron.schedule(
    "0 2 1 * *",
    async () => {
      loggerService.logSchedulerEvent("Monthly report schedule triggered");
      const dateRange = getPreviousMonthRange();
      loggerService.logSchedulerEvent("Generating monthly reports", {
        dateRange: formatDateRange(dateRange)
      });

      const reports: ScheduledReportConfig[] = [
        {
          type: "PRODUCTION_RATE",
          period: "monthly",
          dateRange
        },
        {
          type: "EQUIPMENT_PERFORMANCE",
          period: "monthly",
          dateRange
        },
        {
          type: "WORKER_PERFORMANCE_KPI",
          period: "monthly",
          dateRange
        }
      ];

      // Generate all reports in parallel, but continue even if one fails
      await Promise.allSettled(
        reports.map((config) => generateScheduledReport(config))
      );
    },
    {
      timezone: TIMEZONE
    }
  );

  loggerService.logSchedulerEvent(
    "Monthly reports scheduled (02:00 on 1st of month)"
  );
}

/**
 * Generate a scheduled report
 */
async function generateScheduledReport(
  config: ScheduledReportConfig
): Promise<void> {
  const { type, period, dateRange } = config;
  const startTime = Date.now();

  try {
    loggerService.logSchedulerEvent(
      `Generating scheduled ${type} report (${period})`,
      {
        dateRange: formatDateRange(dateRange)
      }
    );

    // Generate report title
    const formatDate = (date: Date) => {
      return DateTime.fromJSDate(date).setZone(TIMEZONE).toFormat("yyyyMMdd");
    };
    const timePeriod = `${formatDate(dateRange.startDate)}-${formatDate(
      dateRange.endDate
    )}`;
    const fileExtension = "xlsx";
    let reportTitle: string;

    if (type === "WORKER_PERFORMANCE_KPI") {
      reportTitle = `${type}-${timePeriod}.${fileExtension}`;
    } else {
      reportTitle = `${type}_${period.toUpperCase()}-${timePeriod}.${fileExtension}`;
    }

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create Report document
    const report = new Report({
      title: reportTitle,
      type,
      format: "EXCEL",
      status: "PENDING",
      parameters: {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        ...(type !== "WORKER_PERFORMANCE_KPI" && { period })
      },
      expiresAt
    });

    await report.save();
    const reportIdStr = String(report._id);

    // Update status to PROCESSING
    report.status = "PROCESSING";
    await report.save();

    // Generate the report
    let result: ReportGenerationService.ReportGenerationResult;

    switch (type) {
      case "PRODUCTION_RATE":
        result = await ReportGenerationService.generateProductionRateReport(
          dateRange.startDate,
          dateRange.endDate,
          SYSTEM_USER_ID,
          reportIdStr,
          undefined, // lang
          period as "daily" | "weekly" | "monthly"
        );
        break;
      case "EQUIPMENT_PERFORMANCE":
        result =
          await ReportGenerationService.generateEquipmentPerformanceReport(
            dateRange.startDate,
            dateRange.endDate,
            SYSTEM_USER_ID,
            reportIdStr,
            undefined, // lang
            period as "daily" | "weekly" | "monthly"
          );
        break;
      case "WORKER_PERFORMANCE_KPI":
        result =
          await ReportGenerationService.generateWorkerPerformanceKPIReport(
            dateRange.startDate,
            dateRange.endDate,
            SYSTEM_USER_ID,
            reportIdStr,
            undefined // lang
          );
        break;
      default:
        throw new Error(`Unknown report type: ${type}`);
    }

    const generationTime = Date.now() - startTime;

    if (!result.success) {
      throw new Error(result.error || "Report generation failed");
    }

    // Log successful generation
    await logActivity(
      "SCHEDULED_REPORT_GENERATED",
      {
        reportId: reportIdStr,
        type,
        period,
        dateRange: {
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString()
        },
        fileName: result.fileName,
        generationTime,
        schedule: `${period} at 02:00`
      },
      true
    );

    loggerService.logSchedulerEvent(
      `Successfully generated ${type} report (${period})`,
      {
        reportId: reportIdStr,
        generationTime,
        period,
        type
      }
    );
  } catch (error: any) {
    const generationTime = Date.now() - startTime;
    loggerService.logSchedulerEvent(
      `Failed to generate scheduled ${type} report (${period})`,
      {
        period,
        generationTime,
        type
      },
      error
    );

    // Try to update report status if it was created
    try {
      const reports = await Report.find({
        type,
        status: "PROCESSING",
        "parameters.startDate": dateRange.startDate.toISOString(),
        "parameters.endDate": dateRange.endDate.toISOString()
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (reports.length > 0) {
        const report = reports[0];
        report.status = "FAILED";
        report.errorMessage = error.message;
        await report.save();
      }
    } catch (updateError) {
      loggerService.logSchedulerEvent(
        "Failed to update report status",
        {},
        updateError as Error
      );
    }

    // Log failure
    await logActivity(
      "SCHEDULED_REPORT_FAILED",
      {
        type,
        period,
        dateRange: {
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString()
        },
        error: error.message,
        generationTime
      },
      false
    );
  }
}

/**
 * Log activity for scheduler events
 */
async function logActivity(
  action: string,
  details: Record<string, any>,
  success: boolean
): Promise<void> {
  try {
    await ActivityLog.create({
      action,
      resourceType: "Report",
      resourceId: details.reportId || undefined,
      details,
      success,
      ...(success ? {} : { errorMessage: details.error })
    });
  } catch (error) {
    loggerService.logSchedulerEvent(
      "Failed to create activity log",
      {},
      error as Error
    );
    // Don't throw - activity logging failure shouldn't break report generation
  }
}
