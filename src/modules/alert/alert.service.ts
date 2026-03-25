import mongoose from "mongoose";
import { Alert, AlertDocument } from "./alert.model";
import {
  AlertBulkIdsDTO,
  AlertCreateDTO,
  AlertListFilters,
  AlertResolveEmergencyDTO
} from "./alert.types";
import { Task } from "@modules/task";
import { Device } from "@modules/device";
import { realtimeService } from "@shared/services";
import { getIO } from "@infra/config";

export interface AlertListResult {
  items: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface BulkResult {
  modifiedCount: number;
  matchedCount: number;
}

export interface AlertStatsResult {
  stats: {
    total: number;
    critical: number;
    unread: number;
    pending: number;
    resolved: number;
  };
  trends: {
    total: number;
    critical: number;
    unread: number;
    pending: number;
  };
  avgResponseTime: number;
  todayNewAlerts: number;
}

export class AlertService {
  async list(filters: AlertListFilters): Promise<AlertListResult> {
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
      sortOrder = "desc",
      source,
      relatedEntityType
    } = filters;

    const pageNum = page;
    const limitNum = limit;
    const skip = (pageNum - 1) * limitNum;

    const sortField = sortBy;
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortObject: any = { [sortField]: sortDirection };

    let total: number;
    let alerts: any;

