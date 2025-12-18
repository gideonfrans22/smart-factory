import ExcelJS from "exceljs";
import mongoose from "mongoose";
import { Alert } from "../models/Alert";
import { Project } from "../models/Project";
import { Task } from "../models/Task";
import * as ExcelFormatService from "./excelFormatService";

/**
 * Production Rate Report Data Aggregation Service
 * Handles all data queries and calculations for production efficiency reports
 */

// ==================== INTERFACES ====================

export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

export interface ProductionByRecipe {
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
  avgTimePerExecution: number; // in minutes
  estimatedTimePerExecution: number; // in minutes
  efficiency: number; // percentage
  status: "ON_TRACK" | "AT_RISK" | "DELAYED";
}

export interface StepEfficiency {
  stepOrder: number;
  stepName: string;
  recipeId: string;
  deviceTypeId: string;
  deviceTypeName: string;
  avgEstimatedDuration: number; // in minutes
  avgActualDuration: number; // in minutes
  deviation: number; // Actual - Estimated (in minutes)
  deviationPercentage: number; // percentage
  efficiency: number; // (Estimated / Actual) × 100%
  executionCount: number;
  totalTimeSaved: number; // negative = time lost (in minutes)
  isBottleneck: boolean;
}

export interface Bottleneck {
  stepOrder: number;
  stepName: string;
  recipeId: string;
  recipeName: string;
  deviceTypeId: string;
  deviceTypeName: string;
  avgDelay: number; // in seconds
  deviationPercentage: number;
  impactScore: number; // Higher = more critical
  executionCount: number;
  recommendation: string;
}

export interface WeeklyMetrics {
  weekNumber: number;
  weekLabel: string; // e.g., "Week 1: Jan 1-7"
  startDate: string;
  endDate: string;
  productionVolume: number; // completed executions
  totalTasks: number;
  completedTasks: number;
  efficiency: number; // percentage
  avgTimePerTask: number;
}

export interface ProductionForecast {
  recipeId: string;
  recipeName: string;
  currentProgress: number;
  targetQuantity: number;
  producedQuantity: number;
  remainingQuantity: number;
  avgProductionRate: number; // units per day
  estimatedCompletionDate: Date;
  daysRemaining: number;
  isOnTrack: boolean;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
}

export interface OverallEfficiencyMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  overallCompletionRate: number;
  overallEfficiency: number;
  avgTaskCompletionTime: number;
  avgTaskEstimatedTime: number;
  onTimeDeliveryRate: number;
  capacityUtilization: number;
}

export interface RecipeProductionTrend {
  recipeId: string;
  recipeName: string;
  weeklyData: Array<{
    weekLabel: string;
    completed: number;
    efficiency: number;
  }>;
}

// ==================== KPI INTERFACES ====================

export interface ProductProductionRate {
  productId: string;
  productName: string;
  targetQuantity: number;
  producedQuantity: number;
  productionRate: number; // percentage
}

export interface PriorityDistribution {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  URGENT: number;
}

export interface CustomerProduction {
  customerName: string;
  productionVolume: number;
  percentage: number;
}

export interface ProductWorkingHours {
  productId: string;
  productName: string;
  minHours: number;
  maxHours: number;
  totalHours: number;
}

export interface ProjectLeadTime {
  projectId: string;
  projectName: string;
  startDate: Date;
  endDate: Date;
  leadTimeDays: number;
}

export interface MachineTypeErrorRate {
  deviceTypeId: string;
  deviceTypeName: string;
  errorCount: number;
  errorRate: number; // percentage
}

// ==================== DATA AGGREGATION FUNCTIONS ====================

/**
 * Aggregate production metrics by recipe
 */
export async function aggregateProductionByRecipe(
  dateRange: DateRangeFilter
): Promise<ProductionByRecipe[]> {
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
        targetQuantity: "$totalExecutions",
        producedQuantity: "$completedExecutions",
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
        avgTimePerExecution: {
          $cond: [
            { $gt: ["$completedExecutions", 0] },
            { $divide: ["$totalActualDuration", "$completedExecutions"] },
            0
          ]
        },
        estimatedTimePerExecution: {
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

  // Determine status
  return recipeStats.map((recipe) => {
    let status: "ON_TRACK" | "AT_RISK" | "DELAYED";
    if (recipe.progress >= 90) {
      status = "ON_TRACK";
    } else if (recipe.efficiency < 80) {
      status = "DELAYED";
    } else if (recipe.efficiency < 90 || recipe.progress < 50) {
      status = "AT_RISK";
    } else {
      status = "ON_TRACK";
    }

    return { ...recipe, status };
  });
}

/**
 * Calculate step efficiency for all recipes
 */
export async function calculateStepEfficiency(
  dateRange: DateRangeFilter
): Promise<StepEfficiency[]> {
  const { startDate, endDate } = dateRange;

  const stepStats = await Task.aggregate([
    {
      $match: {
        status: "COMPLETED",
        actualDuration: { $gt: 0 },
        estimatedDuration: { $gt: 0 },
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
          stepOrder: "$stepOrder",
          deviceTypeId: "$deviceTypeId"
        },
        executionCount: { $sum: 1 },
        avgEstimatedDuration: { $avg: "$estimatedDuration" },
        avgActualDuration: { $avg: "$actualDuration" }
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
        recipeId: { $toString: "$_id.recipeId" },
        deviceTypeId: { $toString: "$_id.deviceTypeId" },
        deviceTypeName: { $arrayElemAt: ["$deviceType.name", 0] },
        avgEstimatedDuration: 1,
        avgActualDuration: 1,
        executionCount: 1,
        deviation: {
          $subtract: ["$avgActualDuration", "$avgEstimatedDuration"]
        },
        deviationPercentage: {
          $multiply: [
            {
              $divide: [
                { $subtract: ["$avgActualDuration", "$avgEstimatedDuration"] },
                "$avgEstimatedDuration"
              ]
            },
            100
          ]
        },
        efficiency: {
          $multiply: [
            { $divide: ["$avgEstimatedDuration", "$avgActualDuration"] },
            100
          ]
        },
        totalTimeSaved: {
          $multiply: [
            { $subtract: ["$avgEstimatedDuration", "$avgActualDuration"] },
            "$executionCount"
          ]
        }
      }
    },
    {
      $sort: { deviation: -1 } // Worst performers first
    }
  ]);

  // Get step names from recipe snapshots
  const enrichedStats: StepEfficiency[] = [];

  for (const stat of stepStats) {
    const tasks = await Task.find({
      recipeId: new mongoose.Types.ObjectId(stat.recipeId),
      stepOrder: stat.stepOrder
    })
      .populate("recipeSnapshotId")
      .limit(1)
      .lean();

    let stepName = `Step ${stat.stepOrder}`;
    if (tasks.length > 0 && tasks[0].recipeSnapshotId) {
      const snapshot: any = tasks[0].recipeSnapshotId;
      const step = snapshot.steps?.find((s: any) => s.order === stat.stepOrder);
      stepName = step?.name || stepName;
    }

    enrichedStats.push({
      ...stat,
      stepName,
      isBottleneck: stat.deviation > 0 && stat.deviationPercentage > 20 // More than 20% over estimate
    });
  }

  return enrichedStats;
}

/**
 * Identify production bottlenecks
 */
