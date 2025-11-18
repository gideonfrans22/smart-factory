import { Request, Response } from "express";
import { Device } from "../models/Device";
import { DeviceType } from "../models/DeviceType";
import { Task } from "../models/Task";
import { APIResponse, AuthenticatedRequest } from "../types";
import { GridLayout } from "../models";

export const getDevices = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query: any = {};
    if (status) query.status = status;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Device.countDocuments(query);
    const devices = await Device.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Devices retrieved successfully",
      data: {
        items: devices,
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
    console.error("Get devices error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const getDeviceById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const device = await Device.findById(id);

    if (!device) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Device retrieved successfully",
      data: device
    };

    res.json(response);
  } catch (error) {
    console.error("Get device error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const registerDevice = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, deviceTypeId, status, ipAddress, macAddress, config } =
      req.body;

    if (!name || !deviceTypeId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name, and deviceTypeId are required"
      };
      res.status(400).json(response);
      return;
    }

    // Validate deviceTypeId exists
    const deviceType = await DeviceType.findById(deviceTypeId);
    if (!deviceType) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: `Device type not found: ${deviceTypeId}`
      };
      res.status(404).json(response);
      return;
    }

    // Duplicate check: device name/number must be unique
    const existingDevice = await Device.findOne({ name });
    if (existingDevice) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_DEVICE_NUMBER",
        message: "Device number is duplicated"
      };
      res.status(409).json(response);
      return;
    }

    const device = new Device({
      name,
      deviceTypeId,
      ipAddress,
      macAddress,
      status,
      config,
      lastHeartbeat: new Date()
    });

    await device.save();

    const response: APIResponse = {
      success: true,
      message: "Device registered successfully",
      data: await device.populate("deviceType", "name description")
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Register device error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const updateDevice = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, deviceTypeId, status, currentUser, ipAddress, config } =
      req.body;

    const device = await Device.findById(id);

    if (!device) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate deviceTypeId if provided
    if (deviceTypeId) {
      const deviceType = await DeviceType.findById(deviceTypeId);
      if (!deviceType) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: `Device type not found: ${deviceTypeId}`
        };
        res.status(404).json(response);
        return;
      }
      device.deviceTypeId = deviceTypeId;
    }

    // Duplicate check: device name/number must be unique (if name is being updated)
    if (name && name !== device.name) {
      const existingDevice = await Device.findOne({ name });
      if (
        existingDevice &&
        existingDevice._id.toString() !== device._id.toString()
      ) {
        const response: APIResponse = {
          success: false,
          error: "DUPLICATE_DEVICE_NUMBER",
          message: "Device number is duplicated"
        };
        res.status(409).json(response);
        return;
      }
      device.name = name;
    }
    if (status) device.status = status;
    if (ipAddress) device.ipAddress = ipAddress;
    if (config) device.config = config;

    // Update heartbeat if status is being updated
    if (status) {
      device.lastHeartbeat = new Date();
    }

    if (currentUser) {
      device.currentUser = currentUser;
    } else if (currentUser === null) {
      device.currentUser = undefined;
    }

    await device.save();

    const response: APIResponse = {
      success: true,
      message: "Device updated successfully",
      data: await device.populate("deviceType", "name description")
    };

    res.json(response);
  } catch (error) {
    console.error("Update device error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const deleteDevice = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const device = await Device.findByIdAndDelete(id);

    if (!device) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Device deleted successfully"
    };

    res.json(response);
  } catch (error: any) {
    console.error("Delete device error:", error);

    // Check if error is due to recipe step dependency
    if (error.message && error.message.includes("Cannot delete device")) {
      const response: APIResponse = {
        success: false,
        error: "CONFLICT",
        message: error.message
      };
      res.status(409).json(response);
      return;
    }

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get device statistics with health metrics
 * @route GET /api/devices/statistics
 * @query timeRange: daily | weekly | monthly (default: daily)
 * @query status: ONLINE | OFFLINE | MAINTENANCE | ERROR (optional)
 * @query limit: number (default: 100)
 */
export const getDeviceStatistics = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      timeRange = "daily",
      status: statusFilter,
      limit = 100
    } = req.query;

    // Calculate time range
    const now = new Date();
    let startDate = new Date();

    if (timeRange === "weekly") {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === "monthly") {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      // daily
      startDate.setDate(now.getDate() - 1);
    }

    // Build device query
    const deviceQuery: any = {};
    if (statusFilter) deviceQuery.status = statusFilter;

    // Fetch all devices
    const devices = await Device.find(deviceQuery)
      .limit(parseInt(limit as string))
      .populate("deviceType", "name");

    // Aggregate statistics for each device
    const deviceStats = await Promise.all(
      devices.map(async (device) => {
        // Get all tasks for this device in the time range
        const allTasks = await Task.find({
          deviceId: device._id,
          createdAt: { $gte: startDate, $lte: now }
        });

        const activeTasks = allTasks.filter((t) => t.status === "ONGOING");
        const completedTasks = allTasks.filter((t) => t.status === "COMPLETED");
        const failedTasks = allTasks.filter((t) => t.status === "FAILED");

        // Calculate metrics
        const workload = activeTasks.length;
        const totalTasks = allTasks.length;
        const failureCount = failedTasks.length;
        const failureRate =
          totalTasks > 0 ? (failureCount / totalTasks) * 100 : 0;

        // Calculate average task duration (in minutes)
        const completedDurations = completedTasks
          .filter((t) => t.actualDuration)
          .map((t) => t.actualDuration || 0);
        const avgTaskDuration =
          completedDurations.length > 0
            ? completedDurations.reduce((a, b) => a + b, 0) /
              completedDurations.length
            : 0;

        // Calculate efficiency
        const efficiency =
          totalTasks > 0 ? ((totalTasks - failureCount) / totalTasks) * 100 : 0;

        // Calculate uptime (based on status history)
        const onlineTasks = allTasks.filter((t) => t.status !== "FAILED");
        const uptime =
          totalTasks > 0 ? (onlineTasks.length / totalTasks) * 100 : 100;

        // Utilization: assume max capacity of 5 tasks per device
        const maxCapacity = 5;
        const utilization = Math.min((workload / maxCapacity) * 100, 100);

        // Health score: (100 - failureRate) with uptime adjustment
        const healthScore = (100 - failureRate) * (uptime / 100);

        return {
          deviceId: device._id,
          deviceName: device.name,
          status: device.status,
          utilization: Math.round(utilization),
          workload,
          healthScore: Math.round(healthScore),
          uptime: Math.round(uptime),
          efficiency: Math.round(efficiency),
          lastStatusChange: device.updatedAt,
          totalTasksProcessed: completedTasks.length,
          avgTaskDuration: Math.round(avgTaskDuration),
          failureRate: Math.round(failureRate)
        };
      })
    );

    // Calculate summary
    const totalDevices = deviceStats.length;
    const onlineCount = deviceStats.filter((d) => d.status === "ONLINE").length;
    const offlineCount = deviceStats.filter(
      (d) => d.status === "OFFLINE"
    ).length;
    const avgUtilization =
      totalDevices > 0
        ? deviceStats.reduce((sum, d) => sum + d.utilization, 0) / totalDevices
        : 0;
    const avgHealthScore =
      totalDevices > 0
        ? deviceStats.reduce((sum, d) => sum + d.healthScore, 0) / totalDevices
        : 0;

    const response: APIResponse = {
      success: true,
      message: "Device statistics retrieved successfully",
      data: {
        items: deviceStats,
        summary: {
          totalDevices,
          onlineCount,
          offlineCount,
          avgUtilization: Math.round(avgUtilization),
          avgHealthScore: Math.round(avgHealthScore)
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get device statistics error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get devices grouped by tasks (device-centric view)
 * @route GET /api/devices/by-task
 * @query status: PENDING | IN_PROGRESS | COMPLETED (optional)
 * @query limit: number (default: 50)
 * @query sortBy: workload | status | name (default: workload)
 */
export const getDevicesByTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      status: taskStatusFilter,
      limit = 50,
      sortBy = "workload"
    } = req.query;

    // Build task query
    const taskQuery: any = {};
    if (taskStatusFilter) {
      // Map status names
      if (taskStatusFilter === "IN_PROGRESS") {
        taskQuery.status = "ONGOING";
      } else if (taskStatusFilter === "PENDING") {
        taskQuery.status = "PENDING";
      } else if (taskStatusFilter === "COMPLETED") {
        taskQuery.status = "COMPLETED";
      }
    }

    // Fetch all devices
    const devices = await Device.find({})
      .limit(parseInt(limit as string))
      .populate("deviceType", "name");

    // Group tasks by device and include device info
    const deviceWithTasks = await Promise.all(
      devices.map(async (device) => {
        // Get tasks for this device
        let tasksForDevice = await Task.find({
          deviceId: device._id
        })
          .populate("workerId", "name username")
          .populate("recipeId", "name")
          .select(
            "_id title status progress startedAt estimatedDuration priority workerId recipeId"
          );

        // Filter by status if provided
        if (taskStatusFilter) {
          tasksForDevice = tasksForDevice.filter((t) => {
            if (taskStatusFilter === "IN_PROGRESS" && t.status === "ONGOING") {
              return true;
            } else if (
              taskStatusFilter === "PENDING" &&
              t.status === "PENDING"
            ) {
              return true;
            } else if (
              taskStatusFilter === "COMPLETED" &&
              t.status === "COMPLETED"
            ) {
              return true;
            }
            return false;
          });
        }

        const activeTaskCount = tasksForDevice.filter(
          (t) => t.status === "ONGOING"
        ).length;
        const pendingTaskCount = tasksForDevice.filter(
          (t) => t.status === "PENDING"
        ).length;
        const totalWorkload = tasksForDevice.length;

        return {
          deviceId: device._id,
          deviceName: device.name,
          status: device.status,
          tasks: tasksForDevice.map((t) => ({
            taskId: t._id,
            taskName: t.title,
            status: t.status,
            assignedWorker: t.workerId
              ? {
                  workerId: (t.workerId as any)._id,
                  workerName: (t.workerId as any).name
                }
              : null,
            progress: t.progress,
            startTime: t.startedAt,
            estimatedEndTime: t.estimatedDuration
              ? new Date(
                  new Date(t.startedAt || new Date()).getTime() +
                    t.estimatedDuration
                )
              : null,
            priority: t.priority
          })),
          activeTaskCount,
          pendingTaskCount,
          totalWorkload
        };
      })
    );

    // Sort based on sortBy parameter
    const sorted = [...deviceWithTasks].sort((a, b) => {
      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      } else if (sortBy === "name") {
        return a.deviceName.localeCompare(b.deviceName);
      } else {
        // default: workload
        return b.totalWorkload - a.totalWorkload;
      }
    });

    const totalDevices = sorted.length;
    const totalTasks = sorted.reduce((sum, d) => sum + d.totalWorkload, 0);

    const response: APIResponse = {
      success: true,
      message: "Devices with tasks retrieved successfully",
      data: {
        items: sorted,
        meta: {
          totalDevices,
          totalTasks
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get devices by task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get Devices Monitor Data for Grid Layout
 * Retrieves device monitoring information for a specific grid layout, including device status,
 * current tasks, and user assignments. Used for real-time dashboard monitoring.
 *
 * @route GET /api/devices/monitor-layout/:id
 * @param id - Grid layout ID from URL parameters
 * @returns Grid layout with populated device data and status summary
 */
export const getDevicesMonitorData = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    // Step 1: Fetch the grid layout and deeply populate all device information
    // This includes device details, device types, current tasks, and assigned users
    const gridLayout = await GridLayout.findById(id).populate({
      path: "devices.deviceId",
      populate: [
        {
          path: "deviceType",
          select: "name"
        },
        {
          path: "currentTask",
          select: "title status startedAt"
        },
        {
          path: "currentUser",
          select: "name username"
        }
      ]
    });

    if (!gridLayout) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Grid layout not found"
      };
      res.status(404).json(response);
      return;
    }

    // Step 2: Calculate device status summary for dashboard overview
    const summary = {
      totalDevices: gridLayout.devices.length,
      onlineDevices: gridLayout.devices.filter(
        (d) => d.deviceId && (d.deviceId as any).status === "ONLINE"
      ).length,
      offlineDevices: gridLayout.devices.filter(
        (d) => d.deviceId && (d.deviceId as any).status === "OFFLINE"
      ).length,
      maintenanceDevices: gridLayout.devices.filter(
        (d) => d.deviceId && (d.deviceId as any).status === "MAINTENANCE"
      ).length,
      errorDevices: gridLayout.devices.filter(
        (d) => d.deviceId && (d.deviceId as any).status === "ERROR"
      ).length
    };

    // Step 3: Return the complete monitoring data
    const response: APIResponse = {
      success: true,
      message: "Devices monitor data retrieved successfully",
      data: {
        layout: gridLayout, // Full grid layout with populated device data
        summary // Status counts for quick overview
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get devices monitor data error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
