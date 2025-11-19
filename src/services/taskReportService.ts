import mongoose from "mongoose";
import ExcelJS from "exceljs";
import { Task } from "../models/Task";
import { Device } from "../models/Device";
import { DeviceType } from "../models/DeviceType";
import * as ExcelFormatService from "./excelFormatService";

/**
 * Task Report Data Aggregation Service
 * Handles all data queries and calculations for task completion reports
 */

// ==================== TRANSLATIONS ====================

const TRANSLATIONS = {
  // Status values
  status: {
    PENDING: { en: "Pending", ko: "대기중" },
    ONGOING: { en: "Ongoing", ko: "진행중" },
    COMPLETED: { en: "Completed", ko: "완료됨" },
    FAILED: { en: "Failed", ko: "실패됨" }
  },
  // Sheet titles and headers
  titles: {
    executiveSummary: {
      en: "Task Completion Report - Executive Summary",
      ko: "작업 완료 보고서 - 요약"
    },
    taskDetails: { en: "Task Details Report", ko: "작업 상세 보고서" },
    recipeExecution: {
      en: "Recipe Execution Tracking",
      ko: "레시피 실행 추적"
    },
    deviceUtilization: { en: "Device Utilization", ko: "장치 활용도" },
    rawData: { en: "Raw Task Data", ko: "원본 작업 데이터" }
  },
  // Common labels
  labels: {
    overallTaskStatistics: {
      en: "Overall Task Statistics",
      ko: "전체 작업 통계"
    },
    status: { en: "Status", ko: "상태" },
    count: { en: "Count", ko: "수량" },
    percentage: { en: "Percentage", ko: "백분율" },
    color: { en: "Color", ko: "색상" },
    dateRange: { en: "Date Range", ko: "날짜 범위" },
    total: { en: "Total", ko: "총계" },
    completed: { en: "Completed", ko: "완료됨" },
    ongoing: { en: "Ongoing", ko: "진행중" },
    failed: { en: "Failed", ko: "실패됨" },
    pending: { en: "Pending", ko: "대기중" },
    completionRate: { en: "Completion Rate", ko: "완료율" },
    onTimeRate: { en: "On-Time Rate", ko: "정시율" },
    avgCompletionTime: { en: "Avg Completion Time", ko: "평균 완료 시간" },
    avgEstimatedTime: { en: "Avg Estimated Time", ko: "평균 예상 시간" },
    efficiency: { en: "Efficiency", ko: "효율성" },
    recommendation: { en: "Recommendation", ko: "권장사항" }
  },
  // Column headers
  columns: {
    taskNumber: { en: "Task #", ko: "작업 번호" },
    title: { en: "Title", ko: "제목" },
    description: { en: "Description", ko: "설명" },
    project: { en: "Project", ko: "프로젝트" },
    recipe: { en: "Recipe", ko: "레시피" },
    stepOrder: { en: "Step Order", ko: "단계 순서" },
    deviceType: { en: "Device Type", ko: "장치 유형" },
    device: { en: "Device", ko: "장치" },
    worker: { en: "Worker", ko: "작업자" },
    priority: { en: "Priority", ko: "우선순위" },
    created: { en: "Created", ko: "생성됨" },
    started: { en: "Started", ko: "시작됨" },
    completed: { en: "Completed", ko: "완료됨" },
    estimatedTime: { en: "Est. Time", ko: "예상 시간" },
    actualTime: { en: "Actual Time", ko: "실제 시간" },
    efficiency: { en: "Efficiency %", ko: "효율성 %" },
    quality: { en: "Quality", ko: "품질" },
    executionNumber: { en: "Execution #", ko: "실행 번호" },
    totalExecutions: { en: "Total Executions", ko: "총 실행 수" },
    totalTasks: { en: "Total Tasks", ko: "총 작업 수" },
    product: { en: "Product", ko: "제품" },
    targetQuantity: { en: "Target Qty", ko: "목표 수량" },
    producedQuantity: { en: "Produced Qty", ko: "생산 수량" },
    progress: { en: "Progress %", ko: "진행률 %" },
    avgTimePerUnit: { en: "Avg Time/Unit", ko: "단위당 평균 시간" },
    estimatedTimePerUnit: { en: "Est. Time/Unit", ko: "예상 단위 시간" },
    successRate: { en: "Success Rate", ko: "성공률" },
    failureRate: { en: "Failure Rate", ko: "실패률" },
    totalDevices: { en: "Total Devices", ko: "총 장치 수" },
    utilization: { en: "Utilization %", ko: "활용률 %" },
    avgTaskTime: { en: "Avg Task Time", ko: "평균 작업 시간" },
    recommendation: { en: "Recommendation", ko: "권장사항" },
    deviation: { en: "Deviation %", ko: "편차 %" }
  }
};
// Status values
export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

export interface TaskStatistics {
  total: number;
  completed: number;
  ongoing: number;
  failed: number;
  pending: number;
  completionRate: number;
  onTimeRate: number;
  avgCompletionTime: number; // in minutes
  avgEstimatedTime: number; // in minutes
  efficiency: number; // percentage
}

export interface ProjectTaskSummary {
  projectId: string;
  projectNumber: string;
  projectName: string;
  totalTasks: number;
  completedTasks: number;
  progress: number;
  onTimeRate: number;
  status: string;
}

export interface RecipeExecutionSummary {
  recipeId: string;
  recipeName: string;
  projectId?: string;
  projectName?: string;
  productId?: string;
  productName?: string;
  targetQuantity: number;
  producedQuantity: number;
  progress: number;
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  avgTimePerUnit: number; // in seconds
  estimatedTimePerUnit: number; // in seconds
  efficiency: number;
}

export interface RecipeStepStats {
  stepOrder: number;
  stepName: string;
  deviceTypeId: string;
  deviceTypeName: string;
  avgEstimatedDuration: number;
  avgActualDuration: number;
  deviation: number; // percentage
  efficiency: number; // percentage
  executionCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  failureRate: number;
}

export interface DeviceTypeUtilization {
  deviceTypeId: string;
  deviceTypeName: string;
  totalDevices: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  failedTasks: number;
  utilizationPercentage: number;
  avgTaskTime: number; // in seconds
  status: "LOW" | "GOOD" | "MEDIUM" | "HIGH";
  recommendation: string;
}

export interface TaskDetailRow {
  taskId: string;
  taskNumber?: string;
  title?: string;
  description?: string;
  projectId?: string;
  projectNumber?: string;
  projectName?: string;
  recipeId: string;
  recipeName: string;
  productId?: string;
  productName?: string;
  stepName: string;
  executionNumber: number;
  totalExecutions: number;
  stepOrder: number;
  workerId?: string;
  workerName?: string;
  deviceId?: string;
  deviceName?: string;
  deviceTypeId: string;
  deviceTypeName: string;
  status: string;
  priority: string;
  createdAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  estimatedTime?: number; // Alias for estimatedDuration
  actualTime?: number; // Alias for actualDuration
  deviation?: number | null;
  onTime: boolean | null;
  quality?: string;
  notes?: string;
}

export interface DailyTaskCompletion {
  date: string; // YYYY-MM-DD
  completed: number;
  created: number;
}

// ==================== DATA AGGREGATION FUNCTIONS ====================

/**
 * Get all tasks within date range
 * Filters by createdAt, startedAt, OR completedAt falling within range
 */
export async function getAllTasksInDateRange(
  dateRange: DateRangeFilter
): Promise<any[]> {
  const { startDate, endDate } = dateRange;

  const tasks = await Task.find({
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  })
    .populate("projectId", "name projectNumber")
    .populate("recipeId", "name")
    .populate("productId", "name")
    .populate("deviceTypeId", "name")
    .populate("deviceId", "name")
    .populate("workerId", "name")
    .populate("recipeSnapshotId")
    .sort({ createdAt: -1 })
    .lean();

  return tasks;
}

/**
 * Generate overall task statistics
 */
