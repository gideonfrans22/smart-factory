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
      dailyPendingFromPrevious,
      
      // 생산성 현황 - Weekly
      weeklyCompletedTasks,
      weeklyTotalTasks,
      weeklyPendingFromPrevious,
      
      // 생산성 현황 - Monthly
      monthlyCompletedTasks,
      monthlyTotalTasks,
      monthlyPendingFromPrevious,

      // Equipment Utilization (real-time)
      totalDevices,
      onlineDevices,
      offlineDevices,
      maintenanceDevices,
      errorDevices,

      // Workers (real-time)
      totalWorkers,
      activeWorkers,

      // Alert Summary (24h filtered)
      allAlerts,
      resolvedAlerts,
      highPriorityAlerts,
      totalAlerts24h, // NEW: All alerts created in 24h for resolution rate
      
      // Top 5 Devices with Most Alerts (for 설비 현황 page - 3페이지)
      topDevicesWithAlerts,
      
      // Top 5 Error Types (for 전체 현황 page - 1페이지)
      topErrorTypes
    ] = await Promise.all([
      // 전체 작업 진행률:
      // - 전체 작업 수 = (미완료 작업 실시간) + (24시간 내 완료된 작업)
      // - 완료 작업 수 = 24시간 내 완료된 작업
      
      // Count of NOT completed tasks (real-time - PENDING, ONGOING, etc.)
      Task.countDocuments({
        status: { $nin: ["COMPLETED", "CANCELLED"] }
      }),
      // Count of tasks completed in last 24 hours
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: last24Hours }
      }),
      // Count of PENDING tasks (real-time)
      Task.countDocuments({
        status: "PENDING"
      }),

      // 납기준수율 - Deadline Compliance Rate
      // Numerator: Tasks that had deadline in last 24h AND were completed ON TIME (before deadline)
      Task.countDocuments({
        deadline: { $gte: last24Hours, $lte: now },
        status: "COMPLETED",
        $expr: { $lte: ["$completedAt", "$deadline"] }
      }),
      // Denominator: ALL tasks that had deadline in last 24h (regardless of completion status)
      Task.countDocuments({
        deadline: { $gte: last24Hours, $lte: now }
      }),

      // Urgent tasks (not completed AND deadline within next 24 hours or past)
      Task.countDocuments({
        status: { $ne: "COMPLETED" },
        deadline: {
          $exists: true,
          $lt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      }),

      // 생산성 일간 - Daily: completed in last 24h / (assigned in last 24h + pending backlog)
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: last24Hours }
      }),
      // Target = today's new tasks + backlog (not completed tasks created before today)
      Task.countDocuments({
        $or: [
          { createdAt: { $gte: last24Hours } }, // Tasks created today
          { 
            createdAt: { $lt: last24Hours },    // Tasks created before today
            status: { $nin: ["COMPLETED", "CANCELLED"] } // That are still not completed
          }
        ]
      }),
      // Pending from previous period (daily): tasks created >24h ago, still not completed
      Task.countDocuments({
        createdAt: { $lt: last24Hours },
        status: { $nin: ["COMPLETED", "CANCELLED"] }
      }),

      // 생산성 주간 - Weekly: completed in last 7 days / (assigned in last 7 days + pending backlog)
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
      }),
      // Target = this week's tasks + backlog
      Task.countDocuments({
        $or: [
          { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
          { 
            createdAt: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
            status: { $nin: ["COMPLETED", "CANCELLED"] }
          }
        ]
      }),
      // Pending from previous period (weekly): tasks created >7 days ago, still not completed
      Task.countDocuments({
        createdAt: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        status: { $nin: ["COMPLETED", "CANCELLED"] }
      }),

      // 생산성 월간 - Monthly: completed in last 30 days / (assigned in last 30 days + pending backlog)
      Task.countDocuments({
        status: "COMPLETED",
        completedAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
      }),
      // Target = this month's tasks + backlog
      Task.countDocuments({
        $or: [
          { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
          { 
            createdAt: { $lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            status: { $nin: ["COMPLETED", "CANCELLED"] }
          }
        ]
      }),
      // Pending from previous period (monthly): tasks created >30 days ago, still not completed
      Task.countDocuments({
        createdAt: { $lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        status: { $nin: ["COMPLETED", "CANCELLED"] }
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

      // Alert Summary - 24 hour filtered for monitor TV
      // 활성 알림 = UNREAD + PENDING only (realtime, no 24h filter)
      Alert.countDocuments({ status: { $in: ["UNREAD", "PENDING"] } }), // 활성 알림
      Alert.countDocuments({ status: "RESOLVED", resolvedAt: { $gte: last24Hours } }), // resolved in 24h
      Alert.countDocuments({ level: { $in: ["HIGH", "CRITICAL"] }, status: { $ne: "RESOLVED" }, createdAt: { $gte: last24Hours } }), // high priority active in 24h
      // 해결률 = resolved_24h / total_created_24h × 100
      // total_created_24h = ALL alerts created in last 24 hours (any status)
      Alert.countDocuments({ createdAt: { $gte: last24Hours } }),

      // Top 5 Devices with Most Alerts in Last 24 Hours (for 에러 현황 bar graph)
      Alert.aggregate([
        {
          $match: {
            device: { $exists: true, $ne: null },  // Fixed: use 'device' not 'deviceId'
            createdAt: { $gte: last24Hours } // ✅ Filter last 24 hours only
          }
        },
        {
          $lookup: {
            from: "devices",
            localField: "device",  // Fixed: use 'device' not 'deviceId'
            foreignField: "_id",
            as: "deviceInfo"
          }
        },
        { $unwind: "$deviceInfo" },
        {
          $lookup: {
            from: "devicetypes",
            localField: "deviceInfo.deviceTypeId",
            foreignField: "_id",
            as: "deviceType"
          }
        },
        { $unwind: { path: "$deviceType", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$deviceInfo._id",
            deviceName: { $first: "$deviceInfo.name" },
            deviceTypeName: { $first: "$deviceType.name" },
            alertCount: { $sum: 1 } // Count alerts in last 24 hours
          }
        },
        { $sort: { alertCount: -1 } },
        { $limit: 5 }
      ]),
      
      // Top 5 Error Types in Last 24 Hours (for 전체 현황 page)
      Alert.aggregate([
        {
          $match: {
            createdAt: { $gte: last24Hours }
          }
        },
        {
          $group: {
            _id: "$type",
            alertCount: { $sum: 1 }
          }
        },
        { $sort: { alertCount: -1 } },
        { $limit: 5 }
      ])
    ]);

    // Calculate 전체 작업 진행률:
    // - 전체 작업 수 = 미완료 작업 실시간 수 (완료되면 줄어듦)
    // - 완료 작업 수 = 24시간 내 완료된 작업 수
    // - 진행률 = 완료 / 전체 * 100%
    // Note: totalTasksLast24h is now "not completed tasks count (real-time)"
    const notCompletedTasks = totalTasksLast24h; // 미완료 작업 수 (실시간)
    const totalTasksForProgress = notCompletedTasks; // 전체 = 미완료 작업 수
    const taskProgressPercentage =
      totalTasksForProgress > 0 ? Math.round((completedTasksLast24h / totalTasksForProgress) * 100) : 0;
    
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

    // Alert summary calculations - 24h filtered
    const pendingAlerts24h = await Alert.countDocuments({ 
      status: "PENDING",
      createdAt: { $gte: last24Hours }
    });
    const inProgressAlerts24h = await Alert.countDocuments({ 
      status: "ACKNOWLEDGED",
      createdAt: { $gte: last24Hours }
    });
    const avgResponseTimeMinutes = 12; // TODO: Calculate from actual alert response times
    
    // Resolution Rate: 해결률 = resolved_24h / total_created_24h × 100
    // - totalAlerts24h: All alerts CREATED in last 24 hours (any status)
    // - resolvedAlerts: Alerts RESOLVED in last 24 hours
    // If no alerts created in 24h, show 100% (nothing to resolve)
    const resolutionRate =
      totalAlerts24h > 0 ? Math.round((resolvedAlerts / totalAlerts24h) * 100) : 100;

    // Process top 5 devices with alerts for bar graph
    // ✅ Filtered to last 24 hours in aggregation pipeline above
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

    // Process top 5 error types for bar graph (1페이지 전체 현황)
    const ERROR_TYPE_LABELS: Record<string, string> = {
      "ERROR": "일반 에러",
      "WARNING": "경고",
      "EMERGENCY": "긴급",
      "DEFECT": "불량",
      "MACHINE_ERROR": "장비 에러",
      "INFO": "정보"
    };
    
    const maxErrorTypeCount = topErrorTypes.length > 0 
      ? Math.max(...topErrorTypes.map((d: any) => d.alertCount))
      : 0;
    
    const topErrorTypesList = topErrorTypes.map((item: any) => {
      const typeName = ERROR_TYPE_LABELS[item._id] || item._id || "Unknown";
      return {
        errorType: item._id,
        errorTypeName: typeName,
        alertCount: item.alertCount,
        percentage: maxErrorTypeCount > 0 ? Math.round((item.alertCount / maxErrorTypeCount) * 100) : 0
      };
    });

    const response: APIResponse = {
      success: true,
      message: "Monitor overview data retrieved successfully",
      data: {
        taskProgress: {
          percentage: taskProgressPercentage,
          completed: completedTasksLast24h,
          total: totalTasksForProgress, // (미완료 실시간) + (24시간 완료)
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
            percentage: dailyPercentage,
            pendingFromPrevious: dailyPendingFromPrevious // 24시간 전에 아직 안 끝난 작업
          },
          weekly: {
            current: weeklyCompletedTasks,
            target: weeklyTotal, // Now using actual total tasks, not fixed target
            percentage: weeklyPercentage,
            pendingFromPrevious: weeklyPendingFromPrevious // 1주일 전에 아직 안 끝난 작업
          },
          monthly: {
            current: monthlyCompletedTasks,
            target: monthlyTotal, // Now using actual total tasks, not fixed target
            percentage: monthlyPercentage,
            pendingFromPrevious: monthlyPendingFromPrevious // 한달 전에 아직 안 끝난 작업
          }
        },
        // Top 5 devices with most alerts (for 설비 현황 page - 3페이지)
        deviceErrorFrequency: topDeviceErrors,
        // Top 5 error types (for 전체 현황 page - 1페이지)
        errorTypeFrequency: topErrorTypesList,
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
          total: allAlerts, // 24h alerts total
          highPriority: highPriorityAlerts, // HIGH + CRITICAL in 24h
          unconfirmed: pendingAlerts24h, // PENDING in 24h
          inProgress: inProgressAlerts24h, // ACKNOWLEDGED in 24h
          resolved: resolvedAlerts, // resolved in 24h
          averageResponseTime: avgResponseTimeMinutes, // Fixed field name for FE
          avgResponseTime: avgResponseTimeMinutes, // Keep for backward compat
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

/**
 * GET /api/dashboard/monitor-tasks
 * Get optimized task list for Monitor TV display
 * 
 * Optimized for performance:
 * - Server-side filtering (exclude old COMPLETED tasks)
 * - Flattened data structure (no deep populates)
 * - Limited to 100 tasks max
 */
export const getMonitorTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { limit = 100 } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 100, 200); // Cap at 200
    
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Use aggregation for optimized data fetching with flattened structure
    const tasks = await Task.aggregate([
      // Stage 1: Filter - exclude old COMPLETED tasks
      {
        $match: {
          $or: [
            { status: { $ne: "COMPLETED" } },
            { 
              status: "COMPLETED",
              $or: [
                { completedAt: { $gte: twentyFourHoursAgo } },
                { updatedAt: { $gte: twentyFourHoursAgo } }
              ]
            }
          ]
        }
      },
      // Stage 2: Sort by priority and creation date
      {
        $sort: { 
          status: 1, // PENDING/ONGOING first
          priority: -1, // URGENT first
          createdAt: -1 
        }
      },
      // Stage 3: Limit results
      { $limit: limitNum },
      // Stage 4: Lookup project data (lightweight)
      {
        $lookup: {
          from: "projects",
          localField: "projectId",
          foreignField: "_id",
          as: "project",
          pipeline: [
            { $project: { name: 1, targetQuantity: 1, deadline: 1 } }
          ]
        }
      },
      // Stage 5: Lookup product snapshot data
      {
        $lookup: {
          from: "productsnapshots",
          localField: "productSnapshotId",
          foreignField: "_id",
          as: "productSnapshot",
          pipeline: [
            { $project: { name: 1, productNumber: 1, customerName: 1, department: 1, personInCharge: 1 } }
          ]
        }
      },
      // Stage 6: Lookup product data (fallback)
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
          pipeline: [
            { $project: { productName: 1, designNumber: 1, customerName: 1, department: 1, personInCharge: 1 } }
          ]
        }
      },
      // Stage 7: Lookup recipe snapshot for step name
      {
        $lookup: {
          from: "recipesnapshots",
          localField: "recipeSnapshotId",
          foreignField: "_id",
          as: "recipeSnapshot",
          pipeline: [
            { $project: { name: 1, steps: 1 } }
          ]
        }
      },
      // Stage 8: Project flattened fields
      {
        $project: {
          _id: 1,
          title: 1,
          status: 1,
          priority: 1,
          progress: 1,
          deadline: 1,
          estimatedDuration: 1,
          actualDuration: 1,
          projectNumber: 1,
          stepOrder: 1,
          recipeExecutionNumber: 1,
          totalRecipeExecutions: 1,
          completedAt: 1,
          updatedAt: 1,
          createdAt: 1,
          // Flattened project fields
          projectName: { $arrayElemAt: ["$project.name", 0] },
          projectTargetQuantity: { $arrayElemAt: ["$project.targetQuantity", 0] },
          projectDeadline: { $arrayElemAt: ["$project.deadline", 0] },
          // Flattened product fields (from snapshot or product)
          productName: {
            $ifNull: [
              { $arrayElemAt: ["$productSnapshot.name", 0] },
              { $arrayElemAt: ["$product.productName", 0] }
            ]
          },
          productNumber: {
            $ifNull: [
              { $arrayElemAt: ["$productSnapshot.productNumber", 0] },
              { $arrayElemAt: ["$product.designNumber", 0] }
            ]
          },
          customerName: {
            $ifNull: [
              { $arrayElemAt: ["$productSnapshot.customerName", 0] },
              { $arrayElemAt: ["$product.customerName", 0] }
            ]
          },
          department: {
            $ifNull: [
              { $arrayElemAt: ["$productSnapshot.department", 0] },
              { $arrayElemAt: ["$product.department", 0] }
            ]
          },
          personInCharge: {
            $ifNull: [
              { $arrayElemAt: ["$productSnapshot.personInCharge", 0] },
              { $arrayElemAt: ["$product.personInCharge", 0] }
            ]
          },
          // Recipe snapshot for step name
          recipeName: { $arrayElemAt: ["$recipeSnapshot.name", 0] },
          recipeSteps: { $arrayElemAt: ["$recipeSnapshot.steps", 0] }
        }
      },
      // Stage 9: Add computed step name
      {
        $addFields: {
          stepName: {
            $let: {
              vars: {
                matchedStep: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ["$recipeSteps", []] },
                        as: "step",
                        cond: { $eq: ["$$step.order", "$stepOrder"] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ["$$matchedStep.name", "$recipeName"] }
            }
          }
        }
      },
      // Stage 10: Remove recipeSteps from final output
      {
        $project: {
          recipeSteps: 0
        }
      }
    ]);

    const response: APIResponse = {
      success: true,
      message: "Monitor tasks retrieved successfully",
      data: {
        items: tasks,
        total: tasks.length
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get monitor tasks error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve monitor tasks"
    };
    res.status(500).json(response);
  }
};
