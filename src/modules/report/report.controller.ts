import { Response } from "express";
import mongoose from "mongoose";
import {
  reportGenerateBodySchema,
  reportListQuerySchema,
  reportIdParamSchema,
  reportDownloadParamSchema
} from "./report.validators";
import * as reportService from "./report.service";
import type { APIResponse } from "@shared/types";
import type { AuthenticatedRequest } from "@shared/types";

export const generateReport = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const body = reportGenerateBodySchema.parse(req.body);
    const userId =
      (req.user?._id as mongoose.Types.ObjectId | undefined) ?? null;

    const { status, body: payload } = await reportService.generateReport(
      userId,
      body
    );
    res.status(status).json(payload);
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
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const query = reportListQuerySchema.parse(req.query);
    const response = await reportService.listReports(query);
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
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = reportIdParamSchema.parse(req.params);
    const response = await reportService.getReportById(id);
    if (!response.success) {
      res.status(404).json(response);
      return;
    }
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
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = reportDownloadParamSchema.parse(req.params);
    const err = await reportService.streamDownloadReport(id, res);
    if (err) {
      const status =
        err.error === "NOT_FOUND" ? 404 : err.error === "VALIDATION_ERROR" ? 400 : 500;
      res.status(status).json(err);
    }
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
    const { id } = reportIdParamSchema.parse(req.params);
    const response = await reportService.deleteReportById(id);
    if (!response.success) {
      res.status(404).json(response);
      return;
    }
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