export async function generateTaskStatistics(
  dateRange: DateRangeFilter
): Promise<TaskStatistics> {
  const { startDate, endDate } = dateRange;

  const stats = await Task.aggregate([
    {
      $match: {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startedAt: { $gte: startDate, $lte: endDate } },
          { completedAt: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        ongoing: { $sum: { $cond: [{ $eq: ["$status", "ONGOING"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
        totalActualDuration: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$status", "COMPLETED"] }, "$actualDuration"] },
              "$actualDuration",
              0
            ]
          }
        },
        totalEstimatedDuration: {
          $sum: { $ifNull: ["$estimatedDuration", 0] }
        },
        onTimeCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "COMPLETED"] },
                  { $ne: ["$completedAt", null] },
                  { $ne: ["$startedAt", null] },
                  { $ne: ["$estimatedDuration", null] },
                  {
                    $lte: [
                      {
                        $subtract: [
                          "$completedAt",
                          { $ifNull: ["$startedAt", "$completedAt"] }
                        ]
                      },
                      { $multiply: ["$estimatedDuration", 1000] }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      total: 0,
      completed: 0,
      ongoing: 0,
      failed: 0,
      pending: 0,
      completionRate: 0,
      onTimeRate: 0,
      avgCompletionTime: 0,
      avgEstimatedTime: 0,
      efficiency: 0
    };
  }

  const data = stats[0];
  const completionRate =
    data.total > 0 ? (data.completed / data.total) * 100 : 0;
  const onTimeRate =
    data.completed > 0 ? (data.onTimeCount / data.completed) * 100 : 0;
  const avgCompletionTime =
    data.completed > 0 ? data.totalActualDuration / data.completed : 0;
  const avgEstimatedTime =
    data.total > 0 ? data.totalEstimatedDuration / data.total : 0;
  const efficiency =
    data.totalActualDuration > 0
      ? (data.totalEstimatedDuration / data.totalActualDuration) * 100
      : 0;

  return {
    total: data.total,
    completed: data.completed,
    ongoing: data.ongoing,
    failed: data.failed,
    pending: data.pending,
    completionRate,
    onTimeRate,
    avgCompletionTime,
    avgEstimatedTime,
    efficiency
  };
}

/**
 * Aggregate tasks by project
 */
export async function aggregateTasksByProject(
  dateRange: DateRangeFilter
): Promise<ProjectTaskSummary[]> {
  const { startDate, endDate } = dateRange;

  const projectStats = await Task.aggregate([
    {
      $match: {
        projectId: { $ne: null },
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startedAt: { $gte: startDate, $lte: endDate } },
          { completedAt: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $group: {
        _id: "$projectId",
        totalTasks: { $sum: 1 },
        completedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        onTimeCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "COMPLETED"] },
                  { $ne: ["$completedAt", null] },
                  { $ne: ["$startedAt", null] },
                  { $ne: ["$estimatedDuration", null] },
                  {
                    $lte: [
                      {
                        $subtract: [
                          "$completedAt",
                          { $ifNull: ["$startedAt", "$completedAt"] }
                        ]
                      },
                      { $multiply: ["$estimatedDuration", 1000] }
                    ]
                  }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $lookup: {
        from: "projects",
        localField: "_id",
        foreignField: "_id",
        as: "project"
      }
    },
    {
      $unwind: "$project"
    },
    {
      $project: {
        projectId: { $toString: "$_id" },
        projectNumber: "$project.projectNumber",
        projectName: "$project.name",
        totalTasks: 1,
        completedTasks: 1,
        progress: {
          $multiply: [{ $divide: ["$completedTasks", "$totalTasks"] }, 100]
        },
        onTimeRate: {
          $cond: [
            { $gt: ["$completedTasks", 0] },
            {
              $multiply: [{ $divide: ["$onTimeCount", "$completedTasks"] }, 100]
            },
            0
          ]
        },
        status: "$project.status"
      }
    },
    {
      $sort: { projectNumber: 1 }
    }
  ]);

  return projectStats;
}

/**
 * Aggregate tasks by recipe with execution tracking
 */
export async function aggregateByRecipe(
  dateRange: DateRangeFilter
): Promise<RecipeExecutionSummary[]> {
  const { startDate, endDate } = dateRange;

  const recipeStats = await Task.aggregate([
    {
      $match: {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startedAt: { $gte: startDate, $lte: endDate } },
          { completedAt: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $group: {
        _id: {
          recipeId: "$recipeId",
          projectId: "$projectId",
          productId: "$productId"
        },
        totalExecutions: { $max: "$totalRecipeExecutions" },
        completedExecutions: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "COMPLETED"] },
                  { $eq: ["$isLastStepInRecipe", true] }
                ]
              },
              1,
              0
            ]
          }
        },
        failedExecutions: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "FAILED"] },
                  { $eq: ["$isLastStepInRecipe", true] }
                ]
              },
              1,
              0
            ]
          }
        },
        totalActualDuration: {
          $sum: {
            $cond: [{ $eq: ["$status", "COMPLETED"] }, "$actualDuration", 0]
          }
        },
        totalEstimatedDuration: { $sum: "$estimatedDuration" },
        completedTaskCount: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: "recipes",
        localField: "_id.recipeId",
        foreignField: "_id",
        as: "recipe"
      }
    },
    {
      $lookup: {
        from: "projects",
        localField: "_id.projectId",
        foreignField: "_id",
        as: "project"
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "_id.productId",
        foreignField: "_id",
        as: "product"
      }
    },
    {
      $project: {
        recipeId: { $toString: "$_id.recipeId" },
        recipeName: { $arrayElemAt: ["$recipe.name", 0] },
        projectId: { $toString: "$_id.projectId" },
        projectName: { $arrayElemAt: ["$project.name", 0] },
        productId: { $toString: "$_id.productId" },
        productName: { $arrayElemAt: ["$product.name", 0] },
        targetQuantity: { $arrayElemAt: ["$project.targetQuantity", 0] },
        producedQuantity: { $arrayElemAt: ["$project.producedQuantity", 0] },
        totalExecutions: 1,
        completedExecutions: 1,
        failedExecutions: 1,
        progress: {
          $cond: [
            { $gt: ["$totalExecutions", 0] },
            {
              $multiply: [
                { $divide: ["$completedExecutions", "$totalExecutions"] },
                100
              ]
            },
            0
          ]
        },
        avgTimePerUnit: {
          $cond: [
            { $gt: ["$completedTaskCount", 0] },
            { $divide: ["$totalActualDuration", "$completedTaskCount"] },
            0
          ]
        },
        estimatedTimePerUnit: {
          $cond: [
            { $gt: ["$totalExecutions", 0] },
            { $divide: ["$totalEstimatedDuration", "$totalExecutions"] },
            0
          ]
        },
        efficiency: {
          $cond: [
            { $gt: ["$totalActualDuration", 0] },
            {
              $multiply: [
                {
                  $divide: ["$totalEstimatedDuration", "$totalActualDuration"]
                },
                100
              ]
            },
            0
          ]
        }
      }
    },
    {
      $sort: { recipeName: 1 }
    }
  ]);

  return recipeStats;
}

/**
 * Get recipe step statistics for execution tracking sheet
 */
