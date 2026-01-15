import ExcelJS from "exceljs";
import mongoose from "mongoose";
import { RecipeSnapshot } from "../models";
import { Alert } from "../models/Alert";
import { Project } from "../models/Project";
import { Task } from "../models/Task";
import * as ExcelFormatService from "./excelFormatService";
import { formatDateKorean } from "./excelFormatService";

/**
 * Production Rate Report Data Aggregation Service
 * Handles all data queries and calculations for production efficiency reports
 */

// ==================== TRANSLATIONS ====================

const TRANSLATIONS = {
  // Production Report (Productivity Report)
  productionReport: {
    title: {
      en: "Productivity Report",
      ko: "생산성 보고서"
    },
    referenceDateTime: {
      en: "Period",
      ko: "기준일시"
    },
    prepared: {
      en: "Prepared",
      ko: "작성"
    },
    reviewed: {
      en: "Reviewed",
      ko: "검토"
    },
    approved: {
      en: "Approved",
      ko: "승인"
    },
    overallKPIs: {
      en: "Overall KPIs",
      ko: "전체 KPI"
    },
    totalProductProduction: {
      en: "Total Product Production",
      ko: "전체 제품 생산량"
    },
    totalPartProduction: {
      en: "Total Part Production",
      ko: "전체 부품 생산량"
    },
    overallDeliveryComplianceRate: {
      en: "Overall Delivery Compliance Rate",
      ko: "전체 납기 준수율"
    },
    totalWorkers: {
      en: "Total Number of Workers",
      ko: "총 작업자 수(명)"
    },
    productStatus: {
      en: "Product Status",
      ko: "제품별 현황"
    },
    no: {
      en: "No.",
      ko: "순번"
    },
    productInfo: {
      en: "Product (SET) Info",
      ko: "제품(SET) 정보"
    },
    instructionNo: {
      en: "Instruction No.",
      ko: "지시번호"
    },
    designNo: {
      en: "Design No.",
      ko: "설계번호"
    },
    customer: {
      en: "Customer",
      ko: "고객사"
    },
    department: {
      en: "Department",
      ko: "부서"
    },
    personInCharge: {
      en: "Person in Charge",
      ko: "담당자"
    },
    orderDate: {
      en: "Order Date",
      ko: "발주일"
    },
    deliveryDate: {
      en: "Delivery Date",
      ko: "납기일"
    },
    quantity: {
      en: "Quantity",
      ko: "수량"
    },
    productionQuantity: {
      en: "Production Quantity",
      ko: "생산량"
    },
    remainingQuantity: {
      en: "Remaining Quantity",
      ko: "잔여수량"
    },
    completionRate: {
      en: "Completion Rate",
      ko: "완료율"
    },
    workTime: {
      en: "Work Time",
      ko: "작업시간"
    },
    deliveryDelays: {
      en: "Number of Delivery Delays",
      ko: "납기지연수"
    },
    deliveryComplianceRate: {
      en: "Delivery Compliance Rate",
      ko: "납기준수율"
    },
    partDetails: {
      en: "Part Details",
      ko: "부품 상세"
    },
    drawingNo: {
      en: "Dwg no",
      ko: "Dwg no"
    },
    partName: {
      en: "Part Name (PART)",
      ko: "부품명(PART)"
    },
    totalWorkTime: {
      en: "Total Work Time",
      ko: "총 작업시간"
    },
    workDetails: {
      en: "Work Details",
      ko: "작업내용"
    },
    worker: {
      en: "Worker",
      ko: "작업자"
    },
    workQuantity: {
      en: "Work Quantity",
      ko: "작업수량"
    }
  },
  productionKPI: {
    title: {
      en: "PRODUCTION RATE KPI REPORT",
      ko: "생산률 KPI 보고서"
    },
    period: {
      en: "Period",
      ko: "기간"
    },
    to: {
      en: "to",
      ko: "~"
    },
    overallKPIs: {
      en: "Overall KPIs",
      ko: "전체 KPI"
    },
    productionRateByProduct: {
      en: "Production Rate by Product",
      ko: "제품별 생산률"
    },
    priorityDistribution: {
      en: "Priority Distribution",
      ko: "우선순위 분포"
    },
    customerProduction: {
      en: "Customer Production Percentage",
      ko: "고객별 생산 비율"
    },
    partDefectRate: {
      en: "Part Defect Rate",
      ko: "부품 불량률"
    },
    workingHoursByProduct: {
      en: "Working Hours by Product",
      ko: "제품별 작업 시간"
    },
    leadTimeAnalysis: {
      en: "Lead Time Analysis",
      ko: "리드타임 분석"
    },
    machineTypeErrorRate: {
      en: "Machine Type Error Rate",
      ko: "장비 유형별 오류율"
    },
    deliveryDelayCount: {
      en: "Delivery Delay Count",
      ko: "납기 지연 건수"
    },
    overallProductionRate: {
      en: "Overall Product Production Rate",
      ko: "전체 제품 생산률"
    },
    defectRate: {
      en: "Defect Rate",
      ko: "불량률"
    },
    productName: {
      en: "Product Name",
      ko: "제품명"
    },
    targetQuantity: {
      en: "Target Quantity",
      ko: "목표 수량"
    },
    producedQuantity: {
      en: "Produced Quantity",
      ko: "생산 수량"
    },
    productionRate: {
      en: "Production Rate (%)",
      ko: "생산률 (%)"
    },
    priority: {
      en: "Priority",
      ko: "우선순위"
    },
    percentage: {
      en: "Percentage (%)",
      ko: "비율 (%)"
    },
    customerName: {
      en: "Customer Name",
      ko: "고객명"
    },
    productionVolume: {
      en: "Production Volume",
      ko: "생산량"
    },
    minimumHours: {
      en: "Minimum Hours",
      ko: "최소 시간"
    },
    maximumHours: {
      en: "Maximum Hours",
      ko: "최대 시간"
    },
    totalHours: {
      en: "Total Hours",
      ko: "총 시간"
    },
    projectName: {
      en: "Project Name",
      ko: "프로젝트명"
    },
    startDate: {
      en: "Start Date",
      ko: "시작일"
    },
    endDate: {
      en: "End Date",
      ko: "종료일"
    },
    leadTimeDays: {
      en: "Lead Time (Days)",
      ko: "리드타임 (일)"
    },
    machineType: {
      en: "Machine Type",
      ko: "장비 유형"
    },
    errorCount: {
      en: "Error Count",
      ko: "오류 횟수"
    },
    errorRate: {
      en: "Error Rate (%)",
      ko: "오류율 (%)"
    }
  },
  titles: {
    kpi: {
      en: "KPI",
      ko: "KPI"
    },
    kpiValue: {
      en: "Value",
      ko: "값"
    }
  },
  roles: {
    manager: {
      en: "Manager",
      ko: "관리자"
    },
    ceo: {
      en: "CEO",
      ko: "대표"
    },
    worker: {
      en: "Worker",
      ko: "작업자"
    }
  }
};

