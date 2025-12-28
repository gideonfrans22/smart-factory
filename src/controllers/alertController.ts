import { Request, Response } from "express";
import mongoose from "mongoose";
import { Alert, Device } from "../models";
import { realtimeService } from "../services/realtimeService";
import { getIO } from "../config/websocket";
import { APIResponse, AuthenticatedRequest } from "../types";

export const getAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      type,
      status,
      level,
      deviceId,
      taskId,
      projectId,
      reportedBy,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const sortField = sortBy as string;
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortObject: any = { [sortField]: sortDirection };

    let total: number;
    let alerts: any;

    if (search) {
      // Use aggregation pipeline to search through all metadata fields
      const searchRegex = new RegExp(search as string, "i");

      // Build base filters
      const baseFilters: any = {};
      if (type) baseFilters.type = type;
      if (status) baseFilters.status = status;
      if (level) baseFilters.level = level;
      if (deviceId) {
        try {
          baseFilters.device = new mongoose.Types.ObjectId(deviceId as string);
        } catch {
          baseFilters.device = deviceId;
        }
      }
      if (taskId) {
        try {
          baseFilters.task = new mongoose.Types.ObjectId(taskId as string);
        } catch {
          baseFilters.task = taskId;
        }
      }
      if (projectId) {
        try {
          baseFilters.project = new mongoose.Types.ObjectId(
            projectId as string
          );
        } catch {
          baseFilters.project = projectId;
        }
      }
      if (reportedBy) {
        try {
          baseFilters.reportedBy = new mongoose.Types.ObjectId(
            reportedBy as string
          );
        } catch {
          baseFilters.reportedBy = reportedBy;
        }
      }

      // Build search conditions
      const searchConditions = {
        $or: [
          { title: searchRegex },
          { message: searchRegex },
          // Search through all metadata fields by converting object to array of values
          {
            $expr: {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $objectToArray: "$metadata" },
                      as: "field",
                      cond: {
                        $regexMatch: {
                          input: { $toString: "$$field.v" },
                          regex: search as string,
                          options: "i"
                        }
                      }
                    }
                  }
                },
                0
              ]
            }
          }
        ]
      };

      // Build match stage - combine base filters with search conditions
      const matchStage: any = {};
      if (Object.keys(baseFilters).length > 0) {
        matchStage.$and = [baseFilters, searchConditions];
      } else {
        Object.assign(matchStage, searchConditions);
      }

      const aggregationPipeline: any[] = [
        {
          $match: matchStage
        }
      ];

      // Add pagination and sorting
      aggregationPipeline.push(
        { $sort: sortObject },
        { $skip: skip },
        { $limit: limitNum }
      );

      // Get total count with same filters
      const countPipeline = [
        ...aggregationPipeline.slice(0, -2) // Remove skip and limit
      ];
      const countResult = await Alert.aggregate([
        ...countPipeline,
        { $count: "total" }
      ]);
      total = countResult.length > 0 ? countResult[0].total : 0;

      // Execute aggregation with pagination
      alerts = await Alert.aggregate(aggregationPipeline);

      // Populate references manually since aggregation doesn't support populate
      alerts = await Alert.populate(alerts, [
        { path: "acknowledgedBy", select: "name username email" },
        { path: "device" },
        { path: "task" },
        { path: "project" }
      ]);
    } else {
      // No search term - use regular find query
      const query: any = {};
      if (type) query.type = type;
      if (status) query.status = status;
      if (level) query.level = level;
      if (deviceId) query.device = deviceId;
      if (taskId) query.task = taskId;
      if (projectId) query.project = projectId;
      if (reportedBy) query.reportedBy = reportedBy;

      total = await Alert.countDocuments(query);
      alerts = await Alert.find(query)
        .populate("acknowledgedBy", "name username email")
        .populate("device")
        .populate("task")
        .populate("project")
        .skip(skip)
        .limit(limitNum)
        .sort(sortObject);
    }

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

    const alert = await Alert.findById(id)
      .populate("acknowledgedBy", "name username")
      .populate("device")
      .populate("task")
      .populate("project");

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
      deviceId,
      taskId,
      projectId,
      reportedBy,
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

    let additionalData: any = {};
    if (relatedEntityType === "DEVICE") {
      additionalData.device = relatedEntityId;
    } else if (relatedEntityType === "TASK") {
      additionalData.task = relatedEntityId;
    } else if (relatedEntityType === "PROJECT") {
      additionalData.project = relatedEntityId;
    }

    // Import models for emergency auto-actions
    const { Task } = require("../models/Task");
    const { Device } = require("../models/Device");

    // Auto-actions for EMERGENCY alerts
    const emergencyActions: any = {};
    if (type === "EMERGENCY") {
      // Auto-pause related task if provided
      if (taskId) {
        const task = await Task.findById(taskId);
        if (task && task.status === "ONGOING") {
          task.status = "PAUSED_EMERGENCY";
          if (!task.pauseHistory) {
            task.pauseHistory = [];
          }
          task.pauseHistory.push({
            pausedAt: new Date(),
            reason: `Emergency: ${title}`,
            pausedBy: metadata?.workerName || metadata?.reportedBy || "System"
          });
          await task.save();
          emergencyActions.taskPaused = taskId;

          // Broadcast task update
          realtimeService.broadcastTaskStatusChange(task.toObject());
        }
      }

      // Auto-set device to MAINTENANCE if provided
      if (deviceId) {
        const device = await Device.findById(deviceId);
        if (device && device.status !== "MAINTENANCE") {
          const previousStatus = device.status;
          device.status = "MAINTENANCE";
          device.errorReason = title;

          // Add to status history
          if (!device.statusHistory) {
            device.statusHistory = [];
          }
          device.statusHistory.push({
            status: "MAINTENANCE",
            changedAt: new Date(),
            reason: `Emergency: ${title}`,
            changedBy: metadata?.workerName || metadata?.reportedBy || "System"
          });

          await device.save();
          emergencyActions.deviceSetToMaintenance = deviceId;
          emergencyActions.previousDeviceStatus = previousStatus;

          // Broadcast device update
          realtimeService.broadcastDeviceUpdate(device.toObject());
        }
      }
    }

    const alert = new Alert({
      type,
      level,
      title,
      message,
      source,
      relatedEntityType,
      relatedEntityId,
      device: deviceId,
      task: taskId,
      project: projectId,
      reportedBy,
      metadata: {
        ...metadata,
        emergencyActions:
          Object.keys(emergencyActions).length > 0
            ? emergencyActions
            : undefined
      },
      status: "UNREAD",
      ...additionalData
    });

    await alert.save();

    // 🆕 Broadcast new alert in real-time
    await realtimeService.broadcastAlert(alert.toObject());

    const response: APIResponse = {
      success: true,
      message:
        type === "EMERGENCY"
          ? "Emergency alert created with automatic actions"
          : "Alert created successfully",
      data: {
        alert,
        emergencyActions:
          Object.keys(emergencyActions).length > 0
            ? emergencyActions
            : undefined
      }
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

    // Get userId if auth is enabled, otherwise use null
    const userId = req.user?._id as mongoose.Types.ObjectId | undefined;

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
    if (userId) {
      alert.acknowledgedBy = userId;
    }
    alert.acknowledgedAt = new Date();

    await alert.save();
    await alert.populate("acknowledgedBy", "name username email");

    // Emit WebSocket event for real-time Monitor TV update
    const io = getIO();
    const acknowledgedPayload = {
      alertId: (alert._id as any)?.toString() || alert.id,
      acknowledgedBy: userId?.toString() || "system",
      acknowledgedAt: alert.acknowledgedAt.toISOString(),
      timestamp: Date.now()
    };
    io.to("alerts").emit("alert:acknowledged", acknowledgedPayload);
    io.to("global").emit("alert:acknowledged", acknowledgedPayload);

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

    if (alert.type === "MACHINE_ERROR") {
      const device = await Device.findById(alert.device);
      if (device) {
        device.status = "ONLINE";
        if (!device.statusHistory) {
          device.statusHistory = [];
        }
        device.statusHistory.push({
          status: "ONLINE",
          changedAt: new Date(),
          reason: `Machine error resolved: ${alert.message}`,
          changedBy: alert.reportedBy?.toString() || "System"
        });
        await device.save();
        realtimeService.broadcastDeviceUpdate(device.toObject());
      }
    }

    // Emit WebSocket event for real-time Monitor TV update
    const io = getIO();
    const resolvedPayload = {
      alertId: (alert._id as any)?.toString() || alert.id,
      resolvedBy: req.user?.id || "system",
      resolvedAt: alert.resolvedAt.toISOString(),
      timestamp: Date.now()
    };
    io.to("alerts").emit("alert:resolved", resolvedPayload);
    io.to("global").emit("alert:resolved", resolvedPayload);

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

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "alertIds array is required and must not be empty"
      };
      res.status(400).json(response);
      return;
    }

    // Get userId if auth is enabled, otherwise use null
    const userId = req.user?._id as mongoose.Types.ObjectId | undefined;

    // Build update object conditionally
    const updateFields: any = {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date()
    };

    if (userId) {
      updateFields.acknowledgedBy = userId;
    }

    const result = await Alert.updateMany(
      { _id: { $in: alertIds } },
      { $set: updateFields }
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

    const unresolvedEquipmentErrors = await Alert.find({
      _id: { $in: alertIds },
      type: "MACHINE_ERROR",
      status: {
        $ne: "RESOLVED"
      }
    });

    const result = await Alert.updateMany(
      { _id: { $in: alertIds } },
      {
        $set: {
          status: "RESOLVED",
          resolvedAt: new Date()
        }
      }
    );

    for (const unresolvedEquipmentError of unresolvedEquipmentErrors) {
      const device = await Device.findById(unresolvedEquipmentError.device);
      if (device) {
        device.status = "ONLINE";
        if (!device.statusHistory) {
          device.statusHistory = [];
        }
        device.statusHistory.push({
          status: "ONLINE",
          changedAt: new Date(),
          reason: `Machine error resolved: ${unresolvedEquipmentError.message}`,
          changedBy: unresolvedEquipmentError.reportedBy?.toString() || "System"
        });
        await device.save();
        realtimeService.broadcastDeviceUpdate(device.toObject());
      }
    }

    // Emit WebSocket events for bulk resolution
    const io = getIO();
    const bulkResolvedPayload = {
      alertIds: alertIds,
      resolvedBy: req.user?.id || "system",
      resolvedAt: new Date().toISOString(),
      count: result.modifiedCount,
      timestamp: Date.now()
    };
    io.to("alerts").emit("alert:bulk-resolved", bulkResolvedPayload);
    io.to("global").emit("alert:bulk-resolved", bulkResolvedPayload);

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

/**
 * Resolve emergency alert with auto-recovery
 * PUT /api/alerts/:id/resolve-emergency
 */
export const resolveEmergencyAlert = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { resolvedBy, resolutionNotes } = req.body;

    const alert = await Alert.findById(id)
      .populate("device")
      .populate("task")
      .populate("project");

    if (!alert) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Alert not found"
      };
      res.status(404).json(response);
      return;
    }

    if (alert.type !== "EMERGENCY") {
      const response: APIResponse = {
        success: false,
        error: "INVALID_TYPE",
        message: "Only EMERGENCY alerts can be resolved with this endpoint"
      };
      res.status(400).json(response);
      return;
    }

    // Import models
    const { Task } = require("../models/Task");
    const { Device } = require("../models/Device");

    const actionsPerformed: any = {};

    // Mark alert as resolved
    alert.status = "RESOLVED";
    alert.resolvedAt = new Date();
    alert.metadata = {
      ...alert.metadata,
      resolvedBy,
      resolutionNotes,
      resolvedAt: new Date()
    };
    await alert.save();
    actionsPerformed.alertResolved = true;

    // Auto-restore device to ONLINE if it was set to MAINTENANCE
    if (alert.device) {
      const deviceId =
        typeof alert.device === "object"
          ? (alert.device as any)._id
          : alert.device;
      const device = await Device.findById(deviceId);

      if (device && device.status === "MAINTENANCE") {
        // Get previous status from emergency actions metadata
        const previousStatus =
          alert.metadata?.emergencyActions?.previousDeviceStatus || "ONLINE";
        device.status = previousStatus;
        device.errorReason = undefined;

        // Add to status history
        if (!device.statusHistory) {
          device.statusHistory = [];
        }
        device.statusHistory.push({
          status: previousStatus,
          changedAt: new Date(),
          reason: `Emergency resolved: ${resolutionNotes || "Issue fixed"}`,
          changedBy: resolvedBy || req.user?.name || "Admin"
        });

        await device.save();
        actionsPerformed.equipmentRestored = device.name || deviceId.toString();

        // Broadcast device update
        realtimeService.broadcastDeviceUpdate(device.toObject());
      }
    }

    // Auto-resume paused task if it was paused by this emergency
    if (alert.task) {
      const taskId =
        typeof alert.task === "object" ? (alert.task as any)._id : alert.task;
      const task = await Task.findById(taskId);

      if (task && task.status === "PAUSED_EMERGENCY") {
        task.status = "ONGOING";

        // Update the last pause entry with resolution info
        if (task.pauseHistory && task.pauseHistory.length > 0) {
          const lastPause = task.pauseHistory[task.pauseHistory.length - 1];
          if (!lastPause.resumedAt) {
            lastPause.resumedAt = new Date();
            lastPause.resolvedBy = resolvedBy || req.user?.name || "Admin";

            // Calculate paused duration
            const pauseDuration = Math.floor(
              (lastPause.resumedAt.getTime() - lastPause.pausedAt.getTime()) /
                (1000 * 60)
            );
            task.pausedDuration = (task.pausedDuration || 0) + pauseDuration;
          }
        }

        await task.save();
        actionsPerformed.taskResumed = task.title || taskId.toString();

        // Broadcast task update
        realtimeService.broadcastTaskStatusChange(task.toObject());
      }
    }

    // Broadcast alert update
    await realtimeService.broadcastAlert(alert.toObject());

    const response: APIResponse = {
      success: true,
      message: "Emergency resolved successfully",
      data: {
        alert,
        actionsPerformed
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Resolve emergency alert error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