export async function getRecipeStepStats(
  recipeId: string,
  dateRange: DateRangeFilter
): Promise<RecipeStepStats[]> {
  const { startDate, endDate } = dateRange;

  const stepStats = await Task.aggregate([
    {
      $match: {
        recipeId: new mongoose.Types.ObjectId(recipeId),
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startedAt: { $gte: startDate, $lte: endDate } },
          { completedAt: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $group: {
        _id: {
          stepOrder: "$stepOrder",
          deviceTypeId: "$deviceTypeId"
        },
        executionCount: { $sum: 1 },
        avgEstimatedDuration: { $avg: "$estimatedDuration" },
        avgActualDuration: {
          $avg: {
            $cond: [{ $eq: ["$status", "COMPLETED"] }, "$actualDuration", null]
          }
        },
        successCount: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        failureCount: {
          $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: "devicetypes",
        localField: "_id.deviceTypeId",
        foreignField: "_id",
        as: "deviceType"
      }
    },
    {
      $project: {
        stepOrder: "$_id.stepOrder",
        deviceTypeId: { $toString: "$_id.deviceTypeId" },
        deviceTypeName: { $arrayElemAt: ["$deviceType.name", 0] },
        avgEstimatedDuration: 1,
        avgActualDuration: 1,
        deviation: {
          $cond: [
            {
              $and: [
                { $gt: ["$avgActualDuration", 0] },
                { $gt: ["$avgEstimatedDuration", 0] }
              ]
            },
            {
              $multiply: [
                {
                  $divide: [
                    {
                      $subtract: ["$avgActualDuration", "$avgEstimatedDuration"]
                    },
                    "$avgEstimatedDuration"
                  ]
                },
                100
              ]
            },
            0
          ]
        },
        efficiency: {
          $cond: [
            { $gt: ["$avgActualDuration", 0] },
            {
              $multiply: [
                { $divide: ["$avgEstimatedDuration", "$avgActualDuration"] },
                100
              ]
            },
            0
          ]
        },
        executionCount: 1,
        successRate: {
          $multiply: [{ $divide: ["$successCount", "$executionCount"] }, 100]
        },
        failureRate: {
          $multiply: [{ $divide: ["$failureCount", "$executionCount"] }, 100]
        }
      }
    },
    {
      $sort: { stepOrder: 1 }
    }
  ]);

  // Get step names from recipe snapshot
  const tasks = await Task.find({
    recipeId: new mongoose.Types.ObjectId(recipeId)
  })
    .populate("recipeSnapshotId")
    .limit(1)
    .lean();

  if (tasks.length > 0 && tasks[0].recipeSnapshotId) {
    const snapshot: any = tasks[0].recipeSnapshotId;
    stepStats.forEach((stat) => {
      const step = snapshot.steps?.find((s: any) => s.order === stat.stepOrder);
      stat.stepName = step?.name || `Step ${stat.stepOrder}`;
    });
  }

  return stepStats;
}

/**
 * Calculate device TYPE utilization
 */
export async function calculateDeviceTypeUtilization(
  dateRange: DateRangeFilter
): Promise<DeviceTypeUtilization[]> {
  const { startDate, endDate } = dateRange;

  // Get all device types
  const deviceTypes = await DeviceType.find().lean();

  // Get device counts per type
  const deviceCounts = await Device.aggregate([
    {
      $group: {
        _id: "$deviceTypeId",
        count: { $sum: 1 }
      }
    }
  ]);

  const deviceCountMap = new Map(
    deviceCounts.map((dc) => [dc._id.toString(), dc.count])
  );

  // Get task statistics per device type
  const typeStats = await Task.aggregate([
    {
      $match: {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startedAt: { $gte: startDate, $lte: endDate } },
          { completedAt: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $group: {
        _id: "$deviceTypeId",
        totalTasks: { $sum: 1 },
        completedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        inProgressTasks: {
          $sum: { $cond: [{ $eq: ["$status", "ONGOING"] }, 1, 0] }
        },
        failedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] }
        },
        avgTaskTime: {
          $avg: {
            $cond: [{ $eq: ["$status", "COMPLETED"] }, "$actualDuration", null]
          }
        }
      }
    }
  ]);

  const typeStatsMap = new Map(typeStats.map((ts) => [ts._id.toString(), ts]));

  // Calculate utilization for each device type
  const utilization: DeviceTypeUtilization[] = deviceTypes.map((dt) => {
    const deviceTypeId = dt._id.toString();
    const totalDevices = deviceCountMap.get(deviceTypeId) || 0;
    const stats = typeStatsMap.get(deviceTypeId) || {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      failedTasks: 0,
      avgTaskTime: 0
    };

    // Calculate utilization percentage
    // Formula: (Total task hours / (Total devices × Period hours)) × 100
    const periodHours =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const totalDeviceHours = totalDevices * periodHours;
    const totalTaskHours = (stats.avgTaskTime * stats.totalTasks) / 3600;
    const utilizationPercentage =
      totalDeviceHours > 0 ? (totalTaskHours / totalDeviceHours) * 100 : 0;

    // Determine status and recommendation
    let status: "LOW" | "GOOD" | "MEDIUM" | "HIGH";
    let recommendation: string;

    if (utilizationPercentage >= 90) {
      status = "HIGH";
      recommendation = "Add capacity - devices at critical utilization";
    } else if (utilizationPercentage >= 70) {
      status = "MEDIUM";
      recommendation = "Monitor closely - approaching capacity";
    } else if (utilizationPercentage >= 40) {
      status = "GOOD";
      recommendation = "Optimal utilization";
    } else {
      status = "LOW";
      recommendation = "Underutilized - consider reassignment";
    }

    return {
      deviceTypeId,
      deviceTypeName: dt.name,
      totalDevices,
      totalTasks: stats.totalTasks,
      completedTasks: stats.completedTasks,
      inProgressTasks: stats.inProgressTasks,
      failedTasks: stats.failedTasks,
      utilizationPercentage,
      avgTaskTime: stats.avgTaskTime || 0,
      status,
      recommendation
    };
  });

  return utilization.sort(
    (a, b) => b.utilizationPercentage - a.utilizationPercentage
  );
}

/**
 * Get daily task completion data for trend charts
 */
