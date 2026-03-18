import mongoose from "mongoose";
import { Device, DeviceDocument } from "./device.model";
import {
  DeviceDTO,
  DeviceUpdateDTO,
  DeviceFilters,
  DeviceStatisticsFilters,
  DevicesByTaskFilters,
  DeviceStatistics,
  DeviceWithTasks
} from "./device.types";

export class DeviceService {
  async list(filters: DeviceFilters = {}) {
    const { status, page = 1, limit = 10 } = filters;

    const query: any = {};
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const total = await Device.countDocuments(query);
    const items = await Device.find(query)
      .setOptions({ includeDeleted: false })
      .populate("deviceType", "_id name")
      .populate("currentUser", "_id name username")
      .populate("currentTask", "_id title status progress")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async getById(id: string): Promise<DeviceDocument | null> {
    return Device.findById(id).setOptions({ includeDeleted: false });
  }

  async create(data: DeviceDTO): Promise<DeviceDocument> {
    const device = new Device({
      ...data,
      lastHeartbeat: new Date()
    });
    return device.save();
  }

  async update(
    id: string,
    data: DeviceUpdateDTO,
    userId?: mongoose.Types.ObjectId,
    userName?: string
  ): Promise<DeviceDocument | null> {
    const device = await Device.findById(id).setOptions({ includeDeleted: false });
    if (!device) return null;

    if (data.deviceTypeId) {
      device.deviceTypeId = data.deviceTypeId as any;
    }

    if (data.name) {
      device.name = data.name;
    }

    const statusChanged = !!(data.status && data.status !== device.status);
    if (statusChanged) {
      const previousStatus = device.status;
      device.status = data.status!;

      if (!device.statusHistory) {
        device.statusHistory = [];
      }
      device.statusHistory.push({
        status: data.status!,
        changedAt: new Date(),
        reason:
          data.statusChangeReason ||
          data.errorReason ||
          `Status changed from ${previousStatus} to ${data.status}`,
        changedBy: userName || "System"
      });

      device.lastHeartbeat = new Date();
    }

    if (data.errorReason !== undefined) {
      device.errorReason = data.errorReason || undefined;
    }

    if (data.ipAddress) device.ipAddress = data.ipAddress;
    if (data.config) device.config = data.config;

    if (data.currentUser !== undefined) {
      if (data.currentUser === null) {
        device.currentUser = undefined;
      } else {
        device.currentUser = data.currentUser as any;
      }
    }

    if (userId) {
      device.modifiedBy = userId;
    }

    return device.save();
  }

  async softDelete(id: string): Promise<DeviceDocument | null> {
    return Device.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }

  async checkDuplicateName(name: string, excludeId?: string): Promise<boolean> {
    const query: any = { name };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const existing = await Device.findOne(query).setOptions({ includeDeleted: false });
    return !!existing;
  }

  async getStatistics(filters: DeviceStatisticsFilters = {}): Promise<{
    items: DeviceStatistics[];
    summary: {
      totalDevices: number;
      onlineCount: number;
      offlineCount: number;
      avgUtilization: number;
      avgHealthScore: number;
    };
  }> {
    const { timeRange = "daily", status: statusFilter, limit = 100 } = filters;

    const now = new Date();
    let startDate = new Date();

    if (timeRange === "weekly") {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === "monthly") {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      startDate.setDate(now.getDate() - 1);
    }

    const deviceQuery: any = {};
    if (statusFilter) deviceQuery.status = statusFilter;

    const devices = await Device.find(deviceQuery)
      .limit(limit)
      .populate("deviceType", "name")
      .setOptions({ includeDeleted: false });

    const Task = mongoose.model("Task");

    const deviceStats = await Promise.all(
      devices.map(async (device) => {
        const allTasks = await Task.find({
          deviceId: device._id,
          createdAt: { $gte: startDate, $lte: now }
        });

        const activeTasks = allTasks.filter((t: any) => t.status === "ONGOING");
        const completedTasks = allTasks.filter((t: any) => t.status === "COMPLETED");
        const failedTasks = allTasks.filter((t: any) => t.status === "FAILED");

        const workload = activeTasks.length;
        const totalTasks = allTasks.length;
        const failureCount = failedTasks.length;
        const failureRate = totalTasks > 0 ? (failureCount / totalTasks) * 100 : 0;

        const completedDurations = completedTasks
          .filter((t: any) => t.actualDuration)
          .map((t: any) => t.actualDuration || 0);
        const avgTaskDuration =
          completedDurations.length > 0
            ? completedDurations.reduce((a: number, b: number) => a + b, 0) /
              completedDurations.length
            : 0;

        const efficiency = totalTasks > 0 ? ((totalTasks - failureCount) / totalTasks) * 100 : 0;

        const onlineTasks = allTasks.filter((t: any) => t.status !== "FAILED");
        const uptime = totalTasks > 0 ? (onlineTasks.length / totalTasks) * 100 : 100;

        const maxCapacity = 5;
        const utilization = Math.min((workload / maxCapacity) * 100, 100);

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

    const totalDevices = deviceStats.length;
    const onlineCount = deviceStats.filter((d) => d.status === "ONLINE").length;
    const offlineCount = deviceStats.filter((d) => d.status === "OFFLINE").length;
    const avgUtilization =
      totalDevices > 0
        ? deviceStats.reduce((sum, d) => sum + d.utilization, 0) / totalDevices
        : 0;
    const avgHealthScore =
      totalDevices > 0
        ? deviceStats.reduce((sum, d) => sum + d.healthScore, 0) / totalDevices
        : 0;

    return {
      items: deviceStats,
      summary: {
        totalDevices,
        onlineCount,
        offlineCount,
        avgUtilization: Math.round(avgUtilization),
        avgHealthScore: Math.round(avgHealthScore)
      }
    };
  }

  async getDevicesByTask(filters: DevicesByTaskFilters = {}): Promise<{
    items: DeviceWithTasks[];
    meta: {
      totalDevices: number;
      totalTasks: number;
    };
  }> {
    const { status: taskStatusFilter, limit = 50, sortBy = "workload" } = filters;

    const taskQuery: any = {};
    if (taskStatusFilter) {
      if (taskStatusFilter === "IN_PROGRESS") {
        taskQuery.status = "ONGOING";
      } else if (taskStatusFilter === "PENDING") {
        taskQuery.status = "PENDING";
      } else if (taskStatusFilter === "COMPLETED") {
        taskQuery.status = "COMPLETED";
      }
    }

    const devices = await Device.find({})
      .limit(limit)
      .populate("deviceType", "name")
      .setOptions({ includeDeleted: false });

    const Task = mongoose.model("Task");

    const deviceWithTasks = await Promise.all(
      devices.map(async (device) => {
        let tasksForDevice = await Task.find({
          deviceId: device._id
        })
          .populate("workerId", "name username")
          .populate("recipeId", "name")
          .select(
            "_id title status progress startedAt estimatedDuration priority workerId recipeId"
          );

        if (taskStatusFilter) {
          tasksForDevice = tasksForDevice.filter((t: any) => {
            if (taskStatusFilter === "IN_PROGRESS" && t.status === "ONGOING") {
              return true;
            } else if (taskStatusFilter === "PENDING" && t.status === "PENDING") {
              return true;
            } else if (taskStatusFilter === "COMPLETED" && t.status === "COMPLETED") {
              return true;
            }
            return false;
          });
        }

        const activeTaskCount = tasksForDevice.filter((t: any) => t.status === "ONGOING").length;
        const pendingTaskCount = tasksForDevice.filter((t: any) => t.status === "PENDING").length;
        const totalWorkload = tasksForDevice.length;

        return {
          deviceId: device._id,
          deviceName: device.name,
          status: device.status,
          tasks: tasksForDevice.map((t: any) => ({
            taskId: t._id,
            taskName: t.title,
            status: t.status,
            assignedWorker: t.workerId
              ? {
                  workerId: t.workerId._id,
                  workerName: t.workerId.name
                }
              : null,
            progress: t.progress,
            startTime: t.startedAt,
            estimatedEndTime: t.estimatedDuration
              ? new Date(new Date(t.startedAt || new Date()).getTime() + t.estimatedDuration)
              : null,
            priority: t.priority
          })),
          activeTaskCount,
          pendingTaskCount,
          totalWorkload
        };
      })
    );

    const sorted = [...deviceWithTasks].sort((a, b) => {
      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      } else if (sortBy === "name") {
        return a.deviceName.localeCompare(b.deviceName);
      } else {
        return b.totalWorkload - a.totalWorkload;
      }
    });

    const totalDevices = sorted.length;
    const totalTasks = sorted.reduce((sum, d) => sum + d.totalWorkload, 0);

    return {
      items: sorted,
      meta: {
        totalDevices,
        totalTasks
      }
    };
  }

  async setCurrentUser(
    deviceId: string,
    userId: mongoose.Types.ObjectId
  ): Promise<DeviceDocument | null> {
    const device = await Device.findById(deviceId).setOptions({ includeDeleted: false });
    if (!device) return null;

    device.currentUser = userId;
    return device.save();
  }

  async clearCurrentUser(deviceId: string): Promise<DeviceDocument | null> {
    const device = await Device.findById(deviceId).setOptions({ includeDeleted: false });
    if (!device) return null;

    device.currentUser = undefined;
    device.currentTask = undefined;
    return device.save();
  }
}

export const deviceService = new DeviceService();
