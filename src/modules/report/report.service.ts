import fs from "fs";
import path from "path";
import { Response } from "express";
import mongoose from "mongoose";
import { Report } from "./report.model";
import * as reportGenerationService from "./report.generation.service";
import type { ReportGenerateBody, ReportListQuery } from "./report.types";
import type { APIResponse } from "@shared/types";

export async function listReports(
  query: ReportListQuery
): Promise<APIResponse> {
  const { type, status, page, limit, search, startDate, endDate } = query;

  const mongoQuery: Record<string, unknown> = {};
  if (type) mongoQuery.type = type;
  if (status) mongoQuery.status = status;
  if (search) mongoQuery.title = { $regex: search, $options: "i" };
  if (startDate || endDate) {
    mongoQuery.createdAt = {};
    if (startDate) {
      (mongoQuery.createdAt as { $gte?: Date }).$gte = new Date(startDate);
    }
    if (endDate) {
      (mongoQuery.createdAt as { $lte?: Date }).$lte = new Date(endDate);
    }
  }

  const skip = (page - 1) * limit;
  const total = await Report.countDocuments(mongoQuery);
  const reports = await Report.find(mongoQuery)
    .populate("generatedBy", "name username")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    success: true,
    message: "Reports retrieved successfully",
    data: {
      items: reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  };
}

export async function getReportById(id: string): Promise<APIResponse> {
  const report = await Report.findById(id);
  if (!report) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: "Report not found"
    };
  }
  return {
    success: true,
    message: "Report retrieved successfully",
    data: report
  };
}

export async function deleteReportById(id: string): Promise<APIResponse> {
  const report = await Report.findByIdAndDelete(id);
  if (!report) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: "Report not found"
    };
  }
  return {
    success: true,
    message: "Report deleted successfully"
  };
}

export async function streamDownloadReport(
  id: string,
  res: Response
): Promise<APIResponse | null> {
  const report = await Report.findById(id);
  if (!report) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: "Report not found"
    };
  }

  if (report.status !== "COMPLETED") {
    return {
      success: false,
      error: "VALIDATION_ERROR",
      message: `Report is ${report.status.toLowerCase()}. Please wait for it to complete.`
    };
  }

  if (!report.filePath) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: "Report file not found"
    };
  }

  report.downloadCount = (report.downloadCount || 0) + 1;
  await report.save();

  if (!fs.existsSync(report.filePath)) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: "Report file not found on disk"
    };
  }

  const fileName = path.basename(report.filePath);
  const encodedFileName = encodeURIComponent(fileName);

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
  );
  const fileStream = fs.createReadStream(report.filePath);
  fileStream.pipe(res);
  return null;
}

export async function generateReport(
  userId: mongoose.Types.ObjectId | null | undefined,
  body: ReportGenerateBody
): Promise<{ status: number; body: APIResponse }> {
  const { title, type, format, parameters, lang } = body;
  const { startDate, endDate, period, ...restParams } = parameters;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const report = new Report({
    title,
    type,
    format,
    status: "PENDING",
    generatedBy: userId ?? undefined,
    parameters: { ...restParams, startDate, endDate, period },
    expiresAt
  });

  await report.save();
  await report.populate("generatedBy", "name username");

  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  const reportIdStr = String(report._id);
  const userIdStr = userId ? userId.toString() : "";

  if (
    period &&
    period !== "daily" &&
    period !== "weekly" &&
    period !== "monthly"
  ) {
    return {
      status: 400,
      body: {
        success: false,
        error: "VALIDATION_ERROR",
        message:
          "Period parameter must be 'daily', 'weekly', 'monthly', or omitted"
      }
    };
  }

  let result;
  switch (type) {
    case "PRODUCTION_RATE":
      result = await reportGenerationService.generateProductionRateReport(
        start,
        end,
        userIdStr,
        reportIdStr,
        lang,
        period as "daily" | "weekly" | "monthly" | undefined
      );
      break;
    case "EQUIPMENT_PERFORMANCE":
      result = await reportGenerationService.generateEquipmentPerformanceReport(
        start,
        end,
        userIdStr,
        reportIdStr,
        lang,
        period as "daily" | "weekly" | "monthly" | undefined
      );
      break;
    case "WORKER_PERFORMANCE_KPI":
      result = await reportGenerationService.generateWorkerPerformanceKPIReport(
        start,
        end,
        userIdStr,
        reportIdStr,
        lang,
        period as "daily" | "weekly" | "monthly" | undefined
      );
      break;
    case "SUMMARY_REPORT":
      result = await reportGenerationService.generateSummaryReport(
        start,
        end,
        userIdStr,
        reportIdStr,
        lang,
        period as "daily" | "weekly" | "monthly" | undefined
      );
      break;
    default:
      return {
        status: 400,
        body: {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid report type"
        }
      };
  }

  if (!result.success) {
    return {
      status: 500,
      body: {
        success: false,
        error: "GENERATION_FAILED",
        message: result.error || "Report generation failed"
      }
    };
  }

  return {
    status: 201,
    body: {
      success: true,
      message: "Report generated successfully",
      data: {
        reportId: report._id,
        status: "COMPLETED",
        downloadUrl: `/api/reports/download/${String(report._id)}`,
        fileName: result.fileName,
        metadata: result.metadata
      }
    }
  };
}
