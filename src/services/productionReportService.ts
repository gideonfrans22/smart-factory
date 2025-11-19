import mongoose from "mongoose";
import { Task } from "../models/Task";
import { Project } from "../models/Project";

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
  avgTimePerExecution: number; // in seconds
  estimatedTimePerExecution: number;
  efficiency: number; // percentage
  status: "ON_TRACK" | "AT_RISK" | "DELAYED";
}

export interface StepEfficiency {
  stepOrder: number;
  stepName: string;
  recipeId: string;
  deviceTypeId: string;
  deviceTypeName: string;
  avgEstimatedDuration: number;
  avgActualDuration: number;
  deviation: number; // Actual - Estimated (in seconds)
  deviationPercentage: number; // percentage
  efficiency: number; // (Estimated / Actual) × 100%
  executionCount: number;
  totalTimeSaved: number; // negative = time lost
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
