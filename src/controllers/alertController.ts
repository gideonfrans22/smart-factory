import { Request, Response } from "express";
import { Alert } from "../models/Alert";
import { APIResponse, AuthenticatedRequest } from "../types";
import mongoose from "mongoose";
import { realtimeService } from "../services/realtimeService";

export const getAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      type,
      status,
      level,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const query: any = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (level) query.level = level;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortField = sortBy as string;
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortObject: any = { [sortField]: sortDirection };

    const total = await Alert.countDocuments(query);
    const alerts = await Alert.find(query)
      .populate("deviceId", "name deviceType")
      .populate("createdBy", "name email")
      .populate("acknowledgedBy", "name username email")
      .skip(skip)
      .limit(limitNum)
      .sort(sortObject);

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
      "name username"
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
      level,
      title,
      message,
      source,
      relatedEntityType,
      relatedEntityId,
      metadata
    } = req.body;

    if (!type || !level || !title || !message) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Type, level, title, and message are required"
      };
      res.status(400).json(response);
      return;
    }

    const alert = new Alert({
      type,
      level,
      title,
      message,
      source,
      relatedEntityType,
      relatedEntityId,
      metadata,
      status: "UNREAD"
    });

    await alert.save();

    // 🆕 Broadcast new alert in real-time
    await realtimeService.broadcastAlert(alert.toObject());

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
    await alert.populate("acknowledgedBy", "name username email");

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

/**
 * Mark alert as read
 * PATCH /api/alerts/:id/read
 */
export const readAlert = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

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

    alert.status = "READ";

    await alert.save();
    await alert.populate("acknowledgedBy", "name username email");

    const response: APIResponse = {
      success: true,
      message: "Alert marked as read successfully",
      data: alert
    };

    res.json(response);
  } catch (error) {
    console.error("Read alert error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Resolve alert
 * PATCH /api/alerts/:id/resolve
 */
export const resolveAlert = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

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

    alert.status = "RESOLVED";
    alert.resolvedAt = new Date();

    await alert.save();
    await alert.populate("acknowledgedBy", "name username email");

    const response: APIResponse = {
      success: true,
      message: "Alert resolved successfully",
      data: alert
    };

    res.json(response);
  } catch (error) {
    console.error("Resolve alert error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Bulk mark alerts as read
 * POST /api/alerts/bulk-read
 */
export const bulkReadAlerts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { alertIds } = req.body;

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "alertIds array is required and must not be empty"
      };
      res.status(400).json(response);
      return;
    }

    const result = await Alert.updateMany(
      { _id: { $in: alertIds } },
      {
        $set: {
          status: "READ"
        }
      }
    );

    const response: APIResponse = {
      success: true,
      message: `${result.modifiedCount} alert(s) marked as read successfully`,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Bulk read alerts error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Bulk acknowledge alerts
 * POST /api/alerts/bulk-acknowledge
 */
export const bulkAcknowledgeAlerts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { alertIds } = req.body;

    if (!req.user) {
      const response: APIResponse = {
        success: false,
        error: "UNAUTHORIZED",
        message: "Authentication required"
      };
      res.status(401).json(response);
      return;
    }

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "alertIds array is required and must not be empty"
      };
      res.status(400).json(response);
      return;
    }

    const userId = req.user._id as mongoose.Types.ObjectId;

    const result = await Alert.updateMany(
      { _id: { $in: alertIds } },
      {
        $set: {
          status: "ACKNOWLEDGED",
          acknowledgedBy: userId,
          acknowledgedAt: new Date()
        }
      }
    );

    const response: APIResponse = {
      success: true,
      message: `${result.modifiedCount} alert(s) acknowledged successfully`,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Bulk acknowledge alerts error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Bulk resolve alerts
 * POST /api/alerts/bulk-resolve
 */
export const bulkResolveAlerts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { alertIds } = req.body;

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "alertIds array is required and must not be empty"
      };
      res.status(400).json(response);
      return;
    }

    const result = await Alert.updateMany(
      { _id: { $in: alertIds } },
      {
        $set: {
          status: "RESOLVED",
          resolvedAt: new Date()
        }
      }
    );

    const response: APIResponse = {
      success: true,
      message: `${result.modifiedCount} alert(s) resolved successfully`,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Bulk resolve alerts error:", error);
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
