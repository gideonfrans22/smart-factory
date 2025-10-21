import { Request, Response } from "express";
import { Report } from "../models/Report";
import { APIResponse, AuthenticatedRequest } from "../types";

export const generateReport = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { title, type, format, parameters } = req.body;
    const userId = req.user?._id;

    if (!title || !type || !format) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Title, type, and format are required"
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

    // In production, trigger async report generation here
    // For now, we'll just return the report ID

    const response: APIResponse = {
      success: true,
      message: "Report generation started",
      data: {
        reportId: report._id,
        status: report.status,
        downloadUrl: `/api/reports/download/${report._id}`
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

    // In production, stream the actual file
    // For now, return file information
    const response: APIResponse = {
      success: true,
      message: "Report ready for download",
      data: {
        reportId: report._id,
        title: report.title,
        format: report.format,
        filePath: report.filePath,
        fileSize: report.fileSize,
        downloadCount: report.downloadCount
      }
    };

    res.json(response);
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
