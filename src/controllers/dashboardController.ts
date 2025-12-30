import { Request, Response } from "express";
import { Task } from "../models/Task";
import { Alert } from "../models/Alert";
import { Device } from "../models/Device";
import { User } from "../models/User";
import { APIResponse } from "../types";

/**
 * GET /api/dashboard/monitor-overview
 * Get aggregated metrics for Monitor TV display
 * 
 * All task-related metrics are based on the LAST 24 HOURS for real-time monitoring
 */
export const getMonitorOverview = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const now = new Date();
    
    // Time boundaries
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get days in current month for proper percentage calculation
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Sunday = 7

    // Run all queries in parallel
    const [
      // 전체 작업 진행률 (24-hour based)
      totalTasksLast24h,
      completedTasksLast24h,
      pendingTasksLast24h,
      
      // 납기준수율 (24-hour based)
      onTimeTasksLast24h,
      tasksDueLast24h,
      urgentTasks,
      
      // 생산성 현황 - Daily (tasks created/due today)
      dailyCompletedTasks,
      dailyTotalTasks,
      
      // 생산성 현황 - Weekly
      weeklyCompletedTasks,
      weeklyTotalTasks,
      
      // 생산성 현황 - Monthly
      monthlyCompletedTasks,
      monthlyTotalTasks,

      // Equipment Utilization (real-time)
      totalDevices,
      onlineDevices,
      offlineDevices,
      maintenanceDevices,
      errorDevices,

      // Workers (real-time)
      totalWorkers,
      activeWorkers,

      // Alert Summary
      allAlerts,
      resolvedAlerts,
      
      // Top 5 Devices with Most Alerts (에러 현황)
      topDevicesWithAlerts
    ] = await Promise.all([
      // 전체 작업 진행률 - 24-hour based
      Task.countDocuments({
        $or: [
          { createdAt: { $gte: last24Hours } },
          { updatedAt: { $gte: last24Hours } }
        ]
      }),
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: last24Hours }
      }),
      Task.countDocuments({
        status: "PENDING",
        $or: [
          { createdAt: { $gte: last24Hours } },
          { updatedAt: { $gte: last24Hours } }
        ]
      }),

      // 납기준수율 - Tasks that were due in last 24h and completed on time
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: last24Hours },
        deadline: { $exists: true },
        $expr: { $lte: ["$completedAt", "$deadline"] }
      }),
      // Tasks that had deadline in last 24h or were completed in last 24h
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: last24Hours }
      }),

      // Urgent tasks (not completed AND deadline within next 24 hours or past)
      Task.countDocuments({
        status: { $ne: "COMPLETED" },
        deadline: {
          $exists: true,
          $lt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      }),

      // 생산성 일간 - Today
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: startOfDay }
      }),
      Task.countDocuments({
        $or: [
          { createdAt: { $gte: startOfDay } },
          { deadline: { $gte: startOfDay, $lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000) } }
        ]
      }),

      // 생산성 주간 - This week
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: startOfWeek }
      }),
      Task.countDocuments({
        $or: [
          { createdAt: { $gte: startOfWeek } },
          { deadline: { $gte: startOfWeek, $lt: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000) } }
        ]
      }),

      // 생산성 월간 - This month
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: startOfMonth }
      }),
      Task.countDocuments({
        $or: [
          { createdAt: { $gte: startOfMonth } },
          { deadline: { $gte: startOfMonth, $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) } }
        ]
      }),

      // Equipment Utilization (real-time)
      Device.countDocuments({}),
      Device.countDocuments({ status: "ONLINE" }),
      Device.countDocuments({ status: "OFFLINE" }),
      Device.countDocuments({ status: "MAINTENANCE" }),
      Device.countDocuments({ status: "ERROR" }),

      // Workers - count non-deleted, active workers
      User.countDocuments({ role: "worker", isActive: true, deletedAt: null }),
      Device.countDocuments({
        status: "ONLINE",
        currentUser: { $exists: true, $ne: null }
      }),

      // Alert Summary
      Alert.countDocuments({}),
      Alert.countDocuments({ status: "RESOLVED" }),

      // Top 5 Devices with Most Alerts (for 에러 현황 bar graph)
      Alert.aggregate([
        {
          $match: {
            deviceId: { $exists: true, $ne: null }
          }
        },
        {
          $lookup: {
            from: "devices",
            localField: "deviceId",
            foreignField: "_id",
            as: "device"
          }
        },
        { $unwind: "$device" },
        {
          $lookup: {
            from: "devicetypes",
            localField: "device.deviceTypeId",
            foreignField: "_id",
            as: "deviceType"
          }
        },
        { $unwind: { path: "$deviceType", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$device._id",
            deviceName: { $first: "$device.name" },
            deviceTypeName: { $first: "$deviceType.name" },
            alertCount: { $sum: 1 }
          }
        },
        { $sort: { alertCount: -1 } },
        { $limit: 5 }
      ])
    ]);

    // Calculate percentages
    const taskProgressPercentage =
      totalTasksLast24h > 0 ? Math.round((completedTasksLast24h / totalTasksLast24h) * 100) : 0;
    
    const deadlineCompliancePercentage =
      tasksDueLast24h > 0 ? Math.round((onTimeTasksLast24h / tasksDueLast24h) * 100) : 0;

    // Productivity percentages (based on total tasks, not fixed targets)
    const dailyTotal = Math.max(1, dailyTotalTasks);
    const weeklyTotal = Math.max(1, weeklyTotalTasks);
    const monthlyTotal = Math.max(1, monthlyTotalTasks);
    
    const dailyPercentage = Math.round((dailyCompletedTasks / dailyTotal) * 100);
    const weeklyPercentage = Math.round((weeklyCompletedTasks / weeklyTotal) * 100);
    const monthlyPercentage = Math.round((monthlyCompletedTasks / monthlyTotal) * 100);

    // Equipment utilization
    const equipmentUtilizationPercentage =
      totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0;

    // Worker capacity (can be configured or stored in DB)
    const workerCapacity = 10;
    const workerPercentage =
      workerCapacity > 0 ? Math.round((totalWorkers / workerCapacity) * 100) : 0;
    const idleWorkers = totalWorkers - activeWorkers;

    // Alert summary calculations
    const pendingAlerts = await Alert.countDocuments({ status: "PENDING" });
    const inProgressAlerts = await Alert.countDocuments({ status: "ACKNOWLEDGED" });
    const avgResponseTimeMinutes = 12; // TODO: Calculate from actual alert response times
    const resolutionRate =
      allAlerts > 0 ? Math.round((resolvedAlerts / allAlerts) * 100) : 0;

    // Process top 5 devices with alerts for bar graph
    const maxAlertCount = topDevicesWithAlerts.length > 0 
      ? Math.max(...topDevicesWithAlerts.map((d: any) => d.alertCount))
      : 0;
    
    const topDeviceErrors = topDevicesWithAlerts.map((item: any) => {
      const deviceName = item.deviceName || "Unknown Device";
      const deviceTypeName = item.deviceTypeName || "Unknown Type";
      // Format: "장비명(장비타입)"
      const displayName = `${deviceName}(${deviceTypeName})`;
      return {
        deviceName: displayName,
        alertCount: item.alertCount,
        percentage: maxAlertCount > 0 ? Math.round((item.alertCount / maxAlertCount) * 100) : 0
      };
    });

    const response: APIResponse = {
      success: true,
      message: "Monitor overview data retrieved successfully",
      data: {
        taskProgress: {
          percentage: taskProgressPercentage,
          completed: completedTasksLast24h,
          total: totalTasksLast24h,
          pending: pendingTasksLast24h
        },
        deadlineCompliance: {
          percentage: deadlineCompliancePercentage,
          onTime: onTimeTasksLast24h,
          total: tasksDueLast24h,
          urgent: urgentTasks
        },
        productivity: {
          daily: {
            current: dailyCompletedTasks,
            target: dailyTotal, // Now using actual total tasks, not fixed target
            percentage: dailyPercentage
          },
          weekly: {
            current: weeklyCompletedTasks,
            target: weeklyTotal, // Now using actual total tasks, not fixed target
            percentage: weeklyPercentage
          },
          monthly: {
            current: monthlyCompletedTasks,
            target: monthlyTotal, // Now using actual total tasks, not fixed target
            percentage: monthlyPercentage
          }
        },
        // Top 5 devices with most alerts (for bar graph)
        topDeviceErrors: topDeviceErrors,
        errors: {
          categories: [], // Kept for backward compatibility
          total: allAlerts
        },
        equipmentUtilization: {
          percentage: equipmentUtilizationPercentage,
          online: onlineDevices,
          offline: offlineDevices,
          maintenance: maintenanceDevices,
          error: errorDevices,
          total: totalDevices
        },
        workers: {
          current: totalWorkers,
          capacity: workerCapacity,
          percentage: workerPercentage,
          active: activeWorkers,
          idle: idleWorkers
        },
        alerts: {
          total: allAlerts,
          unconfirmed: pendingAlerts,
          inProgress: inProgressAlerts,
          resolved: resolvedAlerts,
          avgResponseTime: avgResponseTimeMinutes,
          resolutionRate: resolutionRate
        },
        // Additional context info
        periodInfo: {
          daysInMonth: daysInMonth,
          dayOfMonth: dayOfMonth,
          dayOfWeek: dayOfWeek
        },
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get monitor overview error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve monitor overview data"
    };
    res.status(500).json(response);
  }
};

/**
 * GET /api/dashboard/task-status-distribution
 * Get task count by status for donut chart
 */
export const getTaskStatusDistribution = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const distribution = await Task.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const total = distribution.reduce((sum, item) => sum + item.count, 0);

    const formattedDistribution = distribution.map((item) => ({
      status: item._id,
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
    }));

    const response: APIResponse = {
      success: true,
      message: "Task status distribution retrieved successfully",
      data: {
        total,
        distribution: formattedDistribution
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get task status distribution error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve task status distribution"
    };
    res.status(500).json(response);
  }
};