/**
 * Get translation for a given path and language
 * @param path - Dot-separated path to translation key (e.g., "productionKPI.title")
 * @param lang - Language code ("en" or "ko"), defaults to "en"
 * @returns Translated string value
 */
function getTranslation(path: string, lang: string = "en"): string {
  const keys = path.split(".");
  let value: any = TRANSLATIONS;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      console.warn(`Translation not found for path: ${path}`);
      return path;
    }
  }

  if (typeof value === "object" && value !== null && lang in value) {
    return value[lang];
  }

  console.warn(`Language "${lang}" not found for path: ${path}`);
  return path;
}

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
      type: { $in: ["PROCESSING_DEFECT", "MATERIAL_DEFECT"] },
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
        type: "EQUIPMENT_DEFECT",
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

// ==================== NEW AGGREGATION FUNCTIONS FOR PRODUCTIVITY REPORT ====================

/**
 * Interface for Overall KPIs
 */
export interface OverallKPIs {
  totalProductProduction: number; // Count of unique products with projects
  totalPartProduction: number; // Count of completed recipe executions (parts)
  overallDeliveryComplianceRate: number; // Percentage
  totalWorkers: number; // Count of unique workers
}

/**
 * Aggregate Overall KPIs for the productivity report
 */
export async function aggregateOverallKPIs(
  dateRange: DateRangeFilter
): Promise<OverallKPIs> {
  const { startDate, endDate } = dateRange;

  // Get unique products with projects in date range
  const uniqueProducts = await Project.distinct("product", {
    product: { $exists: true, $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } }
    ]
  });

  // Count completed recipe executions (parts) - tasks that are last step in recipe and completed
  const completedParts = await Task.countDocuments({
    status: "COMPLETED",
    isLastStepInRecipe: true,
    completedAt: { $gte: startDate, $lte: endDate }
  });

  // Calculate delivery compliance rate
  const totalProjects = await Project.countDocuments({
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } }
    ]
  });

  const onTimeProjects = await Project.countDocuments({
    $and: [
      {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { startDate: { $gte: startDate, $lte: endDate } },
          { endDate: { $gte: startDate, $lte: endDate } }
        ]
      },
      {
        $or: [
          // Completed on time
          {
            status: "COMPLETED",
            deadline: { $exists: true, $ne: null },
            endDate: { $exists: true, $ne: null },
            $expr: { $lte: ["$endDate", "$deadline"] }
          },
          // Active and not past deadline
          {
            status: { $in: ["ACTIVE", "ON_HOLD", "PLANNING"] },
            $or: [
              { deadline: { $exists: false } },
              { deadline: null },
              { deadline: { $gte: endDate } }
            ]
          }
        ]
      }
    ]
  });

  const deliveryComplianceRate =
    totalProjects > 0 ? (onTimeProjects / totalProjects) * 100 : 0;

  // Count unique workers who completed tasks
  const uniqueWorkers = await Task.distinct("workerId", {
    status: "COMPLETED",
    workerId: { $exists: true, $ne: null },
    completedAt: { $gte: startDate, $lte: endDate }
  });

  return {
    totalProductProduction: uniqueProducts.length,
    totalPartProduction: completedParts,
    overallDeliveryComplianceRate:
      Math.round(deliveryComplianceRate * 100) / 100,
    totalWorkers: uniqueWorkers.length
  };
}