export async function identifyBottlenecks(
  dateRange: DateRangeFilter,
  topN: number = 10
): Promise<Bottleneck[]> {
  const stepEfficiencies = await calculateStepEfficiency(dateRange);

  // Filter for actual bottlenecks (positive deviation > 10%)
  const bottlenecks = stepEfficiencies
    .filter((step) => step.deviation > 0 && step.deviationPercentage > 10)
    .map((step) => {
      // Calculate impact score: deviation × execution count × efficiency loss
      const impactScore =
        step.deviation * step.executionCount * (100 - step.efficiency);

      // Generate recommendation
      let recommendation: string;
      if (step.deviationPercentage > 50) {
        recommendation = `CRITICAL: Investigate ${step.deviceTypeName} operations immediately`;
      } else if (step.deviationPercentage > 30) {
        recommendation = `HIGH: Review ${step.stepName} process and worker training`;
      } else if (step.deviationPercentage > 20) {
        recommendation = `MEDIUM: Consider optimizing ${step.stepName} workflow`;
      } else {
        recommendation = `LOW: Monitor ${step.stepName} for trends`;
      }

      return {
        stepOrder: step.stepOrder,
        stepName: step.stepName,
        recipeId: step.recipeId,
        recipeName: "", // Will be enriched
        deviceTypeId: step.deviceTypeId,
        deviceTypeName: step.deviceTypeName,
        avgDelay: step.deviation,
        deviationPercentage: step.deviationPercentage,
        impactScore,
        executionCount: step.executionCount,
        recommendation
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, topN);

  // Enrich with recipe names
  for (const bottleneck of bottlenecks) {
    const tasks = await Task.find({
      recipeId: new mongoose.Types.ObjectId(bottleneck.recipeId)
    })
      .populate("recipeId", "name")
      .limit(1)
      .lean();

    if (tasks.length > 0 && tasks[0].recipeId) {
      bottleneck.recipeName = (tasks[0].recipeId as any).name;
    }
  }

  return bottlenecks;
}

/**
 * Calculate week-over-week metrics
 */
export async function calculateWeekOverWeekMetrics(
  dateRange: DateRangeFilter
): Promise<WeeklyMetrics[]> {
  const { startDate, endDate } = dateRange;

  // Calculate number of weeks
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const totalMs = endDate.getTime() - startDate.getTime();
  const weekCount = Math.ceil(totalMs / msPerWeek);

  const weeklyMetrics: WeeklyMetrics[] = [];

  for (let week = 0; week < weekCount; week++) {
    const weekStart = new Date(startDate.getTime() + week * msPerWeek);
    const weekEnd = new Date(
      Math.min(weekStart.getTime() + msPerWeek, endDate.getTime())
    );

    const weekStats = await Task.aggregate([
      {
        $match: {
          $or: [
            { createdAt: { $gte: weekStart, $lte: weekEnd } },
            { startedAt: { $gte: weekStart, $lte: weekEnd } },
            { completedAt: { $gte: weekStart, $lte: weekEnd } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
          },
          productionVolume: {
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
          totalEstimatedDuration: { $sum: "$estimatedDuration" },
          totalActualDuration: {
            $sum: {
              $cond: [{ $eq: ["$status", "COMPLETED"] }, "$actualDuration", 0]
            }
          }
        }
      }
    ]);

    const stats = weekStats[0] || {
      totalTasks: 0,
      completedTasks: 0,
      productionVolume: 0,
      totalEstimatedDuration: 0,
      totalActualDuration: 0
    };

    const efficiency =
      stats.totalActualDuration > 0
        ? (stats.totalEstimatedDuration / stats.totalActualDuration) * 100
        : 0;

    const avgTimePerTask =
      stats.completedTasks > 0
        ? stats.totalActualDuration / stats.completedTasks
        : 0;

    weeklyMetrics.push({
      weekNumber: week + 1,
      weekLabel: `Week ${
        week + 1
      }: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
      startDate: weekStart.toISOString().split("T")[0],
      endDate: weekEnd.toISOString().split("T")[0],
      productionVolume: stats.productionVolume,
      totalTasks: stats.totalTasks,
      completedTasks: stats.completedTasks,
      efficiency,
      avgTimePerTask
    });
  }

  return weeklyMetrics;
}

/**
 * Generate production forecast for active recipes
 */
export async function generateProductionForecast(
  dateRange: DateRangeFilter
): Promise<ProductionForecast[]> {
  const productionData = await aggregateProductionByRecipe(dateRange);

  const forecasts: ProductionForecast[] = [];
  const { startDate, endDate } = dateRange;
  const periodDays =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

  for (const recipe of productionData) {
    if (recipe.completedExecutions === 0 || recipe.progress >= 100) {
      continue; // Skip if no progress or already complete
    }

    const remainingQuantity = recipe.targetQuantity - recipe.producedQuantity;
    const avgProductionRate = recipe.completedExecutions / periodDays;
    const daysRemaining =
      avgProductionRate > 0 ? remainingQuantity / avgProductionRate : Infinity;
    const estimatedCompletionDate = new Date(
      Date.now() + daysRemaining * 24 * 60 * 60 * 1000
    );

    // Determine if on track
    const expectedProgress = (periodDays / (periodDays + daysRemaining)) * 100;
    const isOnTrack = recipe.progress >= expectedProgress * 0.9; // Within 90% of expected

    // Confidence level based on data quality
    let confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
    if (recipe.completedExecutions >= 10 && periodDays >= 7) {
      confidenceLevel = "HIGH";
    } else if (recipe.completedExecutions >= 5 && periodDays >= 3) {
      confidenceLevel = "MEDIUM";
    } else {
      confidenceLevel = "LOW";
    }

    forecasts.push({
      recipeId: recipe.recipeId,
      recipeName: recipe.recipeName,
      currentProgress: recipe.progress,
      targetQuantity: recipe.targetQuantity,
      producedQuantity: recipe.producedQuantity,
      remainingQuantity,
      avgProductionRate,
      estimatedCompletionDate,
      daysRemaining: Math.ceil(daysRemaining),
      isOnTrack,
      confidenceLevel
    });
  }

  return forecasts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Calculate overall production efficiency metrics
 */
export async function calculateOverallEfficiency(
  dateRange: DateRangeFilter
): Promise<OverallEfficiencyMetrics> {
  const { startDate, endDate } = dateRange;

  // Project statistics
  const projectStats = await Project.aggregate([
    {
      $match: {
        createdAt: { $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalProjects: { $sum: 1 },
        activeProjects: {
          $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] }
        },
        completedProjects: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        }
      }
    }
  ]);

  const projects = projectStats[0] || {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0
  };

  // Task statistics
  const taskStats = await Task.aggregate([
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
        totalTasks: { $sum: 1 },
        completedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        failedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] }
        },
        totalActualDuration: {
          $sum: {
            $cond: [{ $eq: ["$status", "COMPLETED"] }, "$actualDuration", 0]
          }
        },
        totalEstimatedDuration: { $sum: "$estimatedDuration" },
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

  const tasks = taskStats[0] || {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalActualDuration: 0,
    totalEstimatedDuration: 0,
    onTimeCount: 0
  };

  // Calculate metrics
  const overallCompletionRate =
    tasks.totalTasks > 0 ? (tasks.completedTasks / tasks.totalTasks) * 100 : 0;

  const overallEfficiency =
    tasks.totalActualDuration > 0
      ? (tasks.totalEstimatedDuration / tasks.totalActualDuration) * 100
      : 0;

  const avgTaskCompletionTime =
    tasks.completedTasks > 0
      ? tasks.totalActualDuration / tasks.completedTasks
      : 0;

  const avgTaskEstimatedTime =
    tasks.totalTasks > 0 ? tasks.totalEstimatedDuration / tasks.totalTasks : 0;

  const onTimeDeliveryRate =
    tasks.completedTasks > 0
      ? (tasks.onTimeCount / tasks.completedTasks) * 100
      : 0;

  // Capacity utilization (simplified - based on task completion rate)
  const capacityUtilization = Math.min(overallCompletionRate, 100);

  return {
    totalProjects: projects.totalProjects,
    activeProjects: projects.activeProjects,
    completedProjects: projects.completedProjects,
    totalTasks: tasks.totalTasks,
    completedTasks: tasks.completedTasks,
    failedTasks: tasks.failedTasks,
    overallCompletionRate,
    overallEfficiency,
    avgTaskCompletionTime,
    avgTaskEstimatedTime,
    onTimeDeliveryRate,
    capacityUtilization
  };
}

/**
 * Get recipe production trends for charts
 */
export async function getRecipeProductionTrends(
  dateRange: DateRangeFilter,
  topRecipes: number = 5
): Promise<RecipeProductionTrend[]> {
  const { startDate, endDate } = dateRange;

  // Get top recipes by production volume
  const topRecipesList = await Task.aggregate([
    {
      $match: {
        status: "COMPLETED",
        isLastStepInRecipe: true,
        completedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: "$recipeId",
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: topRecipes
    }
  ]);

  const recipeIds = topRecipesList.map((r) => r._id);

  // Calculate weekly metrics
  const weeklyMetrics = await calculateWeekOverWeekMetrics(dateRange);

  const trends: RecipeProductionTrend[] = [];

  for (const recipeId of recipeIds) {
    const weeklyData = [];

    for (const week of weeklyMetrics) {
      const weekStart = new Date(week.startDate);
      const weekEnd = new Date(week.endDate);

      const weekRecipeStats = await Task.aggregate([
        {
          $match: {
            recipeId: recipeId,
            status: "COMPLETED",
            isLastStepInRecipe: true,
            completedAt: { $gte: weekStart, $lte: weekEnd }
          }
        },
        {
          $group: {
            _id: null,
            completed: { $sum: 1 },
            totalEstimatedDuration: { $sum: "$estimatedDuration" },
            totalActualDuration: { $sum: "$actualDuration" }
          }
        }
      ]);

      const stats = weekRecipeStats[0] || {
        completed: 0,
        totalEstimatedDuration: 0,
        totalActualDuration: 0
      };

      const efficiency =
        stats.totalActualDuration > 0
          ? (stats.totalEstimatedDuration / stats.totalActualDuration) * 100
          : 0;

      weeklyData.push({
        weekLabel: week.weekLabel,
        completed: stats.completed,
        efficiency
      });
    }

    // Get recipe name
    const task = await Task.findOne({ recipeId })
      .populate("recipeId", "name")
      .lean();

    trends.push({
      recipeId: recipeId.toString(),
      recipeName: task?.recipeId ? (task.recipeId as any).name : "Unknown",
      weeklyData
    });
  }

  return trends;
}

// ==================== KPI CALCULATION FUNCTIONS ====================

/**
 * Calculate delivery delay count: Projects that are late to finish
 */
export async function calculateDeliveryDelayCount(
  dateRange: DateRangeFilter
): Promise<number> {
  const { startDate, endDate } = dateRange;

  const delayedProjects = await Project.countDocuments({
    $and: [
      {
        $or: [
          // Completed projects that finished after deadline
          {
            status: "COMPLETED",
            deadline: { $exists: true, $ne: null },
            endDate: { $exists: true, $ne: null },
            $expr: { $gt: ["$endDate", "$deadline"] }
          },
          // Active projects past their deadline
          {
            status: { $in: ["ACTIVE", "ON_HOLD"] },
            deadline: { $exists: true, $ne: null, $lt: endDate }
          }
        ]
      },
      {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } }
        ]
      }
    ]
  });

  return delayedProjects;
}

/**
 * Calculate production rate by product: Actual production/target production
 */
export async function calculateProductionRateByProduct(
  dateRange: DateRangeFilter
): Promise<ProductProductionRate[]> {
  const { startDate, endDate } = dateRange;

  const productStats = await Project.aggregate([
    {
      $match: {
        product: { $exists: true, $ne: null },
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $group: {
        _id: "$product",
        targetQuantity: { $sum: "$targetQuantity" },
        producedQuantity: { $sum: "$producedQuantity" }
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    {
      $unwind: {
        path: "$product",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        productId: { $toString: "$_id" },
        productName: {
          $ifNull: ["$product.productName", "Unknown Product"]
        },
        targetQuantity: 1,
        producedQuantity: 1,
        productionRate: {
          $cond: [
            { $gt: ["$targetQuantity", 0] },
            {
              $multiply: [
                { $divide: ["$producedQuantity", "$targetQuantity"] },
                100
              ]
            },
            0
          ]
        }
      }
    },
    {
      $sort: { productionRate: -1 }
    }
  ]);

  return productStats;
}

/**
 * Calculate overall product production rate: Actual Output/Target Output
 */
export async function calculateOverallProductionRate(
  dateRange: DateRangeFilter
): Promise<number> {
  const { startDate, endDate } = dateRange;

  const totals = await Project.aggregate([
    {
      $match: {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        totalTarget: { $sum: "$targetQuantity" },
        totalProduced: { $sum: "$producedQuantity" }
      }
    }
  ]);

  if (totals.length === 0 || totals[0].totalTarget === 0) {
    return 0;
  }

  return (totals[0].totalProduced / totals[0].totalTarget) * 100;
}

/**
 * Calculate priority ratio: Distribution percentage of each priority level
 */
export async function calculatePriorityRatio(
  dateRange: DateRangeFilter
): Promise<PriorityDistribution> {
  const { startDate, endDate } = dateRange;

  const priorityStats = await Project.aggregate([
    {
      $match: {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $group: {
        _id: "$priority",
        count: { $sum: 1 }
      }
    }
  ]);

  const total = priorityStats.reduce((sum, stat) => sum + stat.count, 0);

  const distribution: PriorityDistribution = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0
  };

  priorityStats.forEach((stat) => {
    const priority = stat._id as keyof PriorityDistribution;
    if (total > 0) {
      distribution[priority] = (stat.count / total) * 100;
    }
  });

  return distribution;
}

/**
 * Calculate percentage of customers: Percentage of production volume by customer
 */
export async function calculateCustomerProductionPercentage(
  dateRange: DateRangeFilter
): Promise<CustomerProduction[]> {
  const { startDate, endDate } = dateRange;

  const customerStats = await Project.aggregate([
    {
      $match: {
        productSnapshot: { $exists: true, $ne: null },
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } }
        ]
      }
    },
    {
      $lookup: {
        from: "productsnapshots",
        localField: "productSnapshot",
        foreignField: "_id",
        as: "productSnapshot"
      }
    },
    {
      $unwind: {
        path: "$productSnapshot",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: {
          $ifNull: ["$productSnapshot.customerName", "Unknown Customer"]
        },
        productionVolume: { $sum: "$producedQuantity" }
      }
    },
    {
      $group: {
        _id: null,
        totalVolume: { $sum: "$productionVolume" },
        customers: { $push: "$$ROOT" }
      }
    },
    {
      $unwind: "$customers"
    },
    {
      $project: {
        _id: 0,
        customerName: "$customers._id",
        productionVolume: "$customers.productionVolume",
        percentage: {
          $cond: [
            { $gt: ["$totalVolume", 0] },
            {
              $multiply: [
                { $divide: ["$customers.productionVolume", "$totalVolume"] },
                100
              ]
            },
            0
          ]
        }
      }
    },
    {
      $sort: { productionVolume: -1 }
    }
  ]);

  return customerStats;
}

/**
 * Calculate part defect rate: Number of defective parts/part production
 */
export async function calculatePartDefectRate(
  dateRange: DateRangeFilter
): Promise<number> {
  const { startDate, endDate } = dateRange;

  const [defectCount, totalParts] = await Promise.all([
    Alert.countDocuments({
      type: "DEFECT",
      createdAt: { $gte: startDate, $lte: endDate }
    }),
    Project.aggregate([
      {
        $match: {
          $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { startDate: { $gte: startDate, $lte: endDate } },
            { endDate: { $gte: startDate, $lte: endDate } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$producedQuantity" }
        }
      }
    ])
  ]);

  const totalPartsProduced = totalParts.length > 0 ? totalParts[0].total : 0;

  if (totalPartsProduced === 0) {
    return 0;
  }

  return (defectCount / totalPartsProduced) * 100;
}

/**
 * Calculate working hours by product: Minimum time, maximum time, total time
 */
export async function calculateWorkingHoursByProduct(
  dateRange: DateRangeFilter
): Promise<ProductWorkingHours[]> {
  const { startDate, endDate } = dateRange;

  const productHours = await Task.aggregate([
    {
      $match: {
        status: "COMPLETED",
        actualDuration: { $gt: 0 },
        completedAt: { $gte: startDate, $lte: endDate },
        productId: { $exists: true, $ne: null }
      }
    },
    {
      $lookup: {
        from: "projects",
        localField: "projectId",
        foreignField: "_id",
        as: "project"
      }
    },
    {
      $unwind: {
        path: "$project",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: "productsnapshots",
        localField: "project.productSnapshot",
        foreignField: "_id",
        as: "productSnapshot"
      }
    },
    {
      $unwind: {
        path: "$productSnapshot",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: {
          $ifNull: ["$productSnapshot.originalProductId", "$productId", null]
        },
        productName: {
          $first: {
            $ifNull: ["$productSnapshot.name", "Unknown Product"]
          }
        },
        durations: { $push: "$actualDuration" },
        totalHours: { $sum: { $divide: ["$actualDuration", 60] } }
      }
    },
    {
      $project: {
        productId: { $toString: "$_id" },
        productName: 1,
        minHours: {
          $divide: [{ $min: "$durations" }, 60]
        },
        maxHours: {
          $divide: [{ $max: "$durations" }, 60]
        },
        totalHours: 1
      }
    },
    {
      $sort: { totalHours: -1 }
    }
  ]);

  return productHours;
}

/**
 * Calculate lead time: Total time from start date to complete date
 */
export async function calculateLeadTime(
  dateRange: DateRangeFilter
): Promise<ProjectLeadTime[]> {
  const { startDate, endDate } = dateRange;

  const projects = await Project.find({
    status: "COMPLETED",
    startDate: { $exists: true, $ne: null },
    endDate: { $exists: true, $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } }
    ]
  })
    .select("_id name startDate endDate")
    .lean();

  return projects.map((project) => {
    const leadTimeMs =
      new Date(project.endDate!).getTime() -
      new Date(project.startDate!).getTime();
    const leadTimeDays = Math.ceil(leadTimeMs / (1000 * 60 * 60 * 24));

    return {
      projectId: project._id.toString(),
      projectName: project.name,
      startDate: project.startDate!,
      endDate: project.endDate!,
      leadTimeDays
    };
  });
}

/**
 * Calculate machine type error rate: error occurrences per machine type/total error over all machine types
 */
export async function calculateMachineTypeErrorRate(
  dateRange: DateRangeFilter
): Promise<MachineTypeErrorRate[]> {
  const { startDate, endDate } = dateRange;

  const errorStats = await Alert.aggregate([
    {
      $match: {
        type: "MACHINE_ERROR",
        createdAt: { $gte: startDate, $lte: endDate },
        device: { $exists: true, $ne: null }
      }
    },
    {
      $lookup: {
        from: "devices",
        localField: "device",
        foreignField: "_id",
        as: "device"
      }
    },
    {
      $unwind: {
        path: "$device",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: "devicetypes",
        localField: "device.deviceTypeId",
        foreignField: "_id",
        as: "deviceType"
      }
    },
    {
      $unwind: {
        path: "$deviceType",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $group: {
        _id: "$deviceType._id",
        deviceTypeName: { $first: "$deviceType.name" },
        errorCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        totalErrors: { $sum: "$errorCount" },
        types: { $push: "$$ROOT" }
      }
    },
    {
      $unwind: "$types"
    },
    {
      $project: {
        _id: 0,
        deviceTypeId: { $toString: "$types._id" },
        deviceTypeName: {
          $ifNull: ["$types.deviceTypeName", "Unknown Device Type"]
        },
        errorCount: "$types.errorCount",
        errorRate: {
          $cond: [
            { $gt: ["$totalErrors", 0] },
            {
              $multiply: [
                { $divide: ["$types.errorCount", "$totalErrors"] },
                100
              ]
            },
            0
          ]
        }
      }
    },
    {
      $sort: { errorCount: -1 }
    }
  ]);

  return errorStats;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Adjust date range based on period type
 */
export function adjustDateRangeForPeriod(
  startDate: Date,
  endDate: Date,
  period?: "daily" | "weekly" | "monthly"
): DateRangeFilter {
  if (!period) {
    return { startDate, endDate };
  }

  const adjustedStart = new Date(startDate);
  const adjustedEnd = new Date(endDate);

  switch (period) {
    case "daily":
      // Set to start of day and end of same day
      adjustedStart.setHours(0, 0, 0, 0);
      adjustedEnd.setTime(adjustedStart.getTime());
      adjustedEnd.setHours(23, 59, 59, 999);
      break;

    case "weekly":
      // Set to Monday of the week containing startDate
      const dayOfWeek = adjustedStart.getDay();
      const diff =
        adjustedStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      adjustedStart.setDate(diff);
      adjustedStart.setHours(0, 0, 0, 0);
      // Set to Sunday of the same week
      adjustedEnd.setTime(adjustedStart.getTime());
      adjustedEnd.setDate(adjustedStart.getDate() + 6);
      adjustedEnd.setHours(23, 59, 59, 999);
      break;

    case "monthly":
      // Set to first day of month
      adjustedStart.setDate(1);
      adjustedStart.setHours(0, 0, 0, 0);
      // Set to last day of month
      adjustedEnd.setMonth(adjustedStart.getMonth() + 1);
      adjustedEnd.setDate(0);
      adjustedEnd.setHours(23, 59, 59, 999);
      break;
  }

  return { startDate: adjustedStart, endDate: adjustedEnd };
}

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
 * Create bilingual header (English / Korean)
 */
function bilingualLabel(en: string, ko: string): string {
  return `${en} / ${ko}`;
}

// ==================== SHEET GENERATION FUNCTIONS ====================

/**
 * SHEET 1: Production Overview
 * Overall production metrics, recipe/product completion rates, trends
 */
export async function generateProductionOverviewSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter
): Promise<void> {
  console.log("Generating Production Overview Sheet...");

  const worksheet = workbook.addWorksheet("Production Overview");
  let currentRow = 1;

  // ===== TITLE =====
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = bilingualLabel("PRODUCTION OVERVIEW", "생산 개요");
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // Get overall efficiency metrics
  const overallMetrics = await calculateOverallEfficiency(dateRange);

  // ===== OVERALL STATISTICS =====
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const statsHeaderCell = worksheet.getCell(`A${currentRow}`);
  statsHeaderCell.value = "Overall Production Statistics";
  statsHeaderCell.font = { size: 14, bold: true };
  statsHeaderCell.alignment = { horizontal: "left" };
  currentRow++;

  const statsData = [
    [
      "Total Projects:",
      overallMetrics.totalProjects,
      "Active Projects:",
      overallMetrics.activeProjects
    ],
    [
      "Completed Projects:",
      overallMetrics.completedProjects,
      "Total Tasks:",
      overallMetrics.totalTasks
    ],
    [
      "Completed Tasks:",
      overallMetrics.completedTasks,
      "Failed Tasks:",
      overallMetrics.failedTasks
    ],
    [
      "Completion Rate:",
      `${overallMetrics.overallCompletionRate.toFixed(1)}%`,
      "Efficiency:",
      `${overallMetrics.overallEfficiency.toFixed(1)}%`
    ],
    [
      "Avg Task Time:",
      formatDuration(overallMetrics.avgTaskCompletionTime),
      "Avg Estimated Time:",
      formatDuration(overallMetrics.avgTaskEstimatedTime)
    ],
    [
      "On-Time Delivery:",
      `${overallMetrics.onTimeDeliveryRate.toFixed(1)}%`,
      "Capacity Utilization:",
      `${overallMetrics.capacityUtilization.toFixed(1)}%`
    ]
  ];

  statsData.forEach((row) => {
    row.forEach((val, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = val;
      cell.font = { bold: idx % 2 === 0 };
      cell.alignment = { horizontal: "left", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Color code percentage cells
      if (idx % 2 === 1 && typeof val === "string" && val.includes("%")) {
        const numValue = parseFloat(val);
        let color = ExcelFormatService.COLORS.DANGER;
        if (numValue >= 90) color = ExcelFormatService.COLORS.SUCCESS;
        else if (numValue >= 75) color = "90CAF9"; // Light blue
        else if (numValue >= 60) color = ExcelFormatService.COLORS.WARNING;

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: color }
        };
        cell.font = {
          bold: true,
          color: { argb: numValue >= 60 ? "000000" : "FFFFFF" }
        };
      }
    });
    currentRow++;
  });

  currentRow += 2;

  // ===== RECIPE PRODUCTION TABLE =====
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const recipeHeaderCell = worksheet.getCell(`A${currentRow}`);
  recipeHeaderCell.value = "Recipe Production Status";
  recipeHeaderCell.font = { size: 14, bold: true };
  recipeHeaderCell.alignment = { horizontal: "left" };
  currentRow++;

  const productionData = await aggregateProductionByRecipe(dateRange);

  // Table headers
  const headers = [
    "Recipe Name",
    "Project",
    "Product",
    "Target Qty",
    "Produced",
    "Progress %",
    "Avg Time",
    "Efficiency %",
    "Status"
  ];

  headers.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow++;

  // Data rows
  productionData.forEach((recipe, index) => {
    const row = [
      recipe.recipeName,
      recipe.projectName || "N/A",
      recipe.productName || "N/A",
      recipe.targetQuantity,
      recipe.producedQuantity,
      recipe.progress.toFixed(1),
      formatDuration(recipe.avgTimePerExecution),
      recipe.efficiency.toFixed(1),
      recipe.status
    ];

    row.forEach((val, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = val;
      cell.alignment = {
        horizontal: idx <= 2 ? "left" : "center",
        vertical: "middle"
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Color code status column
      if (idx === 8) {
        const statusColors = {
          ON_TRACK: ExcelFormatService.COLORS.SUCCESS,
          AT_RISK: ExcelFormatService.COLORS.WARNING,
          DELAYED: ExcelFormatService.COLORS.DANGER
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: statusColors[recipe.status] }
        };
        cell.font = { bold: true, color: { argb: "FFFFFF" } };
      }

      // Alternating row colors
      if (index % 2 === 1 && idx !== 8) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
        };
      }
    });

    currentRow++;
  });

  currentRow += 2;

  // ===== PRODUCTION FORECAST =====
  const forecasts = await generateProductionForecast(dateRange);

  if (forecasts.length > 0) {
    worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
    const forecastHeaderCell = worksheet.getCell(`A${currentRow}`);
    forecastHeaderCell.value = "Production Forecast (Active Recipes)";
    forecastHeaderCell.font = { size: 14, bold: true };
    forecastHeaderCell.alignment = { horizontal: "left" };
    currentRow++;

    const forecastHeaders = [
      "Recipe Name",
      "Target Qty",
      "Produced",
      "Remaining",
      "Avg Rate/Day",
      "Days Remaining",
      "Est. Completion",
      "On Track",
      "Confidence"
    ];

    forecastHeaders.forEach((header, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    currentRow++;

    forecasts.forEach((forecast, index) => {
      const row = [
        forecast.recipeName,
        forecast.targetQuantity,
        forecast.producedQuantity,
        forecast.remainingQuantity,
        forecast.avgProductionRate.toFixed(2),
        forecast.daysRemaining,
        forecast.estimatedCompletionDate.toLocaleDateString(),
        forecast.isOnTrack ? "YES" : "NO",
        forecast.confidenceLevel
      ];

      row.forEach((val, idx) => {
        const cell = worksheet.getCell(currentRow, idx + 1);
        cell.value = val;
        cell.alignment = {
          horizontal: idx === 0 ? "left" : "center",
          vertical: "middle"
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };

        // Color code "On Track" column
        if (idx === 7) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: forecast.isOnTrack
                ? ExcelFormatService.COLORS.SUCCESS
                : ExcelFormatService.COLORS.DANGER
            }
          };
          cell.font = { bold: true, color: { argb: "FFFFFF" } };
        }

        // Alternating row colors
        if (index % 2 === 1 && idx !== 7) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
          };
        }
      });

      currentRow++;
    });
  }

  // Column widths
  worksheet.getColumn(1).width = 30;
  worksheet.getColumn(2).width = 25;
  worksheet.getColumn(3).width = 25;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 12;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 15;
  worksheet.getColumn(8).width = 12;
  worksheet.getColumn(9).width = 15;

  ExcelFormatService.freezePanes(worksheet);

  console.log(
    `✓ Production Overview Sheet generated with ${productionData.length} recipes`
  );
}

/**
 * SHEET 2: Step-by-Step Efficiency
 * Recipe step breakdown with timing analysis
 */
export async function generateStepEfficiencySheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter
): Promise<void> {
  console.log("Generating Step Efficiency Sheet...");

  const worksheet = workbook.addWorksheet("Step Efficiency");
  let currentRow = 1;

  // ===== TITLE =====
  worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = bilingualLabel(
    "STEP-BY-STEP EFFICIENCY ANALYSIS",
    "단계별 효율성 분석"
  );
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // Get step efficiency data
  const stepEfficiencies = await calculateStepEfficiency(dateRange);

  // ===== TABLE HEADERS =====
  const headers = [
    "Step Order",
    "Step Name",
    "Device Type",
    "Executions",
    "Avg Estimated",
    "Avg Actual",
    "Deviation",
    "Deviation %",
    "Efficiency %",
    "Time Saved",
    "Bottleneck"
  ];

  headers.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  worksheet.getRow(currentRow).height = 35;
  currentRow++;

  // ===== DATA ROWS =====
  stepEfficiencies.forEach((step, index) => {
    const row = [
      step.stepOrder,
      step.stepName,
      step.deviceTypeName,
      step.executionCount,
      formatDuration(step.avgEstimatedDuration),
      formatDuration(step.avgActualDuration),
      formatDuration(Math.abs(step.deviation)),
      step.deviationPercentage.toFixed(1),
      step.efficiency.toFixed(1),
      formatDuration(Math.abs(step.totalTimeSaved)),
      step.isBottleneck ? "YES" : "NO"
    ];

    row.forEach((val, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = val;
      cell.alignment = {
        horizontal: idx <= 2 ? "left" : "center",
        vertical: "middle"
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Color code efficiency column
      if (idx === 8) {
        const eff = step.efficiency;
        let color = ExcelFormatService.COLORS.DANGER;
        if (eff >= 90) color = ExcelFormatService.COLORS.SUCCESS;
        else if (eff >= 75) color = "90CAF9"; // Light blue
        else if (eff >= 60) color = ExcelFormatService.COLORS.WARNING;

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: color }
        };
        cell.font = {
          bold: true,
          color: { argb: eff >= 60 ? "000000" : "FFFFFF" }
        };
      }

      // Color code bottleneck column
      if (idx === 10) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: step.isBottleneck
              ? ExcelFormatService.COLORS.DANGER
              : ExcelFormatService.COLORS.SUCCESS
          }
        };
        cell.font = { bold: true, color: { argb: "FFFFFF" } };
      }

      // Alternating row colors
      if (index % 2 === 1 && idx !== 8 && idx !== 10) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
        };
      }
    });

    currentRow++;
  });

  // Column widths
  worksheet.getColumn(1).width = 12;
  worksheet.getColumn(2).width = 30;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 15;
  worksheet.getColumn(6).width = 15;
  worksheet.getColumn(7).width = 15;
  worksheet.getColumn(8).width = 12;
  worksheet.getColumn(9).width = 12;
  worksheet.getColumn(10).width = 15;
  worksheet.getColumn(11).width = 12;

  ExcelFormatService.freezePanes(worksheet);

  console.log(
    `✓ Step Efficiency Sheet generated with ${stepEfficiencies.length} steps`
  );
}

/**
 * SHEET 3: Bottleneck Analysis
 * Critical path analysis and slowest steps
 */
export async function generateBottleneckAnalysisSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter
): Promise<void> {
  console.log("Generating Bottleneck Analysis Sheet...");

  const worksheet = workbook.addWorksheet("Bottleneck Analysis");
  let currentRow = 1;

  // ===== TITLE =====
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = bilingualLabel(
    "PRODUCTION BOTTLENECK ANALYSIS",
    "생산 병목 분석"
  );
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // ===== SUMMARY =====
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const summaryCell = worksheet.getCell(`A${currentRow}`);
  summaryCell.value =
    "Bottlenecks are steps that consistently take longer than estimated (>10% deviation). Impact Score = Delay × Executions × Efficiency Loss.";
  summaryCell.font = { size: 11, italic: true };
  summaryCell.alignment = { horizontal: "center", wrapText: true };
  summaryCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3E0" }
  };
  worksheet.getRow(currentRow).height = 35;
  currentRow += 2;

  // Get bottleneck data
  const bottlenecks = await identifyBottlenecks(dateRange, 20);

  if (bottlenecks.length === 0) {
    worksheet.getCell(`A${currentRow}`).value =
      "No significant bottlenecks detected. All steps are performing within acceptable limits.";
    console.log("✓ Bottleneck Analysis Sheet generated (no bottlenecks)");
    return;
  }

  // ===== TABLE HEADERS =====
  const headers = [
    "Priority",
    "Step Name",
    "Recipe",
    "Device Type",
    "Avg Delay",
    "Deviation %",
    "Executions",
    "Impact Score",
    "Recommendation"
  ];

  headers.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  worksheet.getRow(currentRow).height = 35;
  currentRow++;

  // ===== DATA ROWS =====
  bottlenecks.forEach((bottleneck, index) => {
    const row = [
      index + 1,
      bottleneck.stepName,
      bottleneck.recipeName || "Unknown",
      bottleneck.deviceTypeName,
      formatDuration(bottleneck.avgDelay),
      bottleneck.deviationPercentage.toFixed(1),
      bottleneck.executionCount,
      bottleneck.impactScore.toFixed(0),
      bottleneck.recommendation
    ];

    row.forEach((val, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = val;
      cell.alignment = {
        horizontal: idx <= 3 || idx === 8 ? "left" : "center",
        vertical: "middle"
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Color code priority (top 3 are critical)
      if (idx === 0) {
        let color = ExcelFormatService.COLORS.NEUTRAL;
        if (index < 3) color = ExcelFormatService.COLORS.DANGER;
        else if (index < 7) color = ExcelFormatService.COLORS.WARNING;

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: color }
        };
        cell.font = {
          bold: true,
          color: { argb: index < 7 ? "FFFFFF" : "000000" }
        };
      }

      // Color code deviation percentage
      if (idx === 5) {
        const dev = bottleneck.deviationPercentage;
        let color = ExcelFormatService.COLORS.WARNING;
        if (dev >= 50) color = ExcelFormatService.COLORS.DANGER;
        else if (dev >= 30) color = "FFA726"; // Orange

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: color }
        };
        cell.font = { bold: true, color: { argb: "FFFFFF" } };
      }

      // Alternating row colors
      if (index % 2 === 1 && idx !== 0 && idx !== 5) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
        };
      }
    });

    currentRow++;
  });

  // Column widths
  worksheet.getColumn(1).width = 10;
  worksheet.getColumn(2).width = 30;
  worksheet.getColumn(3).width = 25;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 15;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 12;
  worksheet.getColumn(8).width = 15;
  worksheet.getColumn(9).width = 50;

  ExcelFormatService.freezePanes(worksheet);

  console.log(
    `✓ Bottleneck Analysis Sheet generated with ${bottlenecks.length} bottlenecks`
  );
}

/**
 * SHEET 4: Week-over-Week Trends
 * Weekly production rate comparison
 */
export async function generateProductionTrendsSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter
): Promise<void> {
  console.log("Generating Production Trends Sheet...");

  const worksheet = workbook.addWorksheet("Production Trends");
  let currentRow = 1;

  // ===== TITLE =====
  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = bilingualLabel(
    "WEEK-OVER-WEEK PRODUCTION TRENDS",
    "주간 생산 추세"
  );
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // Get weekly metrics
  const weeklyMetrics = await calculateWeekOverWeekMetrics(dateRange);

  // ===== WEEKLY METRICS TABLE =====
  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  const metricsHeaderCell = worksheet.getCell(`A${currentRow}`);
  metricsHeaderCell.value = "Weekly Production Metrics";
  metricsHeaderCell.font = { size: 14, bold: true };
  metricsHeaderCell.alignment = { horizontal: "left" };
  currentRow++;

  const headers = [
    "Week",
    "Week Label",
    "Production Volume",
    "Total Tasks",
    "Completed Tasks",
    "Efficiency %",
    "Avg Task Time",
    "Trend"
  ];

  headers.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow++;

  // Data rows with trend indicators
  weeklyMetrics.forEach((week, index) => {
    let trend = "→"; // Stable
    if (index > 0) {
      const prevWeek = weeklyMetrics[index - 1];
      if (week.efficiency > prevWeek.efficiency + 5) trend = "↑"; // Improving
      else if (week.efficiency < prevWeek.efficiency - 5) trend = "↓"; // Declining
    }

    const row = [
      week.weekNumber,
      week.weekLabel,
      week.productionVolume,
      week.totalTasks,
      week.completedTasks,
      week.efficiency.toFixed(1),
      formatDuration(week.avgTimePerTask),
      trend
    ];

    row.forEach((val, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = val;
      cell.alignment = {
        horizontal: idx === 1 ? "left" : "center",
        vertical: "middle"
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Color code efficiency
      if (idx === 5) {
        const eff = week.efficiency;
        let color = ExcelFormatService.COLORS.DANGER;
        if (eff >= 90) color = ExcelFormatService.COLORS.SUCCESS;
        else if (eff >= 75) color = "90CAF9"; // Light blue
        else if (eff >= 60) color = ExcelFormatService.COLORS.WARNING;

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: color }
        };
        cell.font = {
          bold: true,
          color: { argb: eff >= 60 ? "000000" : "FFFFFF" }
        };
      }

      // Color code trend
      if (idx === 7) {
        let color = ExcelFormatService.COLORS.NEUTRAL;
        if (trend === "↑") color = ExcelFormatService.COLORS.SUCCESS;
        else if (trend === "↓") color = ExcelFormatService.COLORS.DANGER;

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: color }
        };
        cell.font = { bold: true, size: 14 };
      }

      // Alternating row colors
      if (index % 2 === 1 && idx !== 5 && idx !== 7) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
        };
      }
    });

    currentRow++;
  });

  currentRow += 2;

  // ===== TREND SUMMARY =====
  const avgEfficiency =
    weeklyMetrics.length > 0
      ? weeklyMetrics.reduce((sum, w) => sum + w.efficiency, 0) /
        weeklyMetrics.length
      : 0;

  const totalProduction = weeklyMetrics.reduce(
    (sum, w) => sum + w.productionVolume,
    0
  );

  const efficiencyTrend =
    weeklyMetrics.length > 1
      ? weeklyMetrics[weeklyMetrics.length - 1].efficiency -
        weeklyMetrics[0].efficiency
      : 0;

  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  const summaryHeaderCell = worksheet.getCell(`A${currentRow}`);
  summaryHeaderCell.value = "Trend Summary";
  summaryHeaderCell.font = { size: 14, bold: true };
  summaryHeaderCell.alignment = { horizontal: "left" };
  currentRow++;

  const summaryData = [
    ["Total Weeks:", weeklyMetrics.length],
    ["Total Production Volume:", totalProduction],
    ["Average Efficiency:", `${avgEfficiency.toFixed(1)}%`],
    [
      "Efficiency Trend:",
      `${efficiencyTrend > 0 ? "+" : ""}${efficiencyTrend.toFixed(1)}%`
    ],
    [
      "Overall Trend:",
      efficiencyTrend > 5
        ? "Improving ↑"
        : efficiencyTrend < -5
        ? "Declining ↓"
        : "Stable →"
    ]
  ];

  summaryData.forEach((row) => {
    worksheet.getCell(currentRow, 1).value = row[0];
    worksheet.getCell(currentRow, 2).value = row[1];
    worksheet.getCell(currentRow, 1).font = { bold: true };
    currentRow++;
  });

  // Column widths
  worksheet.getColumn(1).width = 12;
  worksheet.getColumn(2).width = 30;
  worksheet.getColumn(3).width = 18;
  worksheet.getColumn(4).width = 15;
  worksheet.getColumn(5).width = 18;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 15;
  worksheet.getColumn(8).width = 10;

  ExcelFormatService.freezePanes(worksheet);

  console.log(
    `✓ Production Trends Sheet generated with ${weeklyMetrics.length} weeks`
  );
}

/**
 * SHEET 5: Raw Production Data
 * All production records - raw export format
 */
export async function generateRawProductionDataSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter
): Promise<void> {
  console.log("Generating Raw Production Data Sheet...");

  const worksheet = workbook.addWorksheet("Raw Production Data");
  let currentRow = 1;

  // ===== INSTRUCTIONS =====
  worksheet.mergeCells(`A${currentRow}:P${currentRow}`);
  const instructionsCell = worksheet.getCell(`A${currentRow}`);
  instructionsCell.value =
    "RAW PRODUCTION DATA EXPORT - This sheet contains all production-related task records in the date range. Use for data analysis, export/import, or integration with other systems.";
  instructionsCell.font = { size: 10, italic: true };
  instructionsCell.alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true
  };
  instructionsCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3E0" }
  };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // ===== HEADERS =====
  const headers = [
    "Task ID",
    "Project ID",
    "Project Name",
    "Recipe ID",
    "Recipe Exec #",
    "Total Execs",
    "Step Order",
    "Is Last Step",
    "Device Type ID",
    "Device ID",
    "Worker ID",
    "Status",
    "Estimated Duration (s)",
    "Actual Duration (s)",
    "Efficiency %",
    "Started At",
    "Completed At",
    "Created At"
  ];

  headers.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow++;

  // ===== FETCH DATA =====
  const { startDate, endDate } = dateRange;
  const tasks = await Task.find({
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  })
    .populate("projectId", "name")
    .lean()
    .sort({ completedAt: -1, createdAt: -1 });

  // ===== DATA ROWS =====
  tasks.forEach((task) => {
    const projectName = task.projectId ? (task.projectId as any).name : "N/A";

    const efficiency =
      task.status === "COMPLETED" &&
      task.actualDuration &&
      task.estimatedDuration
        ? (task.estimatedDuration / task.actualDuration) * 100
        : 0;

    const row = [
      task._id.toString(),
      task.projectId ? (task.projectId as any)._id.toString() : "N/A",
      projectName,
      task.recipeId?.toString() || "N/A",
      task.recipeExecutionNumber || 0,
      task.totalRecipeExecutions || 0,
      task.stepOrder || 0,
      task.isLastStepInRecipe ? "TRUE" : "FALSE",
      task.deviceTypeId?.toString() || "N/A",
      task.deviceId?.toString() || "N/A",
      task.workerId?.toString() || "N/A",
      task.status,
      task.estimatedDuration || 0,
      task.actualDuration || 0,
      efficiency > 0 ? efficiency.toFixed(1) : "N/A",
      task.startedAt ? task.startedAt.toISOString() : "N/A",
      task.completedAt ? task.completedAt.toISOString() : "N/A",
      task.createdAt.toISOString()
    ];

    row.forEach((val, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = val;
      cell.alignment = { horizontal: "left", vertical: "top" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    currentRow++;
  });

  // Column widths
  worksheet.getColumn(1).width = 25;
  worksheet.getColumn(2).width = 25;
  worksheet.getColumn(3).width = 25;
  worksheet.getColumn(4).width = 25;
  worksheet.getColumn(5).width = 12;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 12;
  worksheet.getColumn(8).width = 12;
  worksheet.getColumn(9).width = 25;
  worksheet.getColumn(10).width = 25;
  worksheet.getColumn(11).width = 25;
  worksheet.getColumn(12).width = 12;
  worksheet.getColumn(13).width = 20;
  worksheet.getColumn(14).width = 18;
  worksheet.getColumn(15).width = 12;
  worksheet.getColumn(16).width = 20;
  worksheet.getColumn(17).width = 20;
  worksheet.getColumn(18).width = 20;

  console.log(
    `✓ Raw Production Data Sheet generated with ${tasks.length} task records`
  );
}

/**
 * Generate comprehensive Production Rate KPI Sheet
 * Single sheet containing all KPI calculations
 */
export async function generateProductionRateKPISheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  period?: "daily" | "weekly" | "monthly"
): Promise<void> {
  console.log("Generating Production Rate KPI Sheet...");

  // Adjust date range based on period
  const adjustedDateRange = adjustDateRangeForPeriod(
    dateRange.startDate,
    dateRange.endDate,
    period
  );

  const worksheet = workbook.addWorksheet("Production Rate KPIs");
  let currentRow = 1;

  // ===== TITLE =====
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  const periodLabel = period
    ? period.charAt(0).toUpperCase() + period.slice(1)
    : "All Time";
  titleCell.value = `PRODUCTION RATE KPI REPORT - ${periodLabel}`;
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // Date range info
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const dateRangeCell = worksheet.getCell(`A${currentRow}`);
  dateRangeCell.value = `Date Range: ${adjustedDateRange.startDate.toLocaleDateString()} - ${adjustedDateRange.endDate.toLocaleDateString()}`;
  dateRangeCell.font = { size: 11 };
  dateRangeCell.alignment = { horizontal: "center" };
  currentRow += 2;

  // Calculate all KPIs in parallel
  const [
    deliveryDelayCount,
    productionRateByProduct,
    overallProductionRate,
    priorityRatio,
    customerProduction,
    partDefectRate,
    workingHoursByProduct,
    leadTimeData,
    machineTypeErrorRate
  ] = await Promise.all([
    calculateDeliveryDelayCount(adjustedDateRange),
    calculateProductionRateByProduct(adjustedDateRange),
    calculateOverallProductionRate(adjustedDateRange),
    calculatePriorityRatio(adjustedDateRange),
    calculateCustomerProductionPercentage(adjustedDateRange),
    calculatePartDefectRate(adjustedDateRange),
    calculateWorkingHoursByProduct(adjustedDateRange),
    calculateLeadTime(adjustedDateRange),
    calculateMachineTypeErrorRate(adjustedDateRange)
  ]);

  // ===== SECTION 1: Overall KPIs =====
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const section1Header = worksheet.getCell(`A${currentRow}`);
  section1Header.value = "Overall KPIs";
  section1Header.font = { size: 14, bold: true };
  section1Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  // Delivery Delay Count
  worksheet.getCell(`A${currentRow}`).value = "Delivery Delay Count:";
  worksheet.getCell(`B${currentRow}`).value = deliveryDelayCount;
  worksheet.getCell(`B${currentRow}`).font = { bold: true };
  currentRow++;

  // Overall Production Rate
  worksheet.getCell(`A${currentRow}`).value =
    "Overall Product Production Rate:";
  worksheet.getCell(`B${currentRow}`).value = `${overallProductionRate.toFixed(
    2
  )}%`;
  worksheet.getCell(`B${currentRow}`).font = { bold: true };
  worksheet.getCell(`B${currentRow}`).numFmt = "0.00";
  currentRow += 2;

  // ===== SECTION 2: Production Rate by Product =====
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const section2Header = worksheet.getCell(`A${currentRow}`);
  section2Header.value = "Production Rate by Product";
  section2Header.font = { size: 14, bold: true };
  section2Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  // Headers
  const productHeaders = [
    "Product Name",
    "Target Quantity",
    "Produced Quantity",
    "Production Rate (%)"
  ];
  productHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center" };
  });
  currentRow++;

  // Data rows
  productionRateByProduct.forEach((product) => {
    worksheet.getCell(`A${currentRow}`).value = product.productName;
    worksheet.getCell(`B${currentRow}`).value = product.targetQuantity;
    worksheet.getCell(`B${currentRow}`).numFmt = "#,##0";
    worksheet.getCell(`C${currentRow}`).value = product.producedQuantity;
    worksheet.getCell(`C${currentRow}`).numFmt = "#,##0";
    worksheet.getCell(`D${currentRow}`).value = product.productionRate;
    worksheet.getCell(`D${currentRow}`).numFmt = "0.00";
    currentRow++;
  });
  currentRow += 2;

  // ===== SECTION 3: Priority Distribution =====
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  const section3Header = worksheet.getCell(`A${currentRow}`);
  section3Header.value = "Priority Distribution";
  section3Header.font = { size: 14, bold: true };
  section3Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  // Headers
  worksheet.getCell(`A${currentRow}`).value = "Priority";
  worksheet.getCell(`B${currentRow}`).value = "Percentage (%)";
  [
    worksheet.getCell(`A${currentRow}`),
    worksheet.getCell(`B${currentRow}`)
  ].forEach((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center" };
  });
  currentRow++;

  // Data rows
  Object.entries(priorityRatio).forEach(([priority, percentage]) => {
    worksheet.getCell(`A${currentRow}`).value = priority;
    worksheet.getCell(`B${currentRow}`).value = percentage;
    worksheet.getCell(`B${currentRow}`).numFmt = "0.00";
    currentRow++;
  });
  currentRow += 2;

  // ===== SECTION 4: Customer Production Percentage =====
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  const section4Header = worksheet.getCell(`A${currentRow}`);
  section4Header.value = "Customer Production Percentage";
  section4Header.font = { size: 14, bold: true };
  section4Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  // Headers
  worksheet.getCell(`A${currentRow}`).value = "Customer Name";
  worksheet.getCell(`B${currentRow}`).value = "Production Volume";
  worksheet.getCell(`C${currentRow}`).value = "Percentage (%)";
  [
    worksheet.getCell(`A${currentRow}`),
    worksheet.getCell(`B${currentRow}`),
    worksheet.getCell(`C${currentRow}`)
  ].forEach((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center" };
  });
  currentRow++;

  // Data rows
  customerProduction.forEach((customer) => {
    worksheet.getCell(`A${currentRow}`).value = customer.customerName;
    worksheet.getCell(`B${currentRow}`).value = customer.productionVolume;
    worksheet.getCell(`B${currentRow}`).numFmt = "#,##0";
    worksheet.getCell(`C${currentRow}`).value = customer.percentage;
    worksheet.getCell(`C${currentRow}`).numFmt = "0.00";
    currentRow++;
  });
  currentRow += 2;

  // ===== SECTION 5: Part Defect Rate =====
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  const section5Header = worksheet.getCell(`A${currentRow}`);
  section5Header.value = "Part Defect Rate";
  section5Header.font = { size: 14, bold: true };
  section5Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  worksheet.getCell(`A${currentRow}`).value = "Defect Rate:";
  worksheet.getCell(`B${currentRow}`).value = `${partDefectRate.toFixed(2)}%`;
  worksheet.getCell(`B${currentRow}`).font = { bold: true };
  worksheet.getCell(`B${currentRow}`).numFmt = "0.00";
  currentRow += 2;

  // ===== SECTION 6: Working Hours by Product =====
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const section6Header = worksheet.getCell(`A${currentRow}`);
  section6Header.value = "Working Hours by Product";
  section6Header.font = { size: 14, bold: true };
  section6Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  // Headers
  const hoursHeaders = [
    "Product Name",
    "Minimum Hours",
    "Maximum Hours",
    "Total Hours"
  ];
  hoursHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center" };
  });
  currentRow++;

  // Data rows
  workingHoursByProduct.forEach((product) => {
    worksheet.getCell(`A${currentRow}`).value = product.productName;
    worksheet.getCell(`B${currentRow}`).value = product.minHours;
    worksheet.getCell(`B${currentRow}`).numFmt = "0.00";
    worksheet.getCell(`C${currentRow}`).value = product.maxHours;
    worksheet.getCell(`C${currentRow}`).numFmt = "0.00";
    worksheet.getCell(`D${currentRow}`).value = product.totalHours;
    worksheet.getCell(`D${currentRow}`).numFmt = "0.00";
    currentRow++;
  });
  currentRow += 2;

  // ===== SECTION 7: Lead Time Analysis =====
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const section7Header = worksheet.getCell(`A${currentRow}`);
  section7Header.value = "Lead Time Analysis";
  section7Header.font = { size: 14, bold: true };
  section7Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  // Headers
  const leadTimeHeaders = [
    "Project Name",
    "Start Date",
    "End Date",
    "Lead Time (Days)"
  ];
  leadTimeHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center" };
  });
  currentRow++;

  // Data rows
  leadTimeData.forEach((project) => {
    worksheet.getCell(`A${currentRow}`).value = project.projectName;
    worksheet.getCell(`B${currentRow}`).value = project.startDate;
    worksheet.getCell(`B${currentRow}`).numFmt = "yyyy-mm-dd";
    worksheet.getCell(`C${currentRow}`).value = project.endDate;
    worksheet.getCell(`C${currentRow}`).numFmt = "yyyy-mm-dd";
    worksheet.getCell(`D${currentRow}`).value = project.leadTimeDays;
    worksheet.getCell(`D${currentRow}`).numFmt = "#,##0";
    currentRow++;
  });
  currentRow += 2;

  // ===== SECTION 8: Machine Type Error Rate =====
  worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
  const section8Header = worksheet.getCell(`A${currentRow}`);
  section8Header.value = "Machine Type Error Rate";
  section8Header.font = { size: 14, bold: true };
  section8Header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "E0E0E0" }
  };
  currentRow++;

  // Headers
  const errorHeaders = ["Machine Type", "Error Count", "Error Rate (%)"];
  errorHeaders.forEach((header, idx) => {
    const cell = worksheet.getCell(currentRow, idx + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    cell.alignment = { horizontal: "center" };
  });
  currentRow++;

  // Data rows
  machineTypeErrorRate.forEach((machineType) => {
    worksheet.getCell(`A${currentRow}`).value = machineType.deviceTypeName;
    worksheet.getCell(`B${currentRow}`).value = machineType.errorCount;
    worksheet.getCell(`B${currentRow}`).numFmt = "#,##0";
    worksheet.getCell(`C${currentRow}`).value = machineType.errorRate;
    worksheet.getCell(`C${currentRow}`).numFmt = "0.00";
    currentRow++;
  });

  // Set column widths
  worksheet.getColumn(1).width = 30;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 18;
  worksheet.getColumn(4).width = 18;
  worksheet.getColumn(5).width = 18;

  // Freeze header rows
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  console.log("✓ Production Rate KPI Sheet generated successfully");
}
