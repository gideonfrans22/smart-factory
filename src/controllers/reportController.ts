import { Request, Response } from "express";
import { Report } from "../models/Report";
import { User } from "../models/User";
import { APIResponse, AuthenticatedRequest } from "../types";
import * as ReportGenerationService from "../services/reportGenerationService";

export const generateReport = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.body) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Request body is required"
      };
      res.status(400).json(response);
      return;
    }

    const { title, type, format, parameters, lang } = req.body;

    const userId = req.user?._id || null;

    // For WORKER_PERFORMANCE_KPI, title is auto-generated
    let reportTitle = title;
    let workerId: string | null = null;

    if (type === "WORKER_PERFORMANCE_KPI") {
      // Validate workerId is provided
      const { workerId: paramWorkerId, startDate, endDate } = parameters || {};
      if (!paramWorkerId) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message:
            "workerId is required in parameters for WORKER_PERFORMANCE_KPI report"
        };
        res.status(400).json(response);
        return;
      }
      workerId = paramWorkerId;

      // Validate date range
      if (!startDate || !endDate) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Start date and end date are required in parameters"
        };
        res.status(400).json(response);
        return;
      }

      // Get worker info for title generation
      const worker = await User.findById(workerId);
      if (!worker) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Worker not found"
        };
        res.status(404).json(response);
        return;
      }

      // Auto-generate title: WORKER_PERFORMANCE_KPI-20250101-20250131-John_Doe.xlsx
      const formatDate = (date: string) => {
        return new Date(date).toISOString().split("T")[0].replace(/-/g, "");
      };
      const workerName = worker.name.replace(/\s+/g, "_");
      const timePeriod = `${formatDate(startDate)}-${formatDate(endDate)}`;
      const fileExtension = format === "EXCEL" ? "xlsx" : format.toLowerCase();
      reportTitle = `WORKER_PERFORMANCE_KPI-${timePeriod}-${workerName}.${fileExtension}`;
    } else {
      // For other report types, title is required
      if (!title || !type || !format) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Title, type, and format are required"
        };
        res.status(400).json(response);
        return;
      }

      // Validate date range
      const { startDate, endDate } = parameters || {};
      if (!startDate || !endDate) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Start date and end date are required in parameters"
        };
        res.status(400).json(response);
        return;
      }
    }

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const report = new Report({
      title: reportTitle,
      type,
      format,
      status: "PENDING",
      generatedBy: userId,
      parameters: parameters || {},
      expiresAt
    });

    await report.save();
    await report.populate("generatedBy", "name username");

    // Trigger async report generation
    const { startDate, endDate } = parameters || {};
    const start = new Date(startDate);
    const end = new Date(endDate);
    const reportIdStr = String(report._id);

    let result;
    switch (type) {
      case "TASK_COMPLETION":
        result = await ReportGenerationService.generateTaskReport(
          start,
          end,
          userId ? userId.toString() : "",
          reportIdStr,
          lang
        );
        break;
      case "WORKER_PERFORMANCE":
        result = await ReportGenerationService.generateWorkerPerformanceReport(
          start,
          end,
          userId ? userId.toString() : "",
          reportIdStr,
          lang
        );
        break;
      case "PRODUCTION_RATE":
        // Extract period parameter (optional: "daily" | "weekly" | "monthly")
        const period = parameters?.period;
        if (
          period &&
          period !== "daily" &&
          period !== "weekly" &&
          period !== "monthly"
        ) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message:
              "Period parameter must be 'daily', 'weekly', 'monthly', or omitted"
          };
          res.status(400).json(response);
          return;
        }
        result = await ReportGenerationService.generateProductionRateReport(
          start,
          end,
          userId ? userId.toString() : "",
          reportIdStr,
          lang,
          period as "daily" | "weekly" | "monthly" | undefined
        );
        break;
      case "EQUIPMENT_PERFORMANCE":
        // Extract period parameter (optional: "daily" | "weekly" | "monthly")
        const equipmentPeriod = parameters?.period;
        if (
          equipmentPeriod &&
          equipmentPeriod !== "daily" &&
          equipmentPeriod !== "weekly" &&
          equipmentPeriod !== "monthly"
        ) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message:
              "Period parameter must be 'daily', 'weekly', 'monthly', or omitted"
          };
          res.status(400).json(response);
          return;
        }
        result =
          await ReportGenerationService.generateEquipmentPerformanceReport(
            start,
            end,
            userId ? userId.toString() : "",
            reportIdStr,
            lang,
            equipmentPeriod as "daily" | "weekly" | "monthly" | undefined
          );
        break;
      case "WORKER_PERFORMANCE_KPI":
        if (!workerId) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message: "workerId is required for WORKER_PERFORMANCE_KPI report"
          };
          res.status(400).json(response);
          return;
        }
        result =
          await ReportGenerationService.generateWorkerPerformanceKPIReport(
            start,
            end,
            userId ? userId.toString() : "",
            workerId,
            reportIdStr,
            lang
          );
        break;
      default:
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid report type"
        };
        res.status(400).json(response);
        return;
    }

    if (!result.success) {
      const response: APIResponse = {
        success: false,
        error: "GENERATION_FAILED",
        message: result.error || "Report generation failed"
      };
      res.status(500).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Report generated successfully",
      data: {
        reportId: report._id,
        status: "COMPLETED",
        downloadUrl: `/api/reports/download/${report._id}`,
        fileName: result.fileName,
        metadata: result.metadata
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Generate report error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const getReports = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { type, status, page = 1, limit = 10 } = req.query;

    const query: any = {};
    if (type) query.type = type;
    if (status) query.status = status;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Report.countDocuments(query);
    const reports = await Report.find(query)
      .populate("generatedBy", "name username")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Reports retrieved successfully",
      data: {
        items: reports,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get reports error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const getReportById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);
    if (!report) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Report not found"
      };
      res.status(404).json(response);
      return;
    }
    const response: APIResponse = {
      success: true,
      message: "Report retrieved successfully",
      data: report
    };
    res.json(response);
  } catch (error) {
    console.error("Get report by ID error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const downloadReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id);

    if (!report) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Report not found"
      };
      res.status(404).json(response);
      return;
    }

    if (report.status !== "COMPLETED") {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: `Report is ${report.status.toLowerCase()}. Please wait for it to complete.`
      };
      res.status(400).json(response);
      return;
    }

    if (!report.filePath) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Report file not found"
      };
      res.status(404).json(response);
      return;
    }

    // Increment download count
    report.downloadCount = (report.downloadCount || 0) + 1;
    await report.save();

    // Stream the actual file
    const fs = require("fs");
    const path = require("path");

    if (!fs.existsSync(report.filePath)) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Report file not found on disk"
      };
      res.status(404).json(response);
      return;
    }

    const fileName = path.basename(report.filePath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const fileStream = fs.createReadStream(report.filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Download report error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const deleteReport = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const report = await Report.findByIdAndDelete(id);

    if (!report) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Report not found"
      };
      res.status(404).json(response);
      return;
    }

    // In production, delete the actual file here

    const response: APIResponse = {
      success: true,
      message: "Report deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete report error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