/**
 * Interface for Product Status Data
 */
export interface ProductStatusData {
  product: any; // IProduct
  projects: Array<{
    project: any; // IProject
    instructionNo: string;
    designNumber: string;
    customerName: string;
    personInCharge: string;
    department: string;
    orderDate: Date | null;
    deliveryDate: Date | null;
    quantity: number;
    productionQuantity: number;
    remainingQuantity: number;
    completionRate: number;
    workTime: number; // in minutes
    deliveryDelays: number;
    deliveryComplianceRate: number;
  }>;
  parts: Array<{
    recipe: any; // IRecipe
    dwgNo: string;
    partName: string;
    quantity: number;
    productionQuantity: number;
    remainingQuantity: number;
    completionRate: number;
    totalWorkTime: number; // in minutes
    workDetails: Array<{
      worker: any; // IUser
      workQuantity: number;
      workTime: number; // in minutes
    }>;
  }>;
}

/**
 * Aggregate Product Status Data grouped by product
 */
export async function aggregateProductStatusData(
  dateRange: DateRangeFilter
): Promise<ProductStatusData[]> {
  const { startDate, endDate } = dateRange;

  // Get all projects with products in date range
  const projects = await Project.find({
    product: { $exists: true, $ne: null },
    productSnapshot: { $exists: true, $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } }
    ]
  })
    .populate("product")
    .populate("productSnapshot")
    .lean();

  // Get all tasks for these projects
  const projectIds = projects.map((p) => p._id);
  const tasks = await Task.find({
    projectId: { $in: projectIds },
    status: "COMPLETED"
  })
    .populate("workerId")
    .populate("recipeSnapshotId")
    .lean();

  // Group projects by product
  const productMap = new Map<string, ProductStatusData>();

  for (const project of projects) {
    const productSnapshotId = (project.productSnapshot as any)?._id;
    if (!productSnapshotId) continue;

    const productSnapshot = project.productSnapshot as any;

    if (!productMap.has(productSnapshotId)) {
      productMap.set(productSnapshotId, {
        product: productSnapshot,
        projects: [],
        parts: []
      });
    }

    const productSnapshotData = productMap.get(productSnapshotId)!;

    // Calculate work time for this project (sum of task durations)
    const projectTasks = tasks.filter(
      (t) => t.projectId?.toString() === project._id.toString()
    );
    const workTime = projectTasks.reduce(
      (sum, t) => sum + (t.actualDuration || 0),
      0
    );

    // Check if project is delayed
    let deliveryDelays = 0;
    if (project.deadline && project.endDate) {
      if (new Date(project.endDate) > new Date(project.deadline)) {
        deliveryDelays = 1;
      }
    } else if (project.deadline && new Date(project.deadline) < endDate) {
      if (project.status !== "COMPLETED") {
        deliveryDelays = 1;
      }
    }

    // Calculate delivery compliance rate for this project
    const deliveryComplianceRate =
      deliveryDelays === 0 && project.deadline
        ? 100
        : deliveryDelays > 0
        ? 0
        : 100;

    const remainingQuantity = project.targetQuantity - project.producedQuantity;
    const completionRate =
      project.targetQuantity > 0
        ? (project.producedQuantity / project.targetQuantity) * 100
        : 0;

    productSnapshotData.projects.push({
      project: project,
      instructionNo: project.projectNumber || "",
      designNumber: (project.productSnapshot as any)?.productNumber || "",
      customerName: (project.productSnapshot as any)?.customerName || "",
      personInCharge: (project.productSnapshot as any)?.personInCharge || "",
      department: (project.productSnapshot as any)?.department || "",
      orderDate: project.startDate || project.createdAt || null,
      deliveryDate: project.deadline || null,
      quantity: project.targetQuantity,
      productionQuantity: project.producedQuantity,
      remainingQuantity: remainingQuantity,
      completionRate: Math.round(completionRate * 100) / 100,
      workTime: workTime,
      deliveryDelays: deliveryDelays,
      deliveryComplianceRate: deliveryComplianceRate
    });
  }

  // For each product, get recipes and aggregate part details
  for (const [_, productSnapshotData] of productMap.entries()) {
    const product = productSnapshotData.product;
    if (!product.recipes || product.recipes.length === 0) continue;

    // Get all recipe snapshots for this product
    const recipeSnapshotIds = product.recipes.map(
      (r: any) => r.recipeSnapshotId
    );
    const recipeSnapshots = await RecipeSnapshot.find({
      _id: { $in: recipeSnapshotIds }
    }).lean();

    // Get all projects for this product to calculate part quantities
    const productProjects = productSnapshotData.projects;

    for (const recipeRef of product.recipes) {
      const recipeSnapshot = recipeSnapshots.find(
        (r) => r._id.toString() === recipeRef.recipeSnapshotId.toString()
      );
      if (!recipeSnapshot) continue;

      // Calculate total quantity for this part across all projects
      const totalQuantity = productProjects.reduce(
        (sum, p) => sum + p.quantity * (recipeRef.quantity || 1),
        0
      );

      // Get tasks for this recipe across all projects
      const recipeTasks = tasks.filter((t) => {
        const recipeSnapshot = t.recipeSnapshotId as any;
        if (!recipeSnapshot) return false;
        return (
          recipeSnapshot._id.toString() ===
          recipeRef.recipeSnapshotId.toString()
        );
      });

      // Calculate production quantity (completed recipe executions)
      const productionQuantity = recipeTasks.filter(
        (t) => t.isLastStepInRecipe
      ).length;

      const remainingQuantity = totalQuantity - productionQuantity;
      const completionRate =
        totalQuantity > 0 ? (productionQuantity / totalQuantity) * 100 : 0;

      // Calculate total work time
      const totalWorkTime = recipeTasks.reduce(
        (sum, t) => sum + (t.actualDuration || 0),
        0
      );

      // Group work details by worker
      const workerMap = new Map<
        string,
        { worker: any; workQuantity: number; workTime: number }
      >();

      for (const task of recipeTasks) {
        const workerId = task.workerId?._id.toString();
        if (!workerId) continue;

        if (!workerMap.has(workerId)) {
          workerMap.set(workerId, {
            worker: (task.workerId as any)?.name || workerId || "",
            workQuantity: 0,
            workTime: 0
          });
        }

        const workerData = workerMap.get(workerId)!;
        workerData.workQuantity += 1;
        workerData.workTime += task.actualDuration || 0;
      }

      productSnapshotData.parts.push({
        recipe: recipeSnapshot,
        dwgNo: recipeSnapshot.dwgNo || "",
        partName: recipeSnapshot.name || "",
        quantity: totalQuantity,
        productionQuantity: productionQuantity,
        remainingQuantity: remainingQuantity,
        completionRate: Math.round(completionRate * 100) / 100,
        totalWorkTime: totalWorkTime,
        workDetails: Array.from(workerMap.values())
      });
    }
  }

  return Array.from(productMap.values());
}

