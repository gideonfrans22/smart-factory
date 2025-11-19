import { Request, Response } from "express";
import { Report } from "../models/Report";
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

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const report = new Report({
      title,
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
        result = await ReportGenerationService.generateProductionRateReport(
          start,
          end,
          userId ? userId.toString() : "",
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
