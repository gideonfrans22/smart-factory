import { Request, Response } from "express";
import { Task } from "../models/Task";
import { Alert } from "../models/Alert";
import { Device } from "../models/Device";
import { User } from "../models/User";
import { APIResponse } from "../types";

/**
 * GET /api/dashboard/monitor-overview
 * Get aggregated metrics for Monitor TV display
 */
export const getMonitorOverview = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel
    const [
      totalTasks,
      completedTasks,
      pendingTasks,
      onTimeTasks,
      totalDeliveredTasks,
      urgentTasks,
      dailyCompletedTasks,
      weeklyCompletedTasks,
      monthlyCompletedTasks,
      alertsByType,
      totalDevices,
      onlineDevices,
      offlineDevices,
      maintenanceDevices,
      errorDevices,
      totalWorkers,
      activeWorkers,
      allAlerts,
      resolvedAlerts,
      deviceErrorsByType
    ] = await Promise.all([
      // Task Progress
      Task.countDocuments({}),
      Task.countDocuments({ status: "COMPLETED" }),
      Task.countDocuments({ status: "PENDING" }),
      
      // Deadline Compliance (completed tasks where completedAt <= deadline)
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $exists: true },
        deadline: { $exists: true },
        $expr: { $lte: ["$completedAt", "$deadline"] }
      }),
      Task.countDocuments({ status: "COMPLETED" }),
      
      // Urgent tasks (status !== COMPLETED AND deadline approaching/past - within 24 hours or overdue)
      Task.countDocuments({
        status: { $ne: "COMPLETED" },
        deadline: { $exists: true, $lt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
      }),
      
      // Productivity by period
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: startOfDay }
      }),
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: startOfWeek }
      }),
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: startOfMonth }
      }),
      
      // Alerts grouped by type
      Alert.aggregate([
        { $match: { status: "PENDING" } },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Equipment Utilization
      Device.countDocuments({}),
      Device.countDocuments({ status: "ONLINE" }),
      Device.countDocuments({ status: "OFFLINE" }),
      Device.countDocuments({ status: "MAINTENANCE" }),
      Device.countDocuments({ status: "ERROR" }),
      
      // Workers
      User.countDocuments({ role: "WORKER", isActive: true }),
      Device.countDocuments({ status: "ONLINE", currentUser: { $exists: true, $ne: null } }),
      
      // Alert Summary
      Alert.countDocuments({}),
      Alert.countDocuments({ status: "RESOLVED" }),
      
      // Device errors by type
      Alert.aggregate([
        {
          $match: {
            deviceId: { $exists: true },
            type: { $in: ["EQUIPMENT_FAILURE", "DEVICE_ERROR", "MAINTENANCE_REQUIRED"] }
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
        { $unwind: "$deviceType" },
        {
          $group: {
            _id: "$deviceType.name",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    // Calculate percentages and metrics
    const taskProgressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const deadlineCompliancePercentage = totalDeliveredTasks > 0 
      ? Math.round((onTimeTasks / totalDeliveredTasks) * 100) 
      : 0;
    
    // Productivity targets (can be configured or stored in DB)
    const dailyTarget = 50;
    const weeklyTarget = 100;
    const monthlyTarget = 150;
    
    const dailyPercentage = dailyTarget > 0 ? Math.round((dailyCompletedTasks / dailyTarget) * 100) : 0;
    const weeklyPercentage = weeklyTarget > 0 ? Math.round((weeklyCompletedTasks / weeklyTarget) * 100) : 0;
    const monthlyPercentage = monthlyTarget > 0 ? Math.round((monthlyCompletedTasks / monthlyTarget) * 100) : 0;
    
    // Equipment utilization
    const equipmentUtilizationPercentage = totalDevices > 0 
      ? Math.round((onlineDevices / totalDevices) * 100) 
      : 0;
    
    // Worker capacity (can be configured or stored in DB)
    const workerCapacity = 10;
    const workerPercentage = workerCapacity > 0 
      ? Math.round((totalWorkers / workerCapacity) * 100) 
      : 0;
    const idleWorkers = totalWorkers - activeWorkers;
    
    // Alert summary calculations
    const pendingAlerts = await Alert.countDocuments({ status: "PENDING" });
    const inProgressAlerts = await Alert.countDocuments({ status: "ACKNOWLEDGED" });
    const avgResponseTimeMinutes = 12; // TODO: Calculate from actual alert response times
    const resolutionRate = allAlerts > 0 
      ? Math.round((resolvedAlerts / allAlerts) * 100) 
      : 0;
    
    // Process error categories with Korean labels
    const errorTypeMap: Record<string, string> = {
      "EQUIPMENT_FAILURE": "장비결함",
      "MATERIAL_DEFECT": "소재불량",
      "CONTROL_ERROR": "통제인지",
      "QUALITY_ISSUE": "품질이슈",
      "MAINTENANCE_REQUIRED": "정비필요"
    };
    
    const totalAlertCount = alertsByType.reduce((sum: number, item: any) => sum + item.count, 0);
    const errorCategories = alertsByType.map((item: any) => ({
      name: errorTypeMap[item._id] || item._id,
      count: item.count,
      percentage: totalAlertCount > 0 
        ? Math.round((item.count / totalAlertCount) * 100) 
        : 0
    }));
    
    // Add "기타" (Others) if there are other alert types
    const categorizedCount = errorCategories.reduce((sum, cat) => sum + cat.count, 0);
    const otherCount = totalAlertCount - categorizedCount;
    if (otherCount > 0) {
      errorCategories.push({
        name: "기타",
        count: otherCount,
        percentage: Math.round((otherCount / totalAlertCount) * 100)
      });
    }
    
    // Process device error frequency
    const totalDeviceErrors = deviceErrorsByType.reduce((sum: any, item: any) => sum + item.count, 0);
    const deviceErrorFrequency = deviceErrorsByType.map((item: any) => ({
      deviceTypeName: item._id,
      errorCount: item.count,
      percentage: totalDeviceErrors > 0 
        ? Math.round((item.count / totalDeviceErrors) * 100) 
        : 0
    }));

    const response: APIResponse = {
      success: true,
      message: "Monitor overview data retrieved successfully",
      data: {
        taskProgress: {
          percentage: taskProgressPercentage,
          completed: completedTasks,
          total: totalTasks,
          pending: pendingTasks
        },
        deadlineCompliance: {
          percentage: deadlineCompliancePercentage,
          onTime: onTimeTasks,
          total: totalDeliveredTasks,
          urgent: urgentTasks
        },
        productivity: {
          daily: {
            current: dailyCompletedTasks,
            target: dailyTarget,
            percentage: dailyPercentage
          },
          weekly: {
            current: weeklyCompletedTasks,
            target: weeklyTarget,
            percentage: weeklyPercentage
          },
          monthly: {
            current: monthlyCompletedTasks,
            target: monthlyTarget,
            percentage: monthlyPercentage
          }
        },
        errors: {
          categories: errorCategories,
          total: totalAlertCount
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
        deviceErrorFrequency: deviceErrorFrequency,
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