/**
 * Format time duration in minutes to Korean format (X시간 Y분)
 */
function formatTimeDuration(minutes: number, lang?: string): string {
  if (lang === "ko") {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0 && mins > 0) {
      return `${hours}시간${mins}분`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else if (mins > 0) {
      return `${mins}분`;
    }
    return "0분";
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else if (mins > 0) {
      return `${mins}m`;
    }
    return "0m";
  }
}

/**
 * Format Project Data to ExcelJs Table
 * @param projectData Project Data
 * @param worksheet ExcelJS Worksheet
 * @param lang Language
 * @param currentRow Current Row
 * @returns number of rows formatted
 */
function formatProjectDataToExcelJsTable(
  projectData: ProductStatusData["projects"],
  worksheet: ExcelJS.Worksheet,
  langCode: string,
  currentRow: number
): number {
  const initialRow = currentRow;

  for (const project of projectData) {
    let colNum = 4;
    const formattedProjectData = [
      project.instructionNo,
      project.designNumber,
      project.customerName,
      project.personInCharge,
      project.department,
      project.orderDate ? formatDateKorean(project.orderDate) : "",
      project.deliveryDate ? formatDateKorean(project.deliveryDate) : "",
      project.quantity,
      project.productionQuantity,
      project.remainingQuantity,
      project.completionRate,
      formatTimeDuration(project.workTime, langCode),
      project.deliveryDelays,
      project.deliveryComplianceRate || 0
    ];
    formattedProjectData.forEach((data, idx) => {
      const cell = worksheet.getCell(currentRow, colNum + idx);
      cell.value = data;
      cell.font = { size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    worksheet.getRow(currentRow).height = 20;
    currentRow++;
  }
  return initialRow + projectData.length;
}

/**  Format Product Status Data to ExcelJs Table
 * @param productStatusData Product Status Data
 * @param worksheet ExcelJS Worksheet
 * @param lang Language
 * @param currentRow Current Row
 * @returns number of rows formatted
 */
function formatProductStatusDataToExcelJsTable(
  productData: ProductStatusData,
  productIndex: number,
  worksheet: ExcelJS.Worksheet,
  lang: string,
  currentRow: number
): number {
  const initialRow = currentRow;
  const langCode = lang || "ko";

  // Product Status table headers
  const productHeaders = [
    getTranslation("productionReport.no", langCode),
    getTranslation("productionReport.productInfo", langCode),
    getTranslation("productionReport.instructionNo", langCode),
    getTranslation("productionReport.designNo", langCode),
    getTranslation("productionReport.customer", langCode),
    getTranslation("productionReport.department", langCode),
    getTranslation("productionReport.personInCharge", langCode),
    getTranslation("productionReport.orderDate", langCode),
    getTranslation("productionReport.deliveryDate", langCode),
    getTranslation("productionReport.quantity", langCode),
    getTranslation("productionReport.productionQuantity", langCode),
    getTranslation("productionReport.remainingQuantity", langCode),
    getTranslation("productionReport.completionRate", langCode),
    getTranslation("productionReport.workTime", langCode),
    getTranslation("productionReport.deliveryDelays", langCode),
    getTranslation("productionReport.deliveryComplianceRate", langCode)
  ];

  productHeaders.forEach((header, idx) => {
    let colNum = idx + 1;
    if (idx === 1) {
      worksheet.mergeCells(currentRow, colNum, currentRow, colNum + 1);
    } else if (idx > 1) {
      colNum += 1;
    }
    const cell = worksheet.getCell(currentRow, colNum);
    cell.value = header;
    cell.font = { bold: true, size: 9 };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  worksheet.getRow(currentRow).height = 40;
  currentRow++;

  // Product Number Colomn (1 column)
  // Row Height: Product Number + Project + Part
  const productNumberRowHeight =
    productData.projects.length +
    1 +
    productData.parts.reduce(
      (sum, p) => sum + (Math.ceil(p.workDetails.length / 3) || 1),
      0
    );
  worksheet.mergeCells(currentRow, 1, currentRow + productNumberRowHeight, 1);
  const productNumberCell = worksheet.getCell(currentRow, 1);
  productNumberCell.value = productIndex + 1;
  productNumberCell.font = { size: 10 };
  productNumberCell.alignment = { horizontal: "center", vertical: "middle" };
  productNumberCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };
  productNumberCell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };

  // Product Info Colomn (2 columns)
  const projectCount = productData.projects.length - 1;
  worksheet.mergeCells(currentRow, 2, currentRow + projectCount, 3);
  const productInfo = worksheet.getCell(currentRow, 2);
  productInfo.value = productData.product.name || "";
  productInfo.font = { size: 10 };
  productInfo.alignment = { horizontal: "center", vertical: "middle" };
  productInfo.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };

  // project data rows (projectCount rows)
  // From column 4 to column 17
  currentRow = formatProjectDataToExcelJsTable(
    productData.projects,
    worksheet,
    langCode,
    currentRow
  );

  // part data rows (partCount rows)
  // Part Status Table Headers (from column 2 to column 8)
  const partHeaders = [
    getTranslation("productionReport.drawingNo", langCode),
    getTranslation("productionReport.partName", langCode),
    getTranslation("productionReport.quantity", langCode),
    getTranslation("productionReport.productionQuantity", langCode),
    getTranslation("productionReport.remainingQuantity", langCode),
    getTranslation("productionReport.completionRate", langCode),
    getTranslation("productionReport.totalWorkTime", langCode)
  ];
  partHeaders.forEach((header, idx) => {
    let colNum = idx + 2;
    worksheet.mergeCells(currentRow, colNum, currentRow + 1, colNum);
    const cell = worksheet.getCell(currentRow, colNum);
    cell.value = header;
    cell.font = { bold: true, size: 9 };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });

  // Part Worker Table Headers
  // From Column 9 to Column 17
  worksheet.mergeCells(currentRow, 9, currentRow, 17);
  const workDetails = worksheet.getCell(currentRow, 9);
  workDetails.value = getTranslation("productionReport.workDetails", langCode);
  workDetails.font = { bold: true, size: 9 };
  workDetails.alignment = { horizontal: "center", vertical: "middle" };
  workDetails.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
  };
  workDetails.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" }
  };
  currentRow++;

  const partWorkerHeaders = [
    getTranslation("productionReport.worker", langCode),
    getTranslation("productionReport.workQuantity", langCode),
    getTranslation("productionReport.workTime", langCode),
    getTranslation("productionReport.worker", langCode),
    getTranslation("productionReport.workQuantity", langCode),
    getTranslation("productionReport.workTime", langCode),
    getTranslation("productionReport.worker", langCode),
    getTranslation("productionReport.workQuantity", langCode),
    getTranslation("productionReport.workTime", langCode)
  ];
  partWorkerHeaders.forEach((header, idx) => {
    let colNum = idx + 9;
    const cell = worksheet.getCell(currentRow, colNum);
    cell.value = header;
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  worksheet.getRow(currentRow).height = 20;
  currentRow++;

  // Part Worker Data Rows
  for (const part of productData.parts) {
    // Part Row Height = Ceil(Part Worker Columns / 3) default 1
    const partRowHeight = Math.ceil(part.workDetails.length / 3) || 1;
    // Part Info Columns
    const partInfo = [
      part.dwgNo,
      part.partName,
      part.quantity,
      part.productionQuantity,
      part.remainingQuantity,
      part.completionRate,
      formatTimeDuration(part.totalWorkTime, langCode)
    ];
    partInfo.forEach((info, idx) => {
      if (partRowHeight > 1) {
        worksheet.mergeCells(
          currentRow,
          idx + 2,
          currentRow + partRowHeight - 1,
          idx + 2
        );
      }
      const cell = worksheet.getCell(currentRow, idx + 2);
      cell.value = info;
      cell.font = { size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      if (idx === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
        };
      }
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
    let workerCount = 0;
    for (const worker of part.workDetails) {
      workerCount++;
      // Worker Info Columns (From Column 9 to Column 17)
      const workerInfo = [
        worker.worker,
        worker.workQuantity,
        formatTimeDuration(worker.workTime, langCode)
      ];
      workerInfo.forEach((info, idx) => {
        const cell = worksheet.getCell(
          currentRow + Math.floor((workerCount - 1) / 3),
          9 + idx + ((workerCount - 1) % 3) * 3
        );
        cell.value = info;
        cell.font = { size: 9 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
      });
    }
    // Fill Unused Worker Columns with color
    if (workerCount % 3 !== 0 || workerCount === 0) {
      for (let i = 9 + (workerCount % 3) * 3; i <= 17; i++) {
        const cell = worksheet.getCell(
          currentRow +
            (workerCount > 0 ? Math.floor((workerCount - 1) / 3) : 0),
          i
        );
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.WARNING }
        };
      }
    }
    worksheet.getRow(currentRow).height = 24;
    currentRow += partRowHeight;
  }

  return initialRow + productNumberRowHeight + 2;
}

/**
 * Generate comprehensive Production Rate KPI Sheet (Productivity Report)
 * New format: Overall KPIs → Approval → Product Status → Part Details with Work Content
 */
export async function generateProductionRateKPISheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter,
  period?: "daily" | "weekly" | "monthly",
  lang?: string
): Promise<void> {
  console.log("Generating Production Rate KPI Sheet (Productivity Report)...");
  const langCode = lang || "ko";

  // Adjust date range based on period
  const adjustedDateRange = adjustDateRangeForPeriod(
    dateRange.startDate,
    dateRange.endDate,
    period
  );

  // Aggregate data for the new format
  const [overallKPIs, productStatusData] = await Promise.all([
    aggregateOverallKPIs(adjustedDateRange),
    aggregateProductStatusData(adjustedDateRange)
  ]);

  const worksheet = workbook.addWorksheet(
    getTranslation("productionReport.title", langCode) || "Production Rate KPI"
  );

  // Configure page for A4 landscape
  worksheet.pageSetup = {
    paperSize: 9, // A4
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3
    }
  };

  worksheet.properties.defaultRowHeight = 24;

  let currentRow = 1;

  // ===== HEADER SECTION =====
  // Row 1: Title
  worksheet.mergeCells(currentRow, 1, currentRow, 17); // Title spans multiple columns
  const titleCell = worksheet.getCell(currentRow, 1);
  titleCell.value = getTranslation("productionReport.title", langCode);
  titleCell.font = { size: 36, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 58;
  currentRow += 2;

  // === DATE + Approval section (작성/검토/승인) ====
  // Row 3: Period (기준일시)
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const periodCell = worksheet.getCell(currentRow, 1);
  periodCell.value = `${getTranslation(
    "productionReport.referenceDateTime",
    langCode
  )}: ${formatDateKorean(adjustedDateRange.startDate)}~${formatDateKorean(
    adjustedDateRange.endDate
  )}`;
  periodCell.font = { size: 14 };
  periodCell.alignment = { horizontal: "left", vertical: "middle" };

  // Approval section (작성/검토/승인) - right side
  const approvalCols = [
    { col: 15, label: "productionReport.prepared" },
    { col: 16, label: "productionReport.reviewed" },
    { col: 17, label: "productionReport.approved" }
  ];

  approvalCols.forEach((col) => {
    const cell = worksheet.getCell(currentRow, col.col);
    cell.value = `${getTranslation(col.label, langCode)}`;
    cell.font = { size: 14 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  worksheet.getRow(currentRow).height = 24;
  currentRow++;

  // Row 4: Blank Signature cells
  // Blank Signature cells
  approvalCols.forEach((col) => {
    worksheet.mergeCells(currentRow, col.col, currentRow + 4, col.col);
    const cell = worksheet.getCell(currentRow, col.col);
    cell.value = "";
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    // Date Row
    worksheet.mergeCells(currentRow + 5, col.col, currentRow + 5, col.col);
    const dateCell = worksheet.getCell(currentRow + 5, col.col);
    dateCell.value = formatDateKorean(new Date());
    dateCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
    dateCell.font = { size: 14 };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(currentRow + 5).height = 24;
  });
  currentRow++;

  // Row 5: Overall KPIs
  // Section header
  worksheet.mergeCells(currentRow, 1, currentRow, 3);
  const kpiHeaderCell = worksheet.getCell(currentRow, 1);
  kpiHeaderCell.value = getTranslation(
    "productionReport.overallKPIs",
    langCode
  );
  kpiHeaderCell.font = { bold: true, size: 12 };
  kpiHeaderCell.alignment = { horizontal: "left", vertical: "middle" };
  currentRow++;

  // Row 6: KPI Columns
  // KPI Columns: Label | Value format
  const kpiColumns = [
    {
      label: "productionReport.totalProductProduction",
      value: overallKPIs.totalProductProduction,
      startCol: 1,
      endCol: 3
    },
    {
      label: "productionReport.totalPartProduction",
      value: overallKPIs.totalPartProduction,
      startCol: 4,
      endCol: 5
    },
    {
      label: "productionReport.overallDeliveryComplianceRate",
      value: `${overallKPIs.overallDeliveryComplianceRate.toFixed(0)}%`,
      startCol: 6,
      endCol: 7
    },
    {
      label: "productionReport.totalWorkers",
      value: overallKPIs.totalWorkers,
      startCol: 8,
      endCol: 9
    }
  ];

  kpiColumns.forEach((kpi) => {
    // Label Row
    worksheet.mergeCells(currentRow, kpi.startCol, currentRow, kpi.endCol);
    const labelCell = worksheet.getCell(currentRow, kpi.startCol);
    labelCell.value = getTranslation(kpi.label, langCode);
    labelCell.font = { size: 12, bold: true };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.NEUTRAL }
    };
    labelCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };

    // Value Row
    worksheet.mergeCells(
      currentRow + 1,
      kpi.startCol,
      currentRow + 2,
      kpi.endCol
    );
    const valueCell = worksheet.getCell(currentRow + 1, kpi.startCol);
    valueCell.value = kpi.value;
    valueCell.font = { size: 12 };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" }
    };
  });
  currentRow += 4;

  // Row 10
  // ===== SECTION 2: Product Status (제품별 현황) =====
  // Section header
  worksheet.mergeCells(currentRow, 1, currentRow, 4);
  const productStatusHeader = worksheet.getCell(currentRow, 1);
  productStatusHeader.value = getTranslation(
    "productionReport.productStatus",
    langCode
  );
  productStatusHeader.font = { bold: true, size: 12 };
  productStatusHeader.alignment = { horizontal: "left", vertical: "middle" };
  currentRow++;

  // Product data rows
  for (
    let productIndex = 0;
    productIndex < productStatusData.length;
    productIndex++
  ) {
    const productData = productStatusData[productIndex];
    currentRow = formatProductStatusDataToExcelJsTable(
      productData,
      productIndex,
      worksheet,
      langCode,
      currentRow
    );
    // const product = productData.product;

    // for (const projectData of productData.projects) {
    //   const row = [
    //     product.productName || "",
    //     projectData.instructionNo || "",
    //     product.designNumber || "",
    //     product.customerName || "",
    //     product.department || "",
    //     product.personInCharge || "",
    //     formatDateKorean(projectData.orderDate),
    //     formatDateKorean(projectData.deliveryDate),
    //     projectData.quantity,
    //     projectData.productionQuantity,
    //     projectData.remainingQuantity,
    //     `${projectData.completionRate.toFixed(0)}%`,
    //     formatTimeDuration(projectData.workTime, langCode),
    //     projectData.deliveryDelays,
    //     `${projectData.deliveryComplianceRate.toFixed(0)}%`
    //   ];

    //   row.forEach((val, idx) => {
    //     const cell = worksheet.getCell(currentRow, idx + 1);
    //     cell.value = val;
    //     cell.font = { size: 9 };
    //     cell.alignment = {
    //       horizontal: idx < 6 ? "left" : "center",
    //       vertical: "middle",
    //       wrapText: true
    //     };
    //     cell.border = {
    //       top: { style: "thin" },
    //       left: { style: idx === 0 ? "medium" : "thin" },
    //       bottom: { style: "thin" },
    //       right: { style: idx === row.length - 1 ? "medium" : "thin" }
    //     };
    //     if (typeof val === "number" && idx >= 7 && idx <= 10) {
    //       cell.numFmt = "#,##0";
    //     }
    //   });
    //   worksheet.getRow(currentRow).height = 25;
    //   currentRow++;
    // }

    // // Part Details section for this product
    // if (productData.parts.length > 0) {
    //   // Part Details header
    //   worksheet.mergeCells(currentRow, 1, currentRow, 16);
    //   const partHeader = worksheet.getCell(currentRow, 1);
    //   partHeader.value = getTranslation(
    //     "productionReport.partDetails",
    //     langCode
    //   );
    //   partHeader.font = { bold: true, size: 11 };
    //   partHeader.alignment = { horizontal: "left", vertical: "middle" };
    //   partHeader.fill = {
    //     type: "pattern",
    //     pattern: "solid",
    //     fgColor: { argb: "F0F0F0" }
    //   };
    //   partHeader.border = {
    //     top: { style: "thin" },
    //     left: { style: "medium" },
    //     bottom: { style: "thin" },
    //     right: { style: "medium" }
    //   };
    //   worksheet.getRow(currentRow).height = 25;
    //   currentRow++;

    //   // Part table headers
    //   const partHeaders = [
    //     getTranslation("productionReport.drawingNo", langCode),
    //     getTranslation("productionReport.partName", langCode),
    //     getTranslation("productionReport.quantity", langCode),
    //     getTranslation("productionReport.productionQuantity", langCode),
    //     getTranslation("productionReport.remainingQuantity", langCode),
    //     getTranslation("productionReport.completionRate", langCode),
    //     getTranslation("productionReport.totalWorkTime", langCode)
    //   ];

    //   // Add work details headers (multiple sets of 3 columns)
    //   const maxWorkDetails = Math.max(
    //     ...productData.parts.map((p) => p.workDetails.length),
    //     1
    //   );
    //   for (let i = 0; i < maxWorkDetails; i++) {
    //     partHeaders.push(
    //       getTranslation("productionReport.worker", langCode),
    //       getTranslation("productionReport.workQuantity", langCode),
    //       getTranslation("productionReport.workTime", langCode)
    //     );
    //   }

    //   partHeaders.forEach((header, idx) => {
    //     const cell = worksheet.getCell(currentRow, idx + 1);
    //     cell.value = header;
    //     cell.font = { bold: true, size: 9 };
    //     cell.alignment = {
    //       horizontal: "center",
    //       vertical: "middle",
    //       wrapText: true
    //     };
    //     cell.fill = {
    //       type: "pattern",
    //       pattern: "solid",
    //       fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    //     };
    //     cell.border = {
    //       top: { style: "thin" },
    //       left: { style: idx === 0 ? "medium" : "thin" },
    //       bottom: { style: "thin" },
    //       right: { style: idx === partHeaders.length - 1 ? "medium" : "thin" }
    //     };
    //   });
    //   worksheet.getRow(currentRow).height = 40;
    //   currentRow++;

    //   // Part data rows
    //   for (const part of productData.parts) {
    //     const row: any[] = [
    //       part.dwgNo || "",
    //       part.partName || "",
    //       part.quantity,
    //       part.productionQuantity,
    //       part.remainingQuantity,
    //       `${part.completionRate.toFixed(0)}%`,
    //       formatTimeDuration(part.totalWorkTime, langCode)
    //     ];

    //     // Add work details
    //     for (let i = 0; i < maxWorkDetails; i++) {
    //       if (i < part.workDetails.length) {
    //         const workDetail = part.workDetails[i];
    //         row.push(
    //           (workDetail.worker as any)?.name || "",
    //           workDetail.workQuantity,
    //           formatTimeDuration(workDetail.workTime, langCode)
    //         );
    //       } else {
    //         row.push("", "", "");
    //       }
    //     }

    //     row.forEach((val, idx) => {
    //       const cell = worksheet.getCell(currentRow, idx + 1);
    //       cell.value = val;
    //       cell.font = { size: 9 };
    //       cell.alignment = {
    //         horizontal: idx < 2 ? "left" : "center",
    //         vertical: "middle",
    //         wrapText: true
    //       };
    //       cell.border = {
    //         top: { style: "thin" },
    //         left: { style: idx === 0 ? "medium" : "thin" },
    //         bottom: { style: "thin" },
    //         right: { style: idx === row.length - 1 ? "medium" : "thin" }
    //       };
    //       if (
    //         typeof val === "number" &&
    //         (idx === 2 || idx === 3 || idx === 4)
    //       ) {
    //         cell.numFmt = "#,##0";
    //       }
    //     });
    //     worksheet.getRow(currentRow).height = 25;
    //     currentRow++;
    //   }
    //   currentRow++; // Space after parts section
    // }
  }

  // Set column widths optimized for the new format
  worksheet.getColumn(1).width = 4.5; // Product info / Part name
  worksheet.getColumn(2).width = 4.5; // Instruction No / Drawing No
  worksheet.getColumn(3).width = 21; // Design No / Part name
  worksheet.getColumn(4).width = 12; // Customer
  worksheet.getColumn(5).width = 12; // Department
  worksheet.getColumn(6).width = 9.5; // Person in Charge
  worksheet.getColumn(7).width = 12; // Order Date
  worksheet.getColumn(8).width = 12; // Delivery Date
  worksheet.getColumn(9).width = 10; // Quantity
  worksheet.getColumn(10).width = 12; // Production Quantity
  worksheet.getColumn(11).width = 12; // Remaining Quantity
  worksheet.getColumn(12).width = 12; // Completion Rate
  worksheet.getColumn(13).width = 15; // Work Time
  worksheet.getColumn(14).width = 12; // Delivery Delays
  worksheet.getColumn(15).width = 15; // Delivery Compliance Rate
  worksheet.getColumn(16).width = 15; // Work details columns start here
  worksheet.getColumn(17).width = 15; // Work details columns start here

  console.log(
    "✓ Production Rate KPI Sheet (Productivity Report) generated successfully"
  );
}
