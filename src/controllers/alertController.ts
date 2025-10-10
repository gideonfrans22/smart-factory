import { Request, Response } from "express";
import { Alert } from "../models/Alert";
import { APIResponse, AuthenticatedRequest } from "../types";
import mongoose from "mongoose";

export const getAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, isRead, severity, page = 1, limit = 10 } = req.query;

    const query: any = {};
    if (type) query.type = type;
    if (isRead !== undefined) query.isRead = isRead === "true";
    if (severity) query.severity = severity;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Alert.countDocuments(query);
    const alerts = await Alert.find(query)
      .populate("acknowledgedBy", "name empNo")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Alerts retrieved successfully",
      data: {
        items: alerts,
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
    console.error("Get alerts error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const getAlertById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const alert = await Alert.findById(id).populate(
      "acknowledgedBy",
      "name empNo"
    );

    if (!alert) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Alert not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Alert retrieved successfully",
      data: alert
    };

    res.json(response);
  } catch (error) {
    console.error("Get alert error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const createAlert = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      type,
      severity,
      title,
      message,
      source,
      relatedEntityType,
      relatedEntityId,
      metadata
    } = req.body;

    if (!type || !severity || !title || !message || !source) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Type, severity, title, message, and source are required"
      };
      res.status(400).json(response);
      return;
    }

    const alert = new Alert({
      type,
      severity,
      title,
      message,
      source,
      relatedEntityType,
      relatedEntityId,
      metadata,
      isRead: false
    });

    await alert.save();

    const response: APIResponse = {
      success: true,
      message: "Alert created successfully",
      data: alert
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Create alert error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const acknowledgeAlert = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!req.user) {
      const response: APIResponse = {
        success: false,
        error: "UNAUTHORIZED",
        message: "Authentication required"
      };
      res.status(401).json(response);
      return;
    }

    const userId = req.user._id as mongoose.Types.ObjectId;

    const alert = await Alert.findById(id);

    if (!alert) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Alert not found"
      };
      res.status(404).json(response);
      return;
    }

    alert.status = "ACKNOWLEDGED";
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    await alert.save();
    await alert.populate("acknowledgedBy", "name empNo");

    const response: APIResponse = {
      success: true,
      message: "Alert acknowledged successfully",
      data: alert
    };

    res.json(response);
  } catch (error) {
    console.error("Acknowledge alert error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const deleteAlert = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const alert = await Alert.findByIdAndDelete(id);

    if (!alert) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Alert not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Alert deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete alert error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