export async function getDailyTaskCompletion(
  dateRange: DateRangeFilter
): Promise<DailyTaskCompletion[]> {
  const { startDate, endDate } = dateRange;

  const dailyStats = await Task.aggregate([
    {
      $match: {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { completedAt: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $facet: {
        created: [
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
              },
              count: { $sum: 1 }
            }
          }
        ],
        completed: [
          {
            $match: {
              status: "COMPLETED",
              completedAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$completedAt" }
              },
              count: { $sum: 1 }
            }
          }
        ]
      }
    }
  ]);

  const createdMap = new Map(
    dailyStats[0].created.map((d: any) => [d._id, d.count])
  );
  const completedMap = new Map(
    dailyStats[0].completed.map((d: any) => [d._id, d.count])
  );

  // Generate array of dates
  const result: DailyTaskCompletion[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    result.push({
      date: dateStr,
      created: (createdMap.get(dateStr) as number) || 0,
      completed: (completedMap.get(dateStr) as number) || 0
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

/**
 * Get detailed task data for export
 */
export async function getTaskDetails(
  dateRange: DateRangeFilter
): Promise<TaskDetailRow[]> {
  const tasks = await getAllTasksInDateRange(dateRange);

  return tasks.map((task) => {
    const estimatedDuration = task.estimatedDuration || 0;
    const actualDuration = task.actualDuration || 0;
    const deviation =
      estimatedDuration > 0
        ? ((actualDuration - estimatedDuration) / estimatedDuration) * 100
        : null;

    let onTime: boolean | null = null;
    if (
      task.status === "COMPLETED" &&
      task.startedAt &&
      task.completedAt &&
      estimatedDuration > 0
    ) {
      const actualTime =
        (new Date(task.completedAt).getTime() -
          new Date(task.startedAt).getTime()) /
        1000;
      onTime = actualTime <= estimatedDuration;
    }

    return {
      taskId: task._id.toString(),
      taskNumber: task.taskNumber,
      title: task.title,
      description: task.description,
      projectId: task.projectId?._id?.toString(),
      projectNumber: task.projectId?.projectNumber,
      projectName: task.projectId?.name,
      recipeId: task.recipeId?._id?.toString() || task.recipeId?.toString(),
      recipeName: task.recipeId?.name,
      productId: task.productId?._id?.toString(),
      productName: task.productId?.name,
      stepName: task.title,
      executionNumber: task.recipeExecutionNumber,
      totalExecutions: task.totalRecipeExecutions,
      stepOrder: task.stepOrder,
      workerId: task.workerId?._id?.toString(),
      workerName: task.workerId?.name,
      deviceId: task.deviceId?._id?.toString(),
      deviceName: task.deviceId?.name,
      deviceTypeId:
        task.deviceTypeId?._id?.toString() || task.deviceTypeId?.toString(),
      deviceTypeName: task.deviceTypeId?.name,
      status: task.status,
      priority: task.priority,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      estimatedDuration,
      actualDuration,
      estimatedTime: estimatedDuration, // Alias
      actualTime: actualDuration, // Alias
      deviation,
      onTime,
      quality: task.qualityData ? "PASS" : undefined,
      notes: task.notes
    };
  });
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format duration in minutes (from DB) to readable string
 * @param minutes Duration in minutes (as stored in database)
 * @returns Formatted string like "2h 30m" or "45m"
 */
function formatDuration(minutes: number): string {
  if (!minutes || minutes === 0) return "0m";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.floor(minutes % 60);

  if (hours > 0) {
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  } else {
    return `${remainingMinutes}m`;
  }
}

/**
 * Get localized label based on language
 */
function getLocalizedLabel(en: string, ko: string, lang?: string): string {
  if (lang === "ko") {
    return ko;
  }
  return en;
}

/**
 * Get translated status value
 */
function getTranslatedStatus(
  status: keyof typeof TRANSLATIONS.status,
  lang?: string
): string {
  const statusKey = status as keyof typeof TRANSLATIONS.status;
  if (TRANSLATIONS.status[statusKey]) {
    return getLocalizedLabel(
      TRANSLATIONS.status[statusKey].en,
      TRANSLATIONS.status[statusKey].ko,
      lang
    );
  }
  return status;
}

/**
 * Get translated label from translations object
 */
function getTranslatedLabel(
  key: keyof typeof TRANSLATIONS.labels,
  lang?: string
): string {
  if (TRANSLATIONS.labels[key]) {
    return getLocalizedLabel(
      TRANSLATIONS.labels[key].en,
      TRANSLATIONS.labels[key].ko,
      lang
    );
  }
  return key;
}

/**
 * Get translated column header from translations object
 */
function getTranslatedColumn(
  key: keyof typeof TRANSLATIONS.columns,
  lang?: string
): string {
  if (TRANSLATIONS.columns[key]) {
    return getLocalizedLabel(
      TRANSLATIONS.columns[key].en,
      TRANSLATIONS.columns[key].ko,
      lang
    );
  }
  return key;
}

/**
 * Get translated title from translations object
 */
function getTranslatedTitle(
  key: keyof typeof TRANSLATIONS.titles,
  lang?: string
): string {
  if (TRANSLATIONS.titles[key]) {
    return getLocalizedLabel(
      TRANSLATIONS.titles[key].en,
      TRANSLATIONS.titles[key].ko,
      lang
    );
  }
  return key;
}

// ==================== SHEET GENERATION FUNCTIONS ====================

/**
 * Generate Executive Summary sheet for Task Report
 */
export async function generateTaskReportSummarySheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  lang?: string
): Promise<void> {
  const worksheet = workbook.addWorksheet("Executive Summary");
  const { startDate, endDate } = dateRange;

  console.log("[TaskReport] Generating Executive Summary sheet...");

  // Set worksheet properties
  worksheet.properties.defaultRowHeight = 20;

  // Add title
  worksheet.mergeCells("A1:F1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = getTranslatedTitle("executiveSummary", lang);
  titleCell.font = {
    name: "Arial",
    size: 16,
    bold: true,
    color: { argb: "FFFFFF" }
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 30;

  // Add date range
  worksheet.mergeCells("A2:F2");
  const dateCell = worksheet.getCell("A2");
  dateCell.value = `${getTranslatedLabel(
    "dateRange",
    lang
  )}: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  dateCell.font = { name: "Arial", size: 11 };
  dateCell.alignment = { vertical: "middle", horizontal: "center" };

  // Add approval form (top-right corner, starting at column H)
  ExcelFormatService.createApprovalForm(worksheet, 1, 8);

  // Fetch data
  const taskStats = await generateTaskStatistics(dateRange);
  const projectSummary = await aggregateTasksByProject(dateRange);
  const deviceUtilization = await calculateDeviceTypeUtilization(dateRange);
  const dailyCompletion = await getDailyTaskCompletion(dateRange);

  // ========== OVERALL TASK STATISTICS BOX ==========
  let currentRow = 4;

  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const statsHeaderCell = worksheet.getCell(`A${currentRow}`);
  statsHeaderCell.value = getTranslatedLabel("overallTaskStatistics", lang);
  statsHeaderCell.font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FFFFFF" }
  };
  statsHeaderCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  statsHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

  currentRow++;

  // Statistics data in 2-column layout
  const statsData = [
    { label: "Total Tasks", value: taskStats.total },
    { label: "Completed", value: taskStats.completed },
    { label: "Ongoing", value: taskStats.ongoing },
    { label: "Failed", value: taskStats.failed },
    { label: "Pending", value: taskStats.pending },
    {
      label: "Completion Rate",
      value: `${taskStats.completionRate.toFixed(1)}%`
    },
    { label: "On-Time Rate", value: `${taskStats.onTimeRate.toFixed(1)}%` },
    {
      label: "Avg Completion Time",
      value: formatDuration(taskStats.avgCompletionTime)
    },
    {
      label: "Avg Estimated Time",
      value: formatDuration(taskStats.avgEstimatedTime)
    },
    {
      label: "Overall Efficiency",
      value: `${taskStats.efficiency.toFixed(1)}%`
    }
  ];

  for (let i = 0; i < statsData.length; i += 2) {
    const row = worksheet.getRow(currentRow);

    // Left column
    const leftLabelCell = row.getCell(1);
    leftLabelCell.value = statsData[i].label;
    leftLabelCell.font = { name: "Arial", size: 10, bold: true };
    leftLabelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F0F0F0" }
    };

    const leftValueCell = row.getCell(2);
    leftValueCell.value = statsData[i].value;
    leftValueCell.font = { name: "Arial", size: 10 };
    leftValueCell.alignment = { horizontal: "right" };

    // Right column (if exists)
    if (i + 1 < statsData.length) {
      const rightLabelCell = row.getCell(4);
      rightLabelCell.value = statsData[i + 1].label;
      rightLabelCell.font = { name: "Arial", size: 10, bold: true };
      rightLabelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "F0F0F0" }
      };

      const rightValueCell = row.getCell(5);
      rightValueCell.value = statsData[i + 1].value;
      rightValueCell.font = { name: "Arial", size: 10 };
      rightValueCell.alignment = { horizontal: "right" };
    }

    currentRow++;
  }

  // Apply borders to statistics box
  const statsBoxStartRow = currentRow - statsData.length;
  ExcelFormatService.applyBorders(
    worksheet,
    statsBoxStartRow,
    currentRow - 1,
    1,
    6
  );

  currentRow++; // Add spacing

  // ========== TASK STATUS DISTRIBUTION ==========
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const statusHeaderCell = worksheet.getCell(`A${currentRow}`);
  statusHeaderCell.value = "Task Status Distribution";
  statusHeaderCell.font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FFFFFF" }
  };
  statusHeaderCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  statusHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

  currentRow++;

  // Status distribution table
  const statusHeaders = [
    getTranslatedLabel("status", lang),
    getTranslatedLabel("count", lang),
    getTranslatedLabel("percentage", lang),
    getTranslatedLabel("color", lang)
  ];
  const statusHeaderRow = worksheet.getRow(currentRow);
  statusHeaders.forEach((header, idx) => {
    const cell = statusHeaderRow.getCell(idx + 1);
    cell.value = header;
  });
  ExcelFormatService.styleHeaderRow(worksheet, currentRow, 4);
  currentRow++;

  const statusDistribution = [
    {
      status: "COMPLETED",
      count: taskStats.completed,
      color: ExcelFormatService.COLORS.SUCCESS
    },
    {
      status: "ONGOING",
      count: taskStats.ongoing,
      color: ExcelFormatService.COLORS.WARNING
    },
    {
      status: "FAILED",
      count: taskStats.failed,
      color: ExcelFormatService.COLORS.DANGER
    },
    {
      status: "PENDING",
      count: taskStats.pending,
      color: ExcelFormatService.COLORS.NEUTRAL
    }
  ];

  const statusStartRow = currentRow;
  statusDistribution.forEach((status) => {
    const row = worksheet.getRow(currentRow);
    const percentage =
      taskStats.total > 0 ? (status.count / taskStats.total) * 100 : 0;

    row.getCell(1).value = status.status;
    row.getCell(2).value = status.count;
    row.getCell(3).value = `${percentage.toFixed(1)}%`;
    row.getCell(4).value = "";
    row.getCell(4).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: status.color }
    };

    currentRow++;
  });

  // Apply borders to status table
  if (statusDistribution.length > 0) {
    ExcelFormatService.applyBorders(
      worksheet,
      statusStartRow,
      currentRow - 1,
      1,
      4
    );
  }

  currentRow++; // Add spacing  // ========== BY-PROJECT TABLE ==========
  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  const projectHeaderCell = worksheet.getCell(`A${currentRow}`);
  projectHeaderCell.value = "Tasks by Project";
  projectHeaderCell.font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FFFFFF" }
  };
  projectHeaderCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  projectHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

  currentRow++;

  const projectHeaders = [
    "Project #",
    "Project Name",
    "Total Tasks",
    "Completed",
    "Progress",
    "On-Time Rate",
    "Status"
  ];
  const projectHeaderRow = worksheet.getRow(currentRow);
  projectHeaders.forEach((header, idx) => {
    const cell = projectHeaderRow.getCell(idx + 1);
    cell.value = header;
  });
  ExcelFormatService.styleHeaderRow(
    worksheet,
    currentRow,
    projectHeaders.length
  );
  currentRow++;

  const projectStartRow = currentRow;
  projectSummary.forEach((project) => {
    const row = worksheet.getRow(currentRow);

    row.getCell(1).value = project.projectNumber;
    row.getCell(2).value = project.projectName;
    row.getCell(3).value = project.totalTasks;
    row.getCell(4).value = project.completedTasks;
    row.getCell(5).value = `${project.progress.toFixed(1)}%`;
    row.getCell(6).value = `${project.onTimeRate.toFixed(1)}%`;
    row.getCell(7).value = project.status;

    // Apply alternating row colors (handled via worksheet-level call later)

    currentRow++;
  });

  // Apply alternating rows and borders to project table
  if (projectSummary.length > 0) {
    ExcelFormatService.applyAlternatingRows(
      worksheet,
      projectStartRow,
      currentRow - 1,
      projectHeaders.length
    );
    ExcelFormatService.applyBorders(
      worksheet,
      projectStartRow,
      currentRow - 1,
      1,
      projectHeaders.length
    );
  }

  currentRow++; // Add spacing

  // ========== DEVICE TYPE UTILIZATION TABLE ==========
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const deviceHeaderCell = worksheet.getCell(`A${currentRow}`);
  deviceHeaderCell.value = "Device Type Utilization";
  deviceHeaderCell.font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FFFFFF" }
  };
  deviceHeaderCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  deviceHeaderCell.alignment = { vertical: "middle", horizontal: "center" };

  currentRow++;

  const deviceHeaders = [
    "Device Type",
    "Total Devices",
    "Total Tasks",
    "Completed",
    "In Progress",
    "Failed",
    "Utilization %",
    "Avg Task Time",
    "Status",
    "Recommendation"
  ];
  const deviceHeaderRow = worksheet.getRow(currentRow);
  deviceHeaders.forEach((header, idx) => {
    const cell = deviceHeaderRow.getCell(idx + 1);
    cell.value = header;
  });
  ExcelFormatService.styleHeaderRow(
    worksheet,
    currentRow,
    deviceHeaders.length
  );
  currentRow++;

  const deviceStartRow = currentRow;
  deviceUtilization.forEach((device) => {
    const row = worksheet.getRow(currentRow);

    row.getCell(1).value = device.deviceTypeName;
    row.getCell(2).value = device.totalDevices;
    row.getCell(3).value = device.totalTasks;
    row.getCell(4).value = device.completedTasks;
    row.getCell(5).value = device.inProgressTasks;
    row.getCell(6).value = device.failedTasks;
    row.getCell(7).value = `${device.utilizationPercentage.toFixed(1)}%`;
    row.getCell(8).value = formatDuration(device.avgTaskTime);
    row.getCell(9).value = device.status;
    row.getCell(10).value = device.recommendation;

    // Color code utilization
    const utilizationCell = row.getCell(7);
    if (device.utilizationPercentage >= 90) {
      utilizationCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.DANGER }
      };
    } else if (device.utilizationPercentage >= 70) {
      utilizationCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.WARNING }
      };
    } else {
      utilizationCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.SUCCESS }
      };
    }

    currentRow++;
  });

  // Apply alternating rows and borders to device table
  if (deviceUtilization.length > 0) {
    ExcelFormatService.applyAlternatingRows(
      worksheet,
      deviceStartRow,
      currentRow - 1,
      deviceHeaders.length
    );
    ExcelFormatService.applyBorders(
      worksheet,
      deviceStartRow,
      currentRow - 1,
      1,
      deviceHeaders.length
    );
  }

  currentRow += 2; // Add spacing for charts

  // ========== CHARTS ==========

  // Chart 1: Task Status Pie Chart
  const statusChartStartRow = currentRow;
  ExcelFormatService.addPieChart(
    worksheet,
    "Task Status Distribution",
    `A${statusStartRow}:B${statusStartRow + statusDistribution.length - 1}`,
    `A${statusStartRow}:A${statusStartRow + statusDistribution.length - 1}`,
    { row: statusChartStartRow, col: 1 },
    { width: 500, height: 300 }
  );

  // Chart 2: Daily Completion Line Chart
  // First, add daily completion data to a hidden area
  const dailyDataStartRow = currentRow + 20;
  const dailyDataStartCol = 12; // Column L

  worksheet.getCell(dailyDataStartRow, dailyDataStartCol).value = "Date";
  worksheet.getCell(dailyDataStartRow, dailyDataStartCol + 1).value =
    "Completed";
  worksheet.getCell(dailyDataStartRow, dailyDataStartCol + 2).value = "Created";

  dailyCompletion.forEach((day, idx) => {
    const row = dailyDataStartRow + idx + 1;
    worksheet.getCell(row, dailyDataStartCol).value = day.date;
    worksheet.getCell(row, dailyDataStartCol + 1).value = day.completed;
    worksheet.getCell(row, dailyDataStartCol + 2).value = day.created;
  });

  const dailyDataEndRow = dailyDataStartRow + dailyCompletion.length;
  ExcelFormatService.addLineChart(
    worksheet,
    "Daily Task Completion Trend",
    `L${dailyDataStartRow}:N${dailyDataEndRow}`,
    { row: statusChartStartRow, col: 8 },
    { width: 600, height: 300 }
  );

  // Chart 3: Device Type Utilization Bar Chart
  ExcelFormatService.addBarChart(
    worksheet,
    "Device Type Utilization",
    `A${deviceStartRow}:G${deviceStartRow + deviceUtilization.length - 1}`,
    { row: statusChartStartRow + 18, col: 1 },
    { width: 700, height: 400 }
  );

  // ========== FORMATTING ==========

  // Set column widths
  worksheet.getColumn(1).width = 15;
  worksheet.getColumn(2).width = 25;
  worksheet.getColumn(3).width = 12;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 12;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 15;
  worksheet.getColumn(8).width = 15;
  worksheet.getColumn(9).width = 12;
  worksheet.getColumn(10).width = 30;

  // Freeze top rows
  ExcelFormatService.freezePanes(worksheet, true);

  console.log("[TaskReport] Executive Summary sheet generated successfully");
}

/**
 * Generate Task Details sheet for Task Report
 */
export async function generateTaskDetailsSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  lang?: string
): Promise<void> {
  const worksheet = workbook.addWorksheet("Task Details");
  const { startDate, endDate } = dateRange;

  console.log("[TaskReport] Generating Task Details sheet...");

  // Set worksheet properties
  worksheet.properties.defaultRowHeight = 18;

  // Add title
  worksheet.mergeCells("A1:R1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = getTranslatedTitle("taskDetails", lang);
  titleCell.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: "FFFFFF" }
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 25;

  // Add date range
  worksheet.mergeCells("A2:R2");
  const dateCell = worksheet.getCell("A2");
  dateCell.value = `${getTranslatedLabel(
    "dateRange",
    lang
  )}: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  dateCell.font = { name: "Arial", size: 10 };
  dateCell.alignment = { vertical: "middle", horizontal: "center" };

  // Fetch task details
  const taskDetails = await getTaskDetails(dateRange);

  // Add header row
  const headerRow = worksheet.getRow(3);
  const headers = [
    getTranslatedColumn("taskNumber", lang),
    getTranslatedColumn("title", lang),
    getTranslatedColumn("description", lang),
    getTranslatedColumn("project", lang),
    getTranslatedColumn("recipe", lang),
    getTranslatedColumn("stepOrder", lang),
    getTranslatedColumn("deviceType", lang),
    getTranslatedColumn("device", lang),
    getTranslatedColumn("worker", lang),
    getTranslatedLabel("status", lang),
    getTranslatedColumn("priority", lang),
    getTranslatedColumn("created", lang),
    getTranslatedColumn("started", lang),
    getTranslatedColumn("completed", lang),
    getTranslatedColumn("estimatedTime", lang),
    getTranslatedColumn("actualTime", lang),
    getTranslatedColumn("efficiency", lang),
    getTranslatedColumn("quality", lang)
  ];

  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
  });
  ExcelFormatService.styleHeaderRow(worksheet, 3, headers.length);

  // Add task data
  let currentRow = 4;
  taskDetails.forEach((task) => {
    const row = worksheet.getRow(currentRow);

    row.getCell(1).value =
      task.taskNumber || `TASK-${task.taskId.substring(0, 8)}`;
    row.getCell(2).value = task.title;
    row.getCell(3).value = task.description || "";
    row.getCell(4).value = task.projectName || "";
    row.getCell(5).value = task.recipeName || "";
    row.getCell(6).value = task.stepOrder || "";
    row.getCell(7).value = task.deviceTypeName || "";
    row.getCell(8).value = task.deviceName || "";
    row.getCell(9).value = task.workerName || "";
    row.getCell(10).value = getTranslatedStatus(task.status as any, lang);
    row.getCell(11).value = task.priority;
    row.getCell(12).value = task.createdAt ? new Date(task.createdAt) : "";
    row.getCell(13).value = task.startedAt ? new Date(task.startedAt) : "";
    row.getCell(14).value = task.completedAt ? new Date(task.completedAt) : "";
    row.getCell(15).value = formatDuration(task.estimatedTime || 0);
    row.getCell(16).value = formatDuration(task.actualTime || 0);

    // Calculate efficiency
    let efficiency = 0;
    if (task.estimatedTime && task.actualTime && task.actualTime > 0) {
      efficiency = (task.estimatedTime / task.actualTime) * 100;
    }
    row.getCell(17).value = efficiency > 0 ? `${efficiency.toFixed(1)}%` : "";

    row.getCell(18).value = task.quality || "";

    // Apply status color coding to status column
    const statusCell = row.getCell(10);
    ExcelFormatService.applyStatusColor(statusCell, task.status);

    // Apply efficiency color coding
    const efficiencyCell = row.getCell(17);
    if (efficiency > 0) {
      if (efficiency >= 90) {
        efficiencyCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.SUCCESS }
        };
      } else if (efficiency >= 70) {
        efficiencyCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.WARNING }
        };
      } else {
        efficiencyCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.DANGER }
        };
      }
    }

    // Format date columns
    row.getCell(12).numFmt = "mm/dd/yyyy hh:mm";
    row.getCell(13).numFmt = "mm/dd/yyyy hh:mm";
    row.getCell(14).numFmt = "mm/dd/yyyy hh:mm";

    currentRow++;
  });

  // Apply alternating rows and borders to task details table
  if (taskDetails.length > 0) {
    const taskDetailsStartRow = 4;
    ExcelFormatService.applyAlternatingRows(
      worksheet,
      taskDetailsStartRow,
      currentRow - 1,
      headers.length
    );
    ExcelFormatService.applyBorders(
      worksheet,
      taskDetailsStartRow,
      currentRow - 1,
      1,
      headers.length
    );
  }

  // Set column widths
  worksheet.getColumn(1).width = 15; // Task #
  worksheet.getColumn(2).width = 30; // Title
  worksheet.getColumn(3).width = 40; // Description
  worksheet.getColumn(4).width = 20; // Project
  worksheet.getColumn(5).width = 25; // Recipe
  worksheet.getColumn(6).width = 10; // Step Order
  worksheet.getColumn(7).width = 18; // Device Type
  worksheet.getColumn(8).width = 18; // Device
  worksheet.getColumn(9).width = 18; // Worker
  worksheet.getColumn(10).width = 12; // Status
  worksheet.getColumn(11).width = 10; // Priority
  worksheet.getColumn(12).width = 16; // Created
  worksheet.getColumn(13).width = 16; // Started
  worksheet.getColumn(14).width = 16; // Completed
  worksheet.getColumn(15).width = 12; // Est. Time
  worksheet.getColumn(16).width = 12; // Actual Time
  worksheet.getColumn(17).width = 12; // Efficiency
  worksheet.getColumn(18).width = 10; // Quality

  // Add auto-filter
  worksheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: headers.length }
  };

  // Freeze header row
  ExcelFormatService.freezePanes(worksheet, true);

  console.log("[TaskReport] Task Details sheet generated successfully");
}