    if (search) {
      const searchRegex = new RegExp(search, "i");
      const baseFilters: any = {};

      if (type) baseFilters.type = type;
      if (status) baseFilters.status = status;
      if (level) baseFilters.level = level;
      if (source) baseFilters.source = source;
      if (relatedEntityType) baseFilters.relatedEntityType = relatedEntityType;
      if (deviceId) {
        try {
          baseFilters.device = new mongoose.Types.ObjectId(deviceId);
        } catch {
          baseFilters.device = deviceId;
        }
      }
      if (taskId) {
        try {
          baseFilters.task = new mongoose.Types.ObjectId(taskId);
        } catch {
          baseFilters.task = taskId;
        }
      }
      if (projectId) {
        try {
          baseFilters.project = new mongoose.Types.ObjectId(projectId);
        } catch {
          baseFilters.project = projectId;
        }
      }
      if (reportedBy) {
        try {
          baseFilters.reportedBy = new mongoose.Types.ObjectId(reportedBy);
        } catch {
          baseFilters.reportedBy = reportedBy;
        }
      }

      const searchConditions = {
        $or: [
          { title: searchRegex },
          { message: searchRegex },
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
                          regex: search,
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

      const matchStage: any = {};
      if (Object.keys(baseFilters).length > 0) {
        matchStage.$and = [baseFilters, searchConditions];
      } else {
        Object.assign(matchStage, searchConditions);
      }

      const aggregationPipeline: any[] = [
        {
          $match: matchStage
        },
        { $sort: sortObject },
        { $skip: skip },
        { $limit: limitNum }
      ];

      const countPipeline = [
        {
          $match: matchStage
        }
      ];

      const countResult = await Alert.aggregate([
        ...countPipeline,
        { $count: "total" }
      ]);

      total = countResult.length > 0 ? countResult[0].total : 0;

      alerts = await Alert.aggregate(aggregationPipeline);
      alerts = await Alert.populate(alerts, [
        { path: "acknowledgedBy", select: "name username email" },
        { path: "reportedBy", select: "name username email" },
        {
          path: "device",
          populate: { path: "deviceTypeId", select: "name" }
        },
        { path: "task" },
        { path: "project" }
      ]);
    } else {
      const query: any = {};
      if (type) query.type = type;
      if (status) query.status = status;
      if (level) query.level = level;
      if (source) query.source = source;
      if (relatedEntityType) query.relatedEntityType = relatedEntityType;
      if (deviceId) query.device = deviceId;
      if (taskId) query.task = taskId;
      if (projectId) query.project = projectId;
      if (reportedBy) query.reportedBy = reportedBy;

      total = await Alert.countDocuments(query);
      alerts = await Alert.find(query)
        .populate("acknowledgedBy", "name username email")
        .populate("reportedBy", "name username email")
        .populate({
          path: "device",
          populate: { path: "deviceTypeId", select: "name" }
        })
        .populate("task")
        .populate("project")
        .skip(skip)
        .limit(limitNum)
        .sort(sortObject);
    }

    const transformedAlerts = alerts.map((alert: any) => {
      const alertObj = alert.toObject ? alert.toObject() : alert;

      if (alertObj.device && typeof alertObj.device === "object") {
        alertObj.deviceName = alertObj.device.name || null;
        if (
          alertObj.device.deviceTypeId &&
          typeof alertObj.device.deviceTypeId === "object"
        ) {
          alertObj.deviceTypeName = alertObj.device.deviceTypeId.name || null;
        }
      }

      if (alertObj.reportedBy && typeof alertObj.reportedBy === "object") {
        alertObj.reporterName =
          alertObj.reportedBy.name || alertObj.reportedBy.username || null;
      }

      return alertObj;
    });

    return {
      items: transformedAlerts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    };
  }

  async getById(id: string): Promise<AlertDocument | null> {
    return Alert.findById(id)
      .populate("acknowledgedBy", "name username")
      .populate({
        path: "device",
        populate: { path: "deviceTypeId", select: "name" }
      })
      .populate("task")
      .populate("project")
      .exec();
  }

  async create(
    data: AlertCreateDTO & { metadata?: any },
    userId?: mongoose.Types.ObjectId
  ): Promise<{ alert: AlertDocument; emergencyActions?: Record<string, any> }> {
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
      metadata,
      status
    } = data;

    let additionalData: any = {};
    if (relatedEntityType === "DEVICE") {
      additionalData.device = relatedEntityId;
    } else if (relatedEntityType === "TASK") {
      additionalData.task = relatedEntityId;
    } else if (relatedEntityType === "PROJECT") {
      additionalData.project = relatedEntityId;
    }

    const emergencyActions: any = {};

    if (level === "CRITICAL" || level === "HIGH") {
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
            pausedBy: (metadata as any)?.workerName ||
              (metadata as any)?.reportedBy ||
              "System"
          });
          await task.save();
          emergencyActions.taskPaused = taskId;
          realtimeService.broadcastTaskStatusChange(task.toObject());
        }
      }

      if (deviceId) {
        const device = await Device.findById(deviceId);
        if (device && device.status !== "MAINTENANCE") {
          const previousStatus = device.status;
          device.status = "MAINTENANCE";
          (device as any).errorReason = title;

          if (!device.statusHistory) {
            device.statusHistory = [];
          }
          device.statusHistory.push({
            status: "MAINTENANCE",
            changedAt: new Date(),
            reason: `Emergency: ${title}`,
            changedBy:
              (metadata as any)?.workerName ||
              (metadata as any)?.reportedBy ||
              "System"
          });

          await device.save();
          emergencyActions.deviceSetToMaintenance = deviceId;
          emergencyActions.previousDeviceStatus = previousStatus;

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
      status: status || "UNREAD",
      ...additionalData,
      modifiedBy: userId
    });

    await alert.save();
    await realtimeService.broadcastAlert(alert.toObject());

    return {
      alert,
      emergencyActions:
        Object.keys(emergencyActions).length > 0 ? emergencyActions : undefined
    };
  }

  async acknowledge(
    id: string,
    userId?: mongoose.Types.ObjectId
  ): Promise<AlertDocument | null> {
    const alert = await Alert.findById(id);
    if (!alert) {
      return null;
    }

    if (alert.status === "RESOLVED") {
      const error: any = new Error("Cannot acknowledge resolved alert");
      error.code = "ALREADY_RESOLVED";
      throw error;
    }

    alert.status = "ACKNOWLEDGED";
    if (userId) {
      alert.acknowledgedBy = userId;
    }
    alert.acknowledgedAt = new Date();

    await alert.save();
    await alert.populate("acknowledgedBy", "name username email");

    const io = getIO();
    const acknowledgedPayload = {
      alertId: (alert._id as any)?.toString() || (alert as any).id,
      acknowledgedBy: userId?.toString() || "system",
      acknowledgedAt: alert.acknowledgedAt!.toISOString(),
      timestamp: Date.now()
    };
    io.to("alerts").emit("alert:acknowledged", acknowledgedPayload);
    io.to("global").emit("alert:acknowledged", acknowledgedPayload);

    return alert;
  }

  async markRead(id: string): Promise<AlertDocument | null> {
    const alert = await Alert.findById(id);
    if (!alert) {
      return null;
    }

    if (alert.status === "RESOLVED") {
      const error: any = new Error("Cannot mark resolved alert as read");
      error.code = "ALREADY_RESOLVED";
      throw error;
    }

    alert.status = "READ";
    if (!alert.acknowledgedAt) {
      alert.acknowledgedAt = new Date();
    }

    await alert.save();
    await alert.populate("acknowledgedBy", "name username email");

    return alert;
  }

  async resolve(id: string, resolvedByUserId?: string): Promise<AlertDocument | null> {
    const alert = await Alert.findById(id);
    if (!alert) {
      return null;
    }

    if (alert.status === "RESOLVED") {
      const error: any = new Error("Alert is already resolved");
      error.code = "ALREADY_RESOLVED";
      throw error;
    }

    alert.status = "RESOLVED";
    alert.resolvedAt = new Date();

    await alert.save();
    await alert.populate("acknowledgedBy", "name username email");

    if (alert.type === "EQUIPMENT_DEFECT" || alert.type === "TOOL_CHANGE") {
      const device = await Device.findById(alert.device);
      if (device) {
        device.status = "ONLINE";
        if (!device.statusHistory) {
          device.statusHistory = [];
        }
        device.statusHistory.push({
          status: "ONLINE",
          changedAt: new Date(),
          reason: `Alert resolved: ${alert.message}`,
          changedBy: alert.reportedBy?.toString() || "System"
        });
        await device.save();
        realtimeService.broadcastDeviceUpdate(device.toObject());
      }
    }

    const io = getIO();
    const resolvedPayload = {
      alertId: (alert._id as any)?.toString() || (alert as any).id,
      resolvedBy: resolvedByUserId || "system",
      resolvedAt: alert.resolvedAt!.toISOString(),
      timestamp: Date.now()
    };
    io.to("alerts").emit("alert:resolved", resolvedPayload);
    io.to("global").emit("alert:resolved", resolvedPayload);

    return alert;
  }

  async bulkRead(body: AlertBulkIdsDTO): Promise<BulkResult> {
    const { alertIds } = body;

    const result = await Alert.updateMany(
      {
        _id: { $in: alertIds },
        acknowledgedAt: { $exists: false }
      },
      {
        $set: {
          status: "READ",
          acknowledgedAt: new Date()
        }
      }
    );

    await Alert.updateMany(
      {
        _id: { $in: alertIds },
        acknowledgedAt: { $exists: true }
      },
      {
        $set: {
          status: "READ"
        }
      }
    );

    return {
      modifiedCount: (result as any).modifiedCount,
      matchedCount: (result as any).matchedCount
    };
  }

  async bulkAcknowledge(
    body: AlertBulkIdsDTO,
    userId?: mongoose.Types.ObjectId
  ): Promise<BulkResult> {
    const { alertIds } = body;

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

    return {
      modifiedCount: (result as any).modifiedCount,
      matchedCount: (result as any).matchedCount
    };
  }

  async bulkResolve(
    body: AlertBulkIdsDTO,
    resolvedByUserId?: string
  ): Promise<BulkResult> {
    const { alertIds } = body;

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
          changedBy:
            unresolvedEquipmentError.reportedBy?.toString() || "System"
        });
        await device.save();
        realtimeService.broadcastDeviceUpdate(device.toObject());
      }
    }

    const io = getIO();
    const bulkResolvedPayload = {
      alertIds,
      resolvedBy: resolvedByUserId || "system",
      resolvedAt: new Date().toISOString(),
      count: (result as any).modifiedCount,
      timestamp: Date.now()
    };
    io.to("alerts").emit("alert:bulk-resolved", bulkResolvedPayload);
    io.to("global").emit("alert:bulk-resolved", bulkResolvedPayload);

    return {
      modifiedCount: (result as any).modifiedCount,
      matchedCount: (result as any).matchedCount
    };
  }

  async delete(id: string): Promise<AlertDocument | null> {
    return Alert.findByIdAndDelete(id).exec();
  }

  async resolveEmergency(
    id: string,
    body: AlertResolveEmergencyDTO,
    resolvedByName?: string
  ): Promise<{ alert: AlertDocument; actionsPerformed: Record<string, any> } | null> {
    const { resolvedBy, resolutionNotes } = body;

    const alert = await Alert.findById(id)
      .populate("device")
      .populate("task")
      .populate("project");

    if (!alert) {
      return null;
    }

    if (alert.level !== "CRITICAL") {
      const error: any = new Error(
        "Only CRITICAL level alerts can be resolved with this endpoint"
      );
      error.code = "INVALID_TYPE";
      throw error;
    }

    const actionsPerformed: any = {};

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

    if (alert.device) {
      const deviceId =
        typeof alert.device === "object"
          ? (alert.device as any)._id
          : alert.device;
      const device = await Device.findById(deviceId);

      if (device && device.status === "MAINTENANCE") {
        const previousStatus =
          (alert.metadata as any)?.emergencyActions?.previousDeviceStatus ||
          "ONLINE";
        device.status = previousStatus;
        (device as any).errorReason = undefined;

        if (!device.statusHistory) {
          device.statusHistory = [];
        }
        device.statusHistory.push({
          status: previousStatus,
          changedAt: new Date(),
          reason: `Emergency resolved: ${resolutionNotes || "Issue fixed"}`,
          changedBy: resolvedBy || resolvedByName || "Admin"
        });

        await device.save();
        actionsPerformed.equipmentRestored = (device as any).name || deviceId;

        realtimeService.broadcastDeviceUpdate(device.toObject());
      }
    }

    if (alert.task) {
      const taskId =
        typeof alert.task === "object" ? (alert.task as any)._id : alert.task;
      const task = await Task.findById(taskId);

      if (task && task.status === "PAUSED_EMERGENCY") {
        task.status = "ONGOING";

        if (task.pauseHistory && task.pauseHistory.length > 0) {
          const lastPause = task.pauseHistory[task.pauseHistory.length - 1];
          if (!lastPause.resumedAt) {
            lastPause.resumedAt = new Date();
            lastPause.resolvedBy = resolvedBy || resolvedByName || "Admin";

            const pauseDuration = Math.floor(
              (lastPause.resumedAt.getTime() - lastPause.pausedAt.getTime()) /
                (1000 * 60)
            );
            task.pausedDuration = (task.pausedDuration || 0) + pauseDuration;
          }
        }

        await task.save();
        actionsPerformed.taskResumed = (task as any).title || taskId;

        realtimeService.broadcastTaskStatusChange(task.toObject());
      }
    }

    await realtimeService.broadcastAlert(alert.toObject());

    return {
      alert,
      actionsPerformed
    };
  }

  async getStats(): Promise<AlertStatsResult> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const currentPeriodStart = new Date();
    currentPeriodStart.setDate(currentPeriodStart.getDate() - 7);

    const previousPeriodStart = new Date();
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 14);
    const previousPeriodEnd = new Date();
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 7);

    const currentPeriodAlerts = await Alert.find({
      createdAt: { $gte: currentPeriodStart }
    });

    const previousPeriodAlerts = await Alert.find({
      createdAt: {
        $gte: previousPeriodStart,
        $lt: previousPeriodEnd
      }
    });

    const currentStats = {
      total: currentPeriodAlerts.length,
      critical: currentPeriodAlerts.filter(
        (a) => a.level === "CRITICAL"
      ).length,
      unread: currentPeriodAlerts.filter(
        (a) => a.status === "UNREAD"
      ).length,
      pending: currentPeriodAlerts.filter(
        (a) => a.status === "READ" || a.status === "ACKNOWLEDGED"
      ).length,
      resolved: currentPeriodAlerts.filter(
        (a) => a.status === "RESOLVED"
      ).length
    };

    const previousStats = {
      total: previousPeriodAlerts.length,
      critical: previousPeriodAlerts.filter((a) => a.level === "CRITICAL")
        .length,
      unread: previousPeriodAlerts.filter((a) => a.status === "UNREAD").length,
      pending: previousPeriodAlerts.filter(
        (a) => a.status === "READ" || a.status === "ACKNOWLEDGED"
      ).length,
      resolved: previousPeriodAlerts.filter((a) => a.status === "RESOLVED")
        .length
    };

    const calculateTrend = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const trends = {
      total: calculateTrend(currentStats.total, previousStats.total),
      critical: calculateTrend(currentStats.critical, previousStats.critical),
      unread: calculateTrend(currentStats.unread, previousStats.unread),
      pending: calculateTrend(currentStats.pending, previousStats.pending)
    };

    const alertsWithAcknowledgment = currentPeriodAlerts.filter(
      (a) => a.acknowledgedAt && a.createdAt
    );

    let avgResponseTime = 0;
    if (alertsWithAcknowledgment.length > 0) {
      const totalResponseTime = alertsWithAcknowledgment.reduce(
        (sum, alert) => {
          const createdAt = new Date(alert.createdAt);
          const acknowledgedAt = new Date(alert.acknowledgedAt!);
          const diffMinutes =
            (acknowledgedAt.getTime() - createdAt.getTime()) / (1000 * 60);
          return sum + diffMinutes;
        },
        0
      );
      avgResponseTime = Math.round(
        totalResponseTime / alertsWithAcknowledgment.length
      );
    }

    const todayAlerts = await Alert.find({
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    });
    const todayNewAlerts = todayAlerts.length;

    const allAlerts = await Alert.find({});
    const overallStats = {
      total: allAlerts.length,
      critical: allAlerts.filter((a) => a.level === "CRITICAL").length,
      unread: allAlerts.filter((a) => a.status === "UNREAD").length,
      pending: allAlerts.filter(
        (a) => a.status === "READ" || a.status === "ACKNOWLEDGED"
      ).length,
      resolved: allAlerts.filter((a) => a.status === "RESOLVED").length
    };

    return {
      stats: overallStats,
      trends,
      avgResponseTime,
      todayNewAlerts
    };
  }
}

export const alertService = new AlertService();