/**
 * Generate Recipe Execution sheet for Task Report
 * Uses Option B format: Recipe summary section + detailed step breakdown
 */
export async function generateRecipeExecutionSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  lang?: string
): Promise<void> {
  const worksheet = workbook.addWorksheet("Recipe Execution Tracking");
  const { startDate, endDate } = dateRange;

  console.log("[TaskReport] Generating Recipe Execution sheet...");

  // Set worksheet properties
  worksheet.properties.defaultRowHeight = 18;

  // Add title
  worksheet.mergeCells("A1:L1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = getTranslatedTitle("recipeExecution", lang);
  titleCell.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: "FFFFFF" }
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 25;

  // Add date range
  worksheet.mergeCells("A2:L2");
  const dateCell = worksheet.getCell("A2");
  dateCell.value = `${getTranslatedLabel(
    "dateRange",
    lang
  )}: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  dateCell.font = { name: "Arial", size: 10 };
  dateCell.alignment = { vertical: "middle", horizontal: "center" };

  // Fetch recipe execution data
  const recipeExecutions = await aggregateByRecipe(dateRange);

  let currentRow = 4;
  const recipeColors = [
    "D6EAF8",
    "D5F4E6",
    "FCF3CF",
    "FADBD8",
    "E8DAEF",
    "D5DBDB",
    "FDEBD0",
    "D4E6F1",
    "D1F2EB",
    "F9E79F"
  ];

  // Process each recipe
  for (let recipeIdx = 0; recipeIdx < recipeExecutions.length; recipeIdx++) {
    const recipe = recipeExecutions[recipeIdx];
    const recipeColor = recipeColors[recipeIdx % recipeColors.length];

    // ========== RECIPE SUMMARY SECTION ==========

    // Recipe header
    worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
    const recipeHeaderCell = worksheet.getCell(`A${currentRow}`);
    recipeHeaderCell.value = `Recipe: ${recipe.recipeName}`;
    recipeHeaderCell.font = {
      name: "Arial",
      size: 12,
      bold: true,
      color: { argb: "FFFFFF" }
    };
    recipeHeaderCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    recipeHeaderCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      indent: 1
    };
    worksheet.getRow(currentRow).height = 22;
    currentRow++;

    // Recipe metadata (2-column layout)
    const metadataRows = [
      {
        label: getTranslatedColumn("project", lang),
        value: recipe.projectName || "N/A",
        label2: getTranslatedColumn("product", lang),
        value2: recipe.productName || "N/A"
      },
      {
        label: "Total Executions",
        value: recipe.totalExecutions,
        label2: "Completed",
        value2: recipe.completedExecutions
      },
      {
        label: "Failed Executions",
        value: recipe.failedExecutions,
        label2: "Progress",
        value2: `${recipe.progress.toFixed(1)}%`
      },
      {
        label: "Avg Time/Unit",
        value: formatDuration(recipe.avgTimePerUnit),
        label2: "Est. Time/Unit",
        value2: formatDuration(recipe.estimatedTimePerUnit)
      },
      {
        label: "Efficiency",
        value: `${recipe.efficiency.toFixed(1)}%`,
        label2: "Target Qty",
        value2: recipe.targetQuantity || "N/A"
      }
    ];

    metadataRows.forEach((meta) => {
      const row = worksheet.getRow(currentRow);

      // Left column
      row.getCell(1).value = meta.label;
      row.getCell(1).font = { name: "Arial", size: 10, bold: true };
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "F0F0F0" }
      };

      row.getCell(2).value = meta.value;
      row.getCell(2).font = { name: "Arial", size: 10 };
      row.getCell(2).alignment = { horizontal: "right" };
      worksheet.mergeCells(`B${currentRow}:C${currentRow}`);

      // Right column
      row.getCell(4).value = meta.label2;
      row.getCell(4).font = { name: "Arial", size: 10, bold: true };
      row.getCell(4).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "F0F0F0" }
      };

      row.getCell(5).value = meta.value2;
      row.getCell(5).font = { name: "Arial", size: 10 };
      row.getCell(5).alignment = { horizontal: "right" };
      worksheet.mergeCells(`E${currentRow}:F${currentRow}`);

      currentRow++;
    });

    // Apply borders to recipe metadata
    const metadataStartRow = currentRow - metadataRows.length;
    ExcelFormatService.applyBorders(
      worksheet,
      metadataStartRow,
      currentRow - 1,
      1,
      6
    );

    currentRow++; // Spacing

    // ========== STEP BREAKDOWN SECTION ==========

    worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
    const stepsHeaderCell = worksheet.getCell(`A${currentRow}`);
    stepsHeaderCell.value = "Step Breakdown";
    stepsHeaderCell.font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: "FFFFFF" }
    };
    stepsHeaderCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: recipeColor }
    };
    stepsHeaderCell.alignment = { vertical: "middle", horizontal: "center" };
    currentRow++;

    // Step table headers
    const stepHeaders = [
      getTranslatedColumn("stepOrder", lang),
      getTranslatedColumn("title", lang), // Step Name
      getTranslatedColumn("deviceType", lang),
      getTranslatedColumn("totalExecutions", lang),
      getTranslatedColumn("completed", lang),
      getTranslatedStatus("FAILED", lang),
      getTranslatedColumn("successRate", lang),
      getTranslatedColumn("estimatedTime", lang),
      getTranslatedColumn("actualTime", lang),
      getTranslatedColumn("efficiency", lang),
      getTranslatedColumn("deviation", lang) // Need to add this to translations
    ];

    const stepHeaderRow = worksheet.getRow(currentRow);
    stepHeaders.forEach((header, idx) => {
      const cell = stepHeaderRow.getCell(idx + 1);
      cell.value = header;
    });
    ExcelFormatService.styleHeaderRow(
      worksheet,
      currentRow,
      stepHeaders.length
    );
    currentRow++; // Fetch step statistics for this recipe
    const stepStats = await getRecipeStepStats(recipe.recipeId, dateRange);

    if (stepStats.length > 0) {
      stepStats.forEach((step, idx) => {
        const row = worksheet.getRow(currentRow);

        row.getCell(1).value = step.stepOrder;
        row.getCell(2).value = step.stepName || `Step ${step.stepOrder}`;
        row.getCell(3).value = step.deviceTypeName || "";
        row.getCell(4).value = step.executionCount;
        row.getCell(5).value = step.successCount || 0;
        row.getCell(6).value = step.failureCount || 0;
        row.getCell(7).value = `${step.successRate.toFixed(1)}%`;
        row.getCell(8).value = formatDuration(step.avgEstimatedDuration || 0);
        row.getCell(9).value = formatDuration(step.avgActualDuration || 0);
        row.getCell(10).value = `${step.efficiency.toFixed(1)}%`;
        row.getCell(11).value = `${step.deviation.toFixed(1)}%`;

        // Color code efficiency
        const efficiencyCell = row.getCell(10);
        if (step.efficiency >= 90) {
          efficiencyCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ExcelFormatService.COLORS.SUCCESS }
          };
        } else if (step.efficiency >= 70) {
          efficiencyCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ExcelFormatService.COLORS.WARNING }
          };
        } else {
          efficiencyCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ExcelFormatService.COLORS.DANGER }
          };
        }

        // Apply recipe background color
        if (idx % 2 === 1) {
          for (let col = 1; col <= stepHeaders.length; col++) {
            const cell = row.getCell(col);
            if (!cell.fill || cell.fill.type !== "pattern") {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: recipeColor }
              };
            }
          }
        }

        currentRow++;
      });

      // Apply borders to step table
      ExcelFormatService.applyBorders(
        worksheet,
        currentRow - stepStats.length,
        currentRow - 1,
        1,
        stepHeaders.length
      );
    } else {
      // No step data available
      const row = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
      row.getCell(1).value = "No step execution data available";
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(1).font = { italic: true, color: { argb: "808080" } };
      currentRow++;
    }

    currentRow += 2; // Add spacing between recipes
  }

  // Set column widths
  worksheet.getColumn(1).width = 8; // Step #
  worksheet.getColumn(2).width = 25; // Step Name
  worksheet.getColumn(3).width = 18; // Device Type
  worksheet.getColumn(4).width = 12; // Executions
  worksheet.getColumn(5).width = 12; // Completed
  worksheet.getColumn(6).width = 10; // Failed
  worksheet.getColumn(7).width = 12; // Success Rate
  worksheet.getColumn(8).width = 14; // Avg Est. Time
  worksheet.getColumn(9).width = 14; // Avg Actual Time
  worksheet.getColumn(10).width = 12; // Efficiency %
  worksheet.getColumn(11).width = 12; // Deviation %

  // Freeze top rows
  ExcelFormatService.freezePanes(worksheet, true);

  console.log("[TaskReport] Recipe Execution sheet generated successfully");
}

/**
 * SHEET 4: Device Utilization
 * Shows device TYPE aggregation with utilization metrics and recommendations
 */
export async function generateDeviceUtilizationSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  lang?: string
): Promise<void> {
  const worksheet = workbook.addWorksheet("Device Utilization");
  const { startDate, endDate } = dateRange;

  console.log("[TaskReport] Generating Device Utilization sheet...");

  // Add title
  worksheet.mergeCells("A1:J1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = getTranslatedTitle("deviceUtilization", lang);
  titleCell.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: "FFFFFF" }
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(1).height = 25;

  // Add date range
  worksheet.mergeCells("A2:J2");
  const dateCell = worksheet.getCell("A2");
  dateCell.value = `${getTranslatedLabel(
    "dateRange",
    lang
  )}: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  dateCell.font = { name: "Arial", size: 10 };
  dateCell.alignment = { vertical: "middle", horizontal: "center" };

  let currentRow = 4;

  // Get device utilization data
  const utilization = await calculateDeviceTypeUtilization(dateRange);

  if (utilization.length === 0) {
    worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
    const noDataCell = worksheet.getCell(`A${currentRow}`);
    noDataCell.value =
      "No device utilization data available for the selected date range";
    noDataCell.alignment = { horizontal: "center", vertical: "middle" };
    noDataCell.font = { italic: true, color: { argb: "808080" } };
    return;
  }

  // Table headers
  const headers = [
    getTranslatedColumn("deviceType", lang),
    getTranslatedColumn("totalDevices", lang),
    getTranslatedColumn("totalTasks", lang),
    getTranslatedStatus("COMPLETED", lang),
    getTranslatedStatus("ONGOING", lang),
    getTranslatedStatus("FAILED"),
    getTranslatedColumn("utilization", lang),
    getTranslatedColumn("avgTaskTime", lang),
    getTranslatedLabel("status", lang),
    getTranslatedColumn("recommendation", lang)
  ];

  headers.forEach((header, index) => {
    const cell = worksheet.getRow(currentRow).getCell(index + 1);
    cell.value = header;
  });

  ExcelFormatService.styleHeaderRow(worksheet, currentRow, headers.length);
  currentRow++;

  // Data rows
  const dataStartRow = currentRow;
  utilization.forEach((device) => {
    const row = worksheet.getRow(currentRow);

    row.getCell(1).value = device.deviceTypeName;
    row.getCell(2).value = device.totalDevices;
    row.getCell(2).numFmt = "0";
    row.getCell(3).value = device.totalTasks;
    row.getCell(3).numFmt = "0";
    row.getCell(4).value = device.completedTasks;
    row.getCell(4).numFmt = "0";
    row.getCell(5).value = device.inProgressTasks;
    row.getCell(5).numFmt = "0";
    row.getCell(6).value = device.failedTasks;
    row.getCell(6).numFmt = "0";
    row.getCell(7).value = device.utilizationPercentage;
    row.getCell(7).numFmt = "0.00";
    row.getCell(8).value = formatDuration(device.avgTaskTime);
    row.getCell(9).value = device.status;
    row.getCell(10).value = device.recommendation;

    // Color code utilization percentage
    const utilizationCell = row.getCell(7);
    let utilizationColor: string;
    if (device.utilizationPercentage >= 90) {
      utilizationColor = ExcelFormatService.COLORS.DANGER; // High - Red
    } else if (device.utilizationPercentage >= 70) {
      utilizationColor = ExcelFormatService.COLORS.WARNING; // Medium - Yellow
    } else if (device.utilizationPercentage >= 40) {
      utilizationColor = ExcelFormatService.COLORS.SUCCESS; // Good - Green
    } else {
      utilizationColor = ExcelFormatService.COLORS.NEUTRAL; // Low - Gray
    }
    utilizationCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: utilizationColor }
    };

    // Color code status column
    const statusCell = row.getCell(9);
    let statusColor: string;
    if (device.status === "HIGH") {
      statusColor = ExcelFormatService.COLORS.DANGER;
    } else if (device.status === "MEDIUM") {
      statusColor = ExcelFormatService.COLORS.WARNING;
    } else if (device.status === "GOOD") {
      statusColor = ExcelFormatService.COLORS.SUCCESS;
    } else {
      statusColor = ExcelFormatService.COLORS.NEUTRAL;
    }
    statusCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: statusColor }
    };
    statusCell.font = { bold: true };

    // Apply general formatting
    for (let col = 1; col <= headers.length; col++) {
      row.getCell(col).alignment = { vertical: "middle", horizontal: "left" };
      row.getCell(col).font = { name: "Arial", size: 10 };
      if (col >= 2 && col <= 7) {
        row.getCell(col).alignment = {
          vertical: "middle",
          horizontal: "center"
        };
      }
    }

    currentRow++;
  });

  // Apply alternating row colors
  ExcelFormatService.applyAlternatingRows(
    worksheet,
    dataStartRow,
    currentRow - 1,
    headers.length
  );

  // Apply borders
  ExcelFormatService.applyBorders(
    worksheet,
    dataStartRow - 1,
    currentRow - 1,
    1,
    headers.length
  );

  // Set column widths
  worksheet.getColumn(1).width = 25; // Device Type
  worksheet.getColumn(2).width = 12; // Total Devices
  worksheet.getColumn(3).width = 12; // Total Tasks
  worksheet.getColumn(4).width = 12; // Completed
  worksheet.getColumn(5).width = 12; // In Progress
  worksheet.getColumn(6).width = 10; // Failed
  worksheet.getColumn(7).width = 14; // Utilization %
  worksheet.getColumn(8).width = 14; // Avg Task Time
  worksheet.getColumn(9).width = 12; // Status
  worksheet.getColumn(10).width = 50; // Recommendation

  // Freeze panes
  ExcelFormatService.freezePanes(worksheet, true);

  console.log("[TaskReport] Device Utilization sheet generated successfully");
}

/**
 * SHEET 5: Raw Task Data
 * Contains ALL database fields in raw format for data export/import
 * No color coding or formatting, just raw data
 */
export async function generateRawTaskDataSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  lang?: string
): Promise<void> {
  const worksheet = workbook.addWorksheet("Raw Task Data");
  const { startDate, endDate } = dateRange;

  console.log("[TaskReport] Generating Raw Task Data sheet...", lang);

  // Add instructions box
  worksheet.mergeCells("A1:Z1");
  const instructionCell = worksheet.getCell("A1");
  instructionCell.value =
    "RAW TASK DATA EXPORT - This sheet contains all database fields in raw format for data export/import purposes. " +
    "IDs are MongoDB ObjectIds. Timestamps are in ISO format. Use this for data analysis or system integration.";
  instructionCell.font = { name: "Arial", size: 9, italic: true };
  instructionCell.alignment = {
    vertical: "middle",
    horizontal: "left",
    wrapText: true
  };
  instructionCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
  };
  worksheet.getRow(1).height = 40;

  let currentRow = 3;

  // Get all tasks in the date range
  const tasks = await Task.find({
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  })
    .lean()
    .sort({ createdAt: -1 });

  if (tasks.length === 0) {
    worksheet.mergeCells(`A${currentRow}:Z${currentRow}`);
    const noDataCell = worksheet.getCell(`A${currentRow}`);
    noDataCell.value = "No task data available for the selected date range";
    noDataCell.alignment = { horizontal: "center", vertical: "middle" };
    noDataCell.font = { italic: true };
    return;
  }

  // Define all database fields
  const headers = [
    "_id",
    "title",
    "description",
    "projectId",
    "projectNumber",
    "recipeSnapshotId",
    "productSnapshotId",
    "recipeId",
    "productId",
    "recipeStepId",
    "recipeExecutionNumber",
    "totalRecipeExecutions",
    "stepOrder",
    "isLastStepInRecipe",
    "deviceTypeId",
    "deviceId",
    "workerId",
    "status",
    "priority",
    "estimatedDuration",
    "actualDuration",
    "pausedDuration",
    "startedAt",
    "completedAt",
    "progress",
    "notes",
    "qualityData",
    "mediaFiles",
    "createdAt",
    "updatedAt"
  ];

  // Add headers
  headers.forEach((header, index) => {
    const cell = worksheet.getRow(currentRow).getCell(index + 1);
    cell.value = header;
    cell.font = { name: "Arial", size: 10, bold: true };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  currentRow++;

  // Add data rows
  tasks.forEach((task: any) => {
    const row = worksheet.getRow(currentRow);

    row.getCell(1).value = task._id ? task._id.toString() : "";
    row.getCell(2).value = task.title || "";
    row.getCell(3).value = task.description || "";
    row.getCell(4).value = task.projectId ? task.projectId.toString() : "";
    row.getCell(5).value = task.projectNumber || "";
    row.getCell(6).value = task.recipeSnapshotId
      ? task.recipeSnapshotId.toString()
      : "";
    row.getCell(7).value = task.productSnapshotId
      ? task.productSnapshotId.toString()
      : "";
    row.getCell(8).value = task.recipeId ? task.recipeId.toString() : "";
    row.getCell(9).value = task.productId ? task.productId.toString() : "";
    row.getCell(10).value = task.recipeStepId
      ? task.recipeStepId.toString()
      : "";
    row.getCell(11).value = task.recipeExecutionNumber || "";
    row.getCell(12).value = task.totalRecipeExecutions || "";
    row.getCell(13).value = task.stepOrder || "";
    row.getCell(14).value = task.isLastStepInRecipe ? "TRUE" : "FALSE";
    row.getCell(15).value = task.deviceTypeId
      ? task.deviceTypeId.toString()
      : "";
    row.getCell(16).value = task.deviceId ? task.deviceId.toString() : "";
    row.getCell(17).value = task.workerId ? task.workerId.toString() : "";
    row.getCell(18).value = task.status || "";
    row.getCell(19).value = task.priority || "";
    row.getCell(20).value = task.estimatedDuration || "";
    row.getCell(21).value = task.actualDuration || "";
    row.getCell(22).value = task.pausedDuration || "";
    row.getCell(23).value = task.startedAt ? task.startedAt.toISOString() : "";
    row.getCell(24).value = task.completedAt
      ? task.completedAt.toISOString()
      : "";
    row.getCell(25).value = task.progress || 0;
    row.getCell(26).value = task.notes || "";
    row.getCell(27).value = task.qualityData
      ? JSON.stringify(task.qualityData)
      : "";
    row.getCell(28).value = task.mediaFiles
      ? task.mediaFiles.map((id: any) => id.toString()).join(", ")
      : "";
    row.getCell(29).value = task.createdAt ? task.createdAt.toISOString() : "";
    row.getCell(30).value = task.updatedAt ? task.updatedAt.toISOString() : "";

    // Apply basic formatting (left alignment for all cells)
    for (let col = 1; col <= headers.length; col++) {
      row.getCell(col).alignment = { vertical: "middle", horizontal: "left" };
      row.getCell(col).font = { name: "Arial", size: 9 };
    }

    currentRow++;
  });

  // Apply borders to entire data range
  ExcelFormatService.applyBorders(
    worksheet,
    3,
    currentRow - 1,
    1,
    headers.length
  );

  // Set column widths (uniform for raw data)
  for (let col = 1; col <= headers.length; col++) {
    if (col === 2) {
      worksheet.getColumn(col).width = 30; // title
    } else if (col === 3) {
      worksheet.getColumn(col).width = 35; // description
    } else if (col === 26) {
      worksheet.getColumn(col).width = 35; // notes
    } else if (col === 27) {
      worksheet.getColumn(col).width = 40; // qualityData
    } else if (col === 28) {
      worksheet.getColumn(col).width = 40; // mediaFiles
    } else {
      worksheet.getColumn(col).width = 20;
    }
  }

  // Freeze panes
  ExcelFormatService.freezePanes(worksheet, true);

  console.log(
    `[TaskReport] Raw Task Data sheet generated successfully with ${tasks.length} records`
  );
}
