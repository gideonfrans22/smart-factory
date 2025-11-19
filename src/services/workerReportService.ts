import mongoose from "mongoose";
import ExcelJS from "exceljs";
import { Task } from "../models/Task";
import { User } from "../models/User";
import * as ExcelFormatService from "./excelFormatService";

/**
 * Worker Performance Report Data Aggregation Service
 * Handles all data queries and calculations for worker performance reports
 */

// ==================== INTERFACES ====================

export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

export interface WorkerTaskMetrics {
  workerId: string;
  workerName: string;
  department: string;
  completedTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  totalTasks: number;
}

export interface WorkerPerformanceData {
  workerId: string;
  workerName: string;
  department: string;
  completedTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  totalHours: number; // in hours
  breakTime: number; // in hours
  productiveTime: number; // in hours
  qualityScore: number; // percentage
  avgTaskCompletionTime: number; // in seconds
  avgTaskEstimatedTime: number; // in seconds
  efficiency: number; // percentage
  performanceRating:
    | "EXCELLENT"
    | "GOOD"
    | "AVERAGE"
    | "BELOW_AVERAGE"
    | "POOR";
  performanceScore: number; // 0-100
  rank?: number;
}

export interface DeviceProficiency {
  deviceTypeId: string;
  deviceTypeName: string;
  tasksCompleted: number;
  avgEstimatedDuration: number;
  avgActualDuration: number;
  proficiency: number; // percentage: (Est / Actual) × 100
  status: "EXPERT" | "PROFICIENT" | "LEARNING" | "BEGINNER";
}

export interface WorkerProficiencyReport {
  workerId: string;
  workerName: string;
  department: string;
  deviceProficiencies: DeviceProficiency[];
  overallProficiency: number;
  expertDevices: number;
  proficientDevices: number;
  learningDevices: number;
  beginnerDevices: number;
}

export interface WorkerTaskBreakdown {
  workerId: string;
  workerName: string;
  byStatus: {
    completed: number;
    failed: number;
    ongoing: number;
    pending: number;
  };
  byProject: Array<{
    projectId: string;
    projectName: string;
    taskCount: number;
  }>;
  byDeviceType: Array<{
    deviceTypeId: string;
    deviceTypeName: string;
    taskCount: number;
  }>;
}

export interface WorkerDailyActivity {
  date: string; // YYYY-MM-DD
  tasksCompleted: number;
  hoursWorked: number;
  efficiency: number;
}

// ==================== DATA AGGREGATION FUNCTIONS ====================

/**
 * Get worker task metrics (task counts by status)
 */
export async function getWorkerTaskMetrics(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<WorkerTaskMetrics[]> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const metrics = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$workerId",
        completedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        failedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] }
        },
        inProgressTasks: {
          $sum: { $cond: [{ $eq: ["$status", "ONGOING"] }, 1, 0] }
        },
        pendingTasks: {
          $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] }
        },
        totalTasks: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $project: {
        workerId: { $toString: "$_id" },
        workerName: "$worker.name",
        department: "$worker.department",
        completedTasks: 1,
        failedTasks: 1,
        inProgressTasks: 1,
        pendingTasks: 1,
        totalTasks: 1
      }
    },
    {
      $sort: { completedTasks: -1 }
    }
  ]);

  return metrics;
}

/**
 * Calculate worker hours (sum of completedAt - startedAt for COMPLETED tasks only)
 */
export async function calculateWorkerHours(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<
  Array<{
    workerId: string;
    workerName: string;
    totalHours: number;
    taskCount: number;
  }>
> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    status: "COMPLETED",
    startedAt: { $ne: null },
    completedAt: { $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const hours = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$workerId",
        totalMilliseconds: {
          $sum: { $subtract: ["$completedAt", "$startedAt"] }
        },
        taskCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $project: {
        workerId: { $toString: "$_id" },
        workerName: "$worker.name",
        totalHours: { $divide: ["$totalMilliseconds", 3600000] }, // ms to hours
        taskCount: 1
      }
    },
    {
      $sort: { totalHours: -1 }
    }
  ]);

  return hours;
}

/**
 * Calculate break time (sum of pausedDuration)
 */
export async function calculateBreakTime(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<
  Array<{
    workerId: string;
    workerName: string;
    breakTime: number; // in hours
  }>
> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    pausedDuration: { $gt: 0 },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const breakTimes = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$workerId",
        totalPausedSeconds: { $sum: "$pausedDuration" }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $project: {
        workerId: { $toString: "$_id" },
        workerName: "$worker.name",
        breakTime: { $divide: ["$totalPausedSeconds", 3600] } // seconds to hours
      }
    },
    {
      $sort: { breakTime: -1 }
    }
  ]);

  return breakTimes;
}

/**
 * Calculate quality score (Completed / (Completed + Failed) × 100%)
 */
export async function calculateQualityScore(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<
  Array<{
    workerId: string;
    workerName: string;
    completedTasks: number;
    failedTasks: number;
    qualityScore: number;
  }>
> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    status: { $in: ["COMPLETED", "FAILED"] },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const qualityScores = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$workerId",
        completedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        failedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $project: {
        workerId: { $toString: "$_id" },
        workerName: "$worker.name",
        completedTasks: 1,
        failedTasks: 1,
        qualityScore: {
          $cond: [
            { $gt: [{ $add: ["$completedTasks", "$failedTasks"] }, 0] },
            {
              $multiply: [
                {
                  $divide: [
                    "$completedTasks",
                    { $add: ["$completedTasks", "$failedTasks"] }
                  ]
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
      $sort: { qualityScore: -1 }
    }
  ]);

  return qualityScores;
}

/**
 * Calculate device proficiency per worker
 * Proficiency = (Avg Estimated Duration / Avg Actual Duration) × 100%
 */
export async function calculateDeviceProficiency(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<WorkerProficiencyReport[]> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    status: "COMPLETED",
    actualDuration: { $gt: 0 },
    estimatedDuration: { $gt: 0 },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const proficiencyData = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          workerId: "$workerId",
          deviceTypeId: "$deviceTypeId"
        },
        tasksCompleted: { $sum: 1 },
        avgEstimatedDuration: { $avg: "$estimatedDuration" },
        avgActualDuration: { $avg: "$actualDuration" }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id.workerId",
        foreignField: "_id",
        as: "worker"
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
      $unwind: "$worker"
    },
    {
      $unwind: "$deviceType"
    },
    {
      $project: {
        workerId: { $toString: "$_id.workerId" },
        workerName: "$worker.name",
        department: "$worker.department",
        deviceTypeId: { $toString: "$_id.deviceTypeId" },
        deviceTypeName: "$deviceType.name",
        tasksCompleted: 1,
        avgEstimatedDuration: 1,
        avgActualDuration: 1,
        proficiency: {
          $multiply: [
            { $divide: ["$avgEstimatedDuration", "$avgActualDuration"] },
            100
          ]
        }
      }
    },
    {
      $sort: { workerId: 1, proficiency: -1 }
    }
  ]);

  // Group by worker
  const workerMap = new Map<string, WorkerProficiencyReport>();

  proficiencyData.forEach((item) => {
    if (!workerMap.has(item.workerId)) {
      workerMap.set(item.workerId, {
        workerId: item.workerId,
        workerName: item.workerName,
        department: item.department,
        deviceProficiencies: [],
        overallProficiency: 0,
        expertDevices: 0,
        proficientDevices: 0,
        learningDevices: 0,
        beginnerDevices: 0
      });
    }

    const worker = workerMap.get(item.workerId)!;

    // Determine proficiency status
    let status: "EXPERT" | "PROFICIENT" | "LEARNING" | "BEGINNER";
    if (item.proficiency >= 120) {
      status = "EXPERT";
      worker.expertDevices++;
    } else if (item.proficiency >= 100) {
      status = "PROFICIENT";
      worker.proficientDevices++;
    } else if (item.proficiency >= 80) {
      status = "LEARNING";
      worker.learningDevices++;
    } else {
      status = "BEGINNER";
      worker.beginnerDevices++;
    }

    worker.deviceProficiencies.push({
      deviceTypeId: item.deviceTypeId,
      deviceTypeName: item.deviceTypeName,
      tasksCompleted: item.tasksCompleted,
      avgEstimatedDuration: item.avgEstimatedDuration,
      avgActualDuration: item.avgActualDuration,
      proficiency: item.proficiency,
      status
    });
  });

  // Calculate overall proficiency
  const reports = Array.from(workerMap.values());
  reports.forEach((report) => {
    if (report.deviceProficiencies.length > 0) {
      report.overallProficiency =
        report.deviceProficiencies.reduce(
          (sum, prof) => sum + prof.proficiency,
          0
        ) / report.deviceProficiencies.length;
    }
  });

  return reports.sort((a, b) => b.overallProficiency - a.overallProficiency);
}

/**
 * Calculate comprehensive worker performance data
 */
export async function getWorkerPerformanceData(
  dateRange: DateRangeFilter,
  workerId?: string
): Promise<WorkerPerformanceData[]> {
  const { startDate, endDate } = dateRange;

  const matchStage: any = {
    workerId: { $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  };

  if (workerId) {
    matchStage.workerId = new mongoose.Types.ObjectId(workerId);
  }

  const performanceData = await Task.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$workerId",
        completedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        },
        failedTasks: {
          $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] }
        },
        inProgressTasks: {
          $sum: { $cond: [{ $eq: ["$status", "ONGOING"] }, 1, 0] }
        },
        totalHoursMs: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "COMPLETED"] },
                  { $ne: ["$startedAt", null] },
                  { $ne: ["$completedAt", null] }
                ]
              },
              { $subtract: ["$completedAt", "$startedAt"] },
              0
            ]
          }
        },
        totalBreakSeconds: {
          $sum: { $ifNull: ["$pausedDuration", 0] }
        },
        totalActualDuration: {
          $sum: {
            $cond: [{ $eq: ["$status", "COMPLETED"] }, "$actualDuration", 0]
          }
        },
        totalEstimatedDuration: {
          $sum: { $ifNull: ["$estimatedDuration", 0] }
        },
        completedTaskCount: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "worker"
      }
    },
    {
      $unwind: "$worker"
    },
    {
      $project: {
        workerId: { $toString: "$_id" },
        workerName: "$worker.name",
        department: "$worker.department",
        completedTasks: 1,
        failedTasks: 1,
        inProgressTasks: 1,
        totalHours: { $divide: ["$totalHoursMs", 3600000] },
        breakTime: { $divide: ["$totalBreakSeconds", 3600] },
        productiveTime: {
          $divide: [
            {
              $subtract: [
                "$totalHoursMs",
                { $multiply: ["$totalBreakSeconds", 1000] }
              ]
            },
            3600000
          ]
        },
        qualityScore: {
          $cond: [
            { $gt: [{ $add: ["$completedTasks", "$failedTasks"] }, 0] },
            {
              $multiply: [
                {
                  $divide: [
                    "$completedTasks",
                    { $add: ["$completedTasks", "$failedTasks"] }
                  ]
                },
                100
              ]
            },
            0
          ]
        },
        avgTaskCompletionTime: {
          $cond: [
            { $gt: ["$completedTaskCount", 0] },
            { $divide: ["$totalActualDuration", "$completedTaskCount"] },
            0
          ]
        },
        avgTaskEstimatedTime: {
          $cond: [
            { $gt: ["$completedTaskCount", 0] },
            { $divide: ["$totalEstimatedDuration", "$completedTaskCount"] },
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
    }
  ]);

  // Calculate performance rating and score
  const results: WorkerPerformanceData[] = performanceData.map((worker) => {
    // Performance score formula (0-100):
    // 40% Quality Score + 30% Efficiency + 20% Completion Rate + 10% Productivity
    const completionRate =
      worker.completedTasks + worker.failedTasks > 0
        ? (worker.completedTasks /
            (worker.completedTasks + worker.failedTasks)) *
          100
        : 0;

    const productivity =
      worker.totalHours > 0 ? worker.completedTasks / worker.totalHours : 0;
    const normalizedProductivity = Math.min(productivity * 10, 100); // Normalize to 0-100

    const performanceScore =
      worker.qualityScore * 0.4 +
      worker.efficiency * 0.3 +
      completionRate * 0.2 +
      normalizedProductivity * 0.1;

    // Determine rating
    let performanceRating:
      | "EXCELLENT"
      | "GOOD"
      | "AVERAGE"
      | "BELOW_AVERAGE"
      | "POOR";
    if (performanceScore >= 90) {
      performanceRating = "EXCELLENT";
    } else if (performanceScore >= 75) {
      performanceRating = "GOOD";
    } else if (performanceScore >= 60) {
      performanceRating = "AVERAGE";
    } else if (performanceScore >= 40) {
      performanceRating = "BELOW_AVERAGE";
    } else {
      performanceRating = "POOR";
    }

    return {
      ...worker,
      performanceScore,
      performanceRating
    };
  });

  return results.sort((a, b) => b.performanceScore - a.performanceScore);
}

/**
 * Calculate performance rating for a worker
 */
export function calculatePerformanceRating(
  qualityScore: number,
  efficiency: number,
  completionRate: number,
  productivity: number
): { rating: string; score: number } {
  // Performance score formula (0-100):
  // 40% Quality + 30% Efficiency + 20% Completion Rate + 10% Productivity
  const normalizedProductivity = Math.min(productivity * 10, 100);

  const score =
    qualityScore * 0.4 +
    efficiency * 0.3 +
    completionRate * 0.2 +
    normalizedProductivity * 0.1;

  let rating: string;
  if (score >= 90) {
    rating = "EXCELLENT";
  } else if (score >= 75) {
    rating = "GOOD";
  } else if (score >= 60) {
    rating = "AVERAGE";
  } else if (score >= 40) {
    rating = "BELOW_AVERAGE";
  } else {
    rating = "POOR";
  }

  return { rating, score };
}

/**
 * Rank workers by performance
 */
export async function rankWorkersByPerformance(
  dateRange: DateRangeFilter
): Promise<WorkerPerformanceData[]> {
  const performanceData = await getWorkerPerformanceData(dateRange);

  // Add rank
  performanceData.forEach((worker, index) => {
    worker.rank = index + 1;
  });

  return performanceData;
}

/**
 * Get worker task breakdown (by status, project, device type)
 */
export async function getWorkerTaskBreakdown(
  dateRange: DateRangeFilter,
  workerId: string
): Promise<WorkerTaskBreakdown | null> {
  const { startDate, endDate } = dateRange;

  const worker = await User.findById(workerId).lean();
  if (!worker) return null;

  const tasks = await Task.find({
    workerId: new mongoose.Types.ObjectId(workerId),
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  })
    .populate("projectId", "name")
    .populate("deviceTypeId", "name")
    .lean();

  // By status
  const byStatus = {
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    failed: tasks.filter((t) => t.status === "FAILED").length,
    ongoing: tasks.filter((t) => t.status === "ONGOING").length,
    pending: tasks.filter((t) => t.status === "PENDING").length
  };

  // By project
  const projectMap = new Map<string, { name: string; count: number }>();
  tasks.forEach((task) => {
    if (task.projectId) {
      const projectId = (task.projectId as any)._id.toString();
      const projectName = (task.projectId as any).name;
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, { name: projectName, count: 0 });
      }
      projectMap.get(projectId)!.count++;
    }
  });

  const byProject = Array.from(projectMap.entries())
    .map(([projectId, data]) => ({
      projectId,
      projectName: data.name,
      taskCount: data.count
    }))
    .sort((a, b) => b.taskCount - a.taskCount);

  // By device type
  const deviceTypeMap = new Map<string, { name: string; count: number }>();
  tasks.forEach((task) => {
    if (task.deviceTypeId) {
      const deviceTypeId = (task.deviceTypeId as any)._id.toString();
      const deviceTypeName = (task.deviceTypeId as any).name;
      if (!deviceTypeMap.has(deviceTypeId)) {
        deviceTypeMap.set(deviceTypeId, { name: deviceTypeName, count: 0 });
      }
      deviceTypeMap.get(deviceTypeId)!.count++;
    }
  });

  const byDeviceType = Array.from(deviceTypeMap.entries())
    .map(([deviceTypeId, data]) => ({
      deviceTypeId,
      deviceTypeName: data.name,
      taskCount: data.count
    }))
    .sort((a, b) => b.taskCount - a.taskCount);

  return {
    workerId: workerId.toString(),
    workerName: worker.name,
    byStatus,
    byProject,
    byDeviceType
  };
}

/**
 * Get daily activity for a worker (for trend charts)
 */
export async function getWorkerDailyActivity(
  dateRange: DateRangeFilter,
  workerId: string
): Promise<WorkerDailyActivity[]> {
  const { startDate, endDate } = dateRange;

  const dailyData = await Task.aggregate([
    {
      $match: {
        workerId: new mongoose.Types.ObjectId(workerId),
        status: "COMPLETED",
        completedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$completedAt" }
        },
        tasksCompleted: { $sum: 1 },
        totalHoursMs: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$startedAt", null] },
                  { $ne: ["$completedAt", null] }
                ]
              },
              { $subtract: ["$completedAt", "$startedAt"] },
              0
            ]
          }
        },
        totalEstimatedDuration: { $sum: "$estimatedDuration" },
        totalActualDuration: { $sum: "$actualDuration" }
      }
    },
    {
      $project: {
        date: "$_id",
        tasksCompleted: 1,
        hoursWorked: { $divide: ["$totalHoursMs", 3600000] },
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
      $sort: { date: 1 }
    }
  ]);

  // Fill in missing dates
  const result: WorkerDailyActivity[] = [];
  const dataMap = new Map(dailyData.map((d) => [d.date, d]));
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const data = dataMap.get(dateStr);

    result.push({
      date: dateStr,
      tasksCompleted: data?.tasksCompleted || 0,
      hoursWorked: data?.hoursWorked || 0,
      efficiency: data?.efficiency || 0
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Format duration in seconds to readable string (e.g., "2h 30m", "45m 15s")
 */
function formatDuration(seconds: number): string {
  if (seconds === 0) return "0s";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && hours === 0) parts.push(`${secs}s`);

  return parts.join(" ") || "0s";
}

// ==================== SHEET GENERATION FUNCTIONS ====================

/**
 * SHEET 1: Performance Rankings
 * Ranking table with performance tiers and top performers
 */
export async function generateWorkerRankingsSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter
): Promise<void> {
  console.log("Generating Worker Rankings Sheet...");

  const worksheet = workbook.addWorksheet("Performance Rankings");
  let currentRow = 1;

  // ===== TITLE =====
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = "WORKER PERFORMANCE RANKINGS";
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // Get performance data
  const performanceData = await rankWorkersByPerformance(dateRange);

  // ===== PERFORMANCE TIER STATISTICS =====
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const tierHeaderCell = worksheet.getCell(`A${currentRow}`);
  tierHeaderCell.value = "Performance Tier Distribution";
  tierHeaderCell.font = { size: 14, bold: true };
  tierHeaderCell.alignment = { horizontal: "left" };
  currentRow++;

  const tiers = {
    EXCELLENT: performanceData.filter(
      (w) => w.performanceRating === "EXCELLENT"
    ).length,
    GOOD: performanceData.filter((w) => w.performanceRating === "GOOD").length,
    AVERAGE: performanceData.filter((w) => w.performanceRating === "AVERAGE")
      .length,
    BELOW_AVERAGE: performanceData.filter(
      (w) => w.performanceRating === "BELOW_AVERAGE"
    ).length,
    POOR: performanceData.filter((w) => w.performanceRating === "POOR").length
  };

  const tierColors = {
    EXCELLENT: ExcelFormatService.COLORS.SUCCESS,
    GOOD: "90CAF9", // Light Blue
    AVERAGE: ExcelFormatService.COLORS.WARNING,
    BELOW_AVERAGE: "FFA726", // Orange
    POOR: ExcelFormatService.COLORS.DANGER
  };

  // Tier summary table
  const tierHeaders = [
    "Tier",
    "Workers",
    "Percentage",
    "Score Range",
    "Description"
  ];
  tierHeaders.forEach((header, idx) => {
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

  const tierInfo = [
    {
      name: "EXCELLENT",
      range: "90-100",
      desc: "Outstanding performance, exceeds expectations"
    },
    {
      name: "GOOD",
      range: "75-89",
      desc: "Strong performance, meets all expectations"
    },
    {
      name: "AVERAGE",
      range: "60-74",
      desc: "Satisfactory performance, meets most expectations"
    },
    {
      name: "BELOW_AVERAGE",
      range: "40-59",
      desc: "Needs improvement in multiple areas"
    },
    {
      name: "POOR",
      range: "0-39",
      desc: "Requires immediate attention and training"
    }
  ];

  tierInfo.forEach((tier) => {
    const count = tiers[tier.name as keyof typeof tiers];
    const percentage =
      performanceData.length > 0 ? (count / performanceData.length) * 100 : 0;

    const row = [
      tier.name,
      count,
      `${percentage.toFixed(1)}%`,
      tier.range,
      tier.desc
    ];
    row.forEach((val, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = val;
      cell.alignment = {
        horizontal: idx === 4 ? "left" : "center",
        vertical: "middle"
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Color code tier name
      if (idx === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: tierColors[tier.name as keyof typeof tierColors] }
        };
        cell.font = { bold: true, color: { argb: "FFFFFF" } };
      }
    });
    currentRow++;
  });

  currentRow += 2;

  // ===== WORKER RANKINGS TABLE =====
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const rankingsHeaderCell = worksheet.getCell(`A${currentRow}`);
  rankingsHeaderCell.value = "Worker Rankings (All Workers)";
  rankingsHeaderCell.font = { size: 14, bold: true };
  rankingsHeaderCell.alignment = { horizontal: "left" };
  currentRow++;

  // Table headers
  const headers = [
    "Rank",
    "Worker Name",
    "Department",
    "Completed",
    "Failed",
    "Quality %",
    "Efficiency %",
    "Performance Score",
    "Rating",
    "Hours"
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
  performanceData.forEach((worker, index) => {
    const row = [
      worker.rank || index + 1,
      worker.workerName,
      worker.department || "N/A",
      worker.completedTasks,
      worker.failedTasks,
      worker.qualityScore.toFixed(1),
      worker.efficiency.toFixed(1),
      worker.performanceScore.toFixed(1),
      worker.performanceRating,
      worker.totalHours.toFixed(1)
    ];

    row.forEach((val, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = val;
      cell.alignment = {
        horizontal: idx === 1 || idx === 2 ? "left" : "center",
        vertical: "middle"
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Color code rating column
      if (idx === 8) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: tierColors[worker.performanceRating] }
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

  // ===== TOP 5 PERFORMERS HIGHLIGHT =====
  currentRow += 2;
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const topPerformersCell = worksheet.getCell(`A${currentRow}`);
  topPerformersCell.value = "🏆 TOP 5 PERFORMERS";
  topPerformersCell.font = { size: 14, bold: true, color: { argb: "FFFFFF" } };
  topPerformersCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD700" } // Gold
  };
  topPerformersCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 25;
  currentRow++;

  const top5 = performanceData.slice(0, 5);
  top5.forEach((worker, index) => {
    worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
    const cell = worksheet.getCell(`A${currentRow}`);
    cell.value = `#${index + 1}: ${worker.workerName} (${
      worker.department || "N/A"
    }) - Score: ${worker.performanceScore.toFixed(1)} - ${
      worker.completedTasks
    } tasks completed`;
    cell.font = { bold: true, size: 12 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb:
          index === 0
            ? "FFD700"
            : index === 1
            ? "C0C0C0"
            : index === 2
            ? "CD7F32"
            : "E0E0E0"
      }
    };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getRow(currentRow).height = 20;
    currentRow++;
  });

  // Column widths
  worksheet.getColumn(1).width = 8;
  worksheet.getColumn(2).width = 25;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 10;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 12;
  worksheet.getColumn(8).width = 18;
  worksheet.getColumn(9).width = 18;
  worksheet.getColumn(10).width = 10;

  ExcelFormatService.freezePanes(worksheet);

  console.log(
    `✓ Worker Rankings Sheet generated with ${performanceData.length} workers`
  );
}

/**
 * SHEET 2: Individual Worker Details
 * One section per worker with detailed metrics
 */
export async function generateWorkerDetailsSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter
): Promise<void> {
  console.log("Generating Worker Details Sheet...");

  const worksheet = workbook.addWorksheet("Worker Details");
  let currentRow = 1;

  // ===== TITLE =====
  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = "INDIVIDUAL WORKER DETAILS";
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // Get all workers
  const performanceData = await getWorkerPerformanceData(dateRange);

  // For each worker, create a detailed section
  for (const worker of performanceData) {
    // ===== WORKER NAME HEADER =====
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const workerHeaderCell = worksheet.getCell(`A${currentRow}`);
    workerHeaderCell.value = `${worker.workerName} (${
      worker.department || "N/A"
    })`;
    workerHeaderCell.font = { size: 14, bold: true, color: { argb: "FFFFFF" } };
    workerHeaderCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    workerHeaderCell.alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getRow(currentRow).height = 25;
    currentRow++;

    // ===== PERFORMANCE METRICS =====
    const metrics = [
      [
        "Performance Score:",
        worker.performanceScore.toFixed(1),
        "Rating:",
        worker.performanceRating
      ],
      [
        "Completed Tasks:",
        worker.completedTasks,
        "Failed Tasks:",
        worker.failedTasks
      ],
      [
        "Quality Score:",
        `${worker.qualityScore.toFixed(1)}%`,
        "Efficiency:",
        `${worker.efficiency.toFixed(1)}%`
      ],
      [
        "Total Hours:",
        `${worker.totalHours.toFixed(1)}h`,
        "Productive Time:",
        `${worker.productiveTime.toFixed(1)}h`
      ],
      [
        "Break Time:",
        `${worker.breakTime.toFixed(1)}h`,
        "Avg Task Time:",
        formatDuration(worker.avgTaskCompletionTime)
      ]
    ];

    metrics.forEach((metricRow) => {
      metricRow.forEach((val, idx) => {
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
      });
      currentRow++;
    });

    // ===== TASK BREAKDOWN =====
    currentRow++;
    const breakdown = await getWorkerTaskBreakdown(dateRange, worker.workerId);

    if (breakdown) {
      // By Status
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
      const statusHeaderCell = worksheet.getCell(`A${currentRow}`);
      statusHeaderCell.value = "Task Status Breakdown";
      statusHeaderCell.font = { bold: true, size: 12 };
      statusHeaderCell.alignment = { horizontal: "left" };
      currentRow++;

      const statusData = [
        ["Completed:", breakdown.byStatus.completed],
        ["Failed:", breakdown.byStatus.failed],
        ["Ongoing:", breakdown.byStatus.ongoing],
        ["Pending:", breakdown.byStatus.pending]
      ];

      statusData.forEach((row) => {
        worksheet.getCell(currentRow, 1).value = row[0];
        worksheet.getCell(currentRow, 2).value = row[1];
        worksheet.getCell(currentRow, 1).font = { bold: true };
        currentRow++;
      });

      // By Project (Top 3)
      if (breakdown.byProject.length > 0) {
        currentRow++;
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        const projectHeaderCell = worksheet.getCell(`A${currentRow}`);
        projectHeaderCell.value = "Top Projects";
        projectHeaderCell.font = { bold: true, size: 12 };
        projectHeaderCell.alignment = { horizontal: "left" };
        currentRow++;

        breakdown.byProject.slice(0, 3).forEach((project) => {
          worksheet.getCell(currentRow, 1).value = project.projectName;
          worksheet.getCell(currentRow, 2).value = `${project.taskCount} tasks`;
          currentRow++;
        });
      }

      // By Device Type (Top 3)
      if (breakdown.byDeviceType.length > 0) {
        currentRow++;
        worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
        const deviceHeaderCell = worksheet.getCell(`A${currentRow}`);
        deviceHeaderCell.value = "Top Device Types";
        deviceHeaderCell.font = { bold: true, size: 12 };
        deviceHeaderCell.alignment = { horizontal: "left" };
        currentRow++;

        breakdown.byDeviceType.slice(0, 3).forEach((deviceType) => {
          worksheet.getCell(currentRow, 1).value = deviceType.deviceTypeName;
          worksheet.getCell(
            currentRow,
            2
          ).value = `${deviceType.taskCount} tasks`;
          currentRow++;
        });
      }
    }

    currentRow += 3; // Space between workers
  }

  // Column widths
  worksheet.getColumn(1).width = 20;
  worksheet.getColumn(2).width = 20;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 15;
  worksheet.getColumn(6).width = 15;
  worksheet.getColumn(7).width = 15;
  worksheet.getColumn(8).width = 15;

  console.log(
    `✓ Worker Details Sheet generated for ${performanceData.length} workers`
  );
}

/**
 * SHEET 3: Device Type Proficiency
 * Workers × Device Types matrix with proficiency levels
 */
export async function generateDeviceProficiencySheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter
): Promise<void> {
  console.log("Generating Device Proficiency Sheet...");

  const worksheet = workbook.addWorksheet("Device Proficiency");
  let currentRow = 1;

  // ===== TITLE =====
  worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = "WORKER DEVICE TYPE PROFICIENCY MATRIX";
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // ===== LEGEND =====
  worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
  const legendCell = worksheet.getCell(`A${currentRow}`);
  legendCell.value =
    "Proficiency Levels: EXPERT (≥120%), PROFICIENT (100-119%), LEARNING (80-99%), BEGINNER (<80%)";
  legendCell.font = { size: 11, italic: true };
  legendCell.alignment = { horizontal: "center" };
  currentRow += 2;

  // Get proficiency data
  const proficiencyReports = await calculateDeviceProficiency(dateRange);

  if (proficiencyReports.length === 0) {
    worksheet.getCell(`A${currentRow}`).value =
      "No proficiency data available for the selected date range.";
    console.log("✓ Device Proficiency Sheet generated (no data)");
    return;
  }

  // Color codes for proficiency levels
  const proficiencyColors = {
    EXPERT: "4CAF50", // Green
    PROFICIENT: "2196F3", // Blue
    LEARNING: "FFC107", // Yellow
    BEGINNER: "F44336" // Red
  };

  // For each worker, create proficiency table
  for (const report of proficiencyReports) {
    // ===== WORKER NAME HEADER =====
    worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
    const workerHeaderCell = worksheet.getCell(`A${currentRow}`);
    workerHeaderCell.value = `${report.workerName} (${
      report.department || "N/A"
    }) - Overall Proficiency: ${report.overallProficiency.toFixed(1)}%`;
    workerHeaderCell.font = { size: 13, bold: true, color: { argb: "FFFFFF" } };
    workerHeaderCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
    };
    workerHeaderCell.alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getRow(currentRow).height = 22;
    currentRow++;

    // Summary row
    worksheet.getCell(currentRow, 1).value = "Summary:";
    worksheet.getCell(currentRow, 2).value = `Expert: ${report.expertDevices}`;
    worksheet.getCell(
      currentRow,
      3
    ).value = `Proficient: ${report.proficientDevices}`;
    worksheet.getCell(
      currentRow,
      4
    ).value = `Learning: ${report.learningDevices}`;
    worksheet.getCell(
      currentRow,
      5
    ).value = `Beginner: ${report.beginnerDevices}`;
    worksheet.getCell(currentRow, 1).font = { bold: true };
    currentRow++;

    // Table headers
    const headers = [
      "Device Type",
      "Tasks Completed",
      "Avg Estimated Time",
      "Avg Actual Time",
      "Proficiency %",
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
    report.deviceProficiencies.forEach((prof, index) => {
      const row = [
        prof.deviceTypeName,
        prof.tasksCompleted,
        formatDuration(prof.avgEstimatedDuration),
        formatDuration(prof.avgActualDuration),
        prof.proficiency.toFixed(1),
        prof.status
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

        // Color code status column
        if (idx === 5) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: proficiencyColors[prof.status] }
          };
          cell.font = { bold: true, color: { argb: "FFFFFF" } };
        }

        // Alternating row colors
        if (index % 2 === 1 && idx !== 5) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
          };
        }
      });

      currentRow++;
    });

    currentRow += 2; // Space between workers
  }

  // Column widths
  worksheet.getColumn(1).width = 30;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 18;
  worksheet.getColumn(4).width = 18;
  worksheet.getColumn(5).width = 15;
  worksheet.getColumn(6).width = 15;

  ExcelFormatService.freezePanes(worksheet);

  console.log(
    `✓ Device Proficiency Sheet generated for ${proficiencyReports.length} workers`
  );
}

/**
 * SHEET 4: Time Tracking & Quality
 * Time metrics, quality scores, overtime tracking
 */
export async function generateTimeTrackingSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter
): Promise<void> {
  console.log("Generating Time Tracking Sheet...");

  const worksheet = workbook.addWorksheet("Time Tracking & Quality");
  let currentRow = 1;

  // ===== TITLE =====
  worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = "WORKER TIME TRACKING & QUALITY METRICS";
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ExcelFormatService.COLORS.HEADER_BG }
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(currentRow).height = 30;
  currentRow += 2;

  // Get performance data
  const performanceData = await getWorkerPerformanceData(dateRange);

  // ===== TABLE HEADERS =====
  const headers = [
    "Worker Name",
    "Department",
    "Total Hours",
    "Productive Hours",
    "Break Hours",
    "Tasks Completed",
    "Tasks/Hour",
    "Quality Score %",
    "Efficiency %",
    "Avg Task Time",
    "Performance Rating"
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
  performanceData.forEach((worker, index) => {
    const tasksPerHour =
      worker.totalHours > 0 ? worker.completedTasks / worker.totalHours : 0;

    const row = [
      worker.workerName,
      worker.department || "N/A",
      worker.totalHours.toFixed(1),
      worker.productiveTime.toFixed(1),
      worker.breakTime.toFixed(1),
      worker.completedTasks,
      tasksPerHour.toFixed(2),
      worker.qualityScore.toFixed(1),
      worker.efficiency.toFixed(1),
      formatDuration(worker.avgTaskCompletionTime),
      worker.performanceRating
    ];

    row.forEach((val, idx) => {
      const cell = worksheet.getCell(currentRow, idx + 1);
      cell.value = val;
      cell.alignment = {
        horizontal: idx <= 1 ? "left" : "center",
        vertical: "middle"
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // Color code quality score
      if (idx === 7) {
        const score = worker.qualityScore;
        let color = ExcelFormatService.COLORS.DANGER;
        if (score >= 90) color = ExcelFormatService.COLORS.SUCCESS;
        else if (score >= 75) color = "90CAF9"; // Light blue
        else if (score >= 60) color = ExcelFormatService.COLORS.WARNING;

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: color }
        };
        cell.font = {
          bold: true,
          color: { argb: score >= 60 ? "000000" : "FFFFFF" }
        };
      }

      // Color code efficiency
      if (idx === 8) {
        const eff = worker.efficiency;
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

      // Alternating row colors (except colored cells)
      if (index % 2 === 1 && idx !== 7 && idx !== 8) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ExcelFormatService.COLORS.LIGHT_GRAY }
        };
      }
    });

    currentRow++;
  });

  // ===== SUMMARY STATISTICS =====
  currentRow += 2;
  worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
  const summaryHeaderCell = worksheet.getCell(`A${currentRow}`);
  summaryHeaderCell.value = "Summary Statistics";
  summaryHeaderCell.font = { size: 14, bold: true };
  summaryHeaderCell.alignment = { horizontal: "left" };
  currentRow++;

  const totalHours = performanceData.reduce((sum, w) => sum + w.totalHours, 0);
  const totalProductiveHours = performanceData.reduce(
    (sum, w) => sum + w.productiveTime,
    0
  );
  const totalBreakHours = performanceData.reduce(
    (sum, w) => sum + w.breakTime,
    0
  );
  const totalCompletedTasks = performanceData.reduce(
    (sum, w) => sum + w.completedTasks,
    0
  );
  const avgQuality =
    performanceData.length > 0
      ? performanceData.reduce((sum, w) => sum + w.qualityScore, 0) /
        performanceData.length
      : 0;
  const avgEfficiency =
    performanceData.length > 0
      ? performanceData.reduce((sum, w) => sum + w.efficiency, 0) /
        performanceData.length
      : 0;

  const summaryData = [
    ["Total Workers:", performanceData.length],
    ["Total Hours Worked:", `${totalHours.toFixed(1)}h`],
    ["Total Productive Hours:", `${totalProductiveHours.toFixed(1)}h`],
    ["Total Break Hours:", `${totalBreakHours.toFixed(1)}h`],
    ["Total Tasks Completed:", totalCompletedTasks],
    ["Average Quality Score:", `${avgQuality.toFixed(1)}%`],
    ["Average Efficiency:", `${avgEfficiency.toFixed(1)}%`]
  ];

  summaryData.forEach((row) => {
    worksheet.getCell(currentRow, 1).value = row[0];
    worksheet.getCell(currentRow, 2).value = row[1];
    worksheet.getCell(currentRow, 1).font = { bold: true };
    currentRow++;
  });

  // Column widths
  worksheet.getColumn(1).width = 20;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 12;
  worksheet.getColumn(4).width = 15;
  worksheet.getColumn(5).width = 12;
  worksheet.getColumn(6).width = 15;
  worksheet.getColumn(7).width = 12;
  worksheet.getColumn(8).width = 15;
  worksheet.getColumn(9).width = 12;
  worksheet.getColumn(10).width = 15;
  worksheet.getColumn(11).width = 18;

  ExcelFormatService.freezePanes(worksheet);

  console.log(
    `✓ Time Tracking Sheet generated for ${performanceData.length} workers`
  );
}

/**
 * SHEET 5: Raw Worker Data
 * All worker task records - raw export format
 */
export async function generateRawWorkerDataSheet(
  workbook: ExcelJS.Workbook,
  dateRange: DateRangeFilter
): Promise<void> {
  console.log("Generating Raw Worker Data Sheet...");

  const worksheet = workbook.addWorksheet("Raw Worker Data");
  let currentRow = 1;

  // ===== INSTRUCTIONS =====
  worksheet.mergeCells(`A${currentRow}:P${currentRow}`);
  const instructionsCell = worksheet.getCell(`A${currentRow}`);
  instructionsCell.value =
    "RAW WORKER DATA EXPORT - This sheet contains all task records assigned to workers in the date range. Use for data analysis, export/import, or integration with other systems.";
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
    "Worker ID",
    "Worker Name",
    "Department",
    "Task Title",
    "Project ID",
    "Recipe ID",
    "Device Type ID",
    "Device ID",
    "Status",
    "Priority",
    "Estimated Duration (s)",
    "Actual Duration (s)",
    "Paused Duration (s)",
    "Started At",
    "Completed At",
    "Created At",
    "Quality Score",
    "Efficiency %",
    "Notes"
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
    workerId: { $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  })
    .populate("workerId", "name department")
    .populate("projectId", "_id")
    .lean()
    .sort({ completedAt: -1, createdAt: -1 });

  // ===== DATA ROWS =====
  tasks.forEach((task) => {
    const worker = task.workerId as any;
    const workerName = worker?.name || "Unknown";
    const department = worker?.department || "N/A";

    const efficiency =
      task.status === "COMPLETED" &&
      task.actualDuration &&
      task.estimatedDuration
        ? (task.estimatedDuration / task.actualDuration) * 100
        : 0;

    const qualityScore = task.qualityData?.score || "N/A";

    const row = [
      task._id.toString(),
      worker?._id?.toString() || "N/A",
      workerName,
      department,
      task.title,
      task.projectId ? (task.projectId as any)._id.toString() : "N/A",
      task.recipeId?.toString() || "N/A",
      task.deviceTypeId?.toString() || "N/A",
      task.deviceId?.toString() || "N/A",
      task.status,
      task.priority,
      task.estimatedDuration || 0,
      task.actualDuration || 0,
      task.pausedDuration || 0,
      task.startedAt ? task.startedAt.toISOString() : "N/A",
      task.completedAt ? task.completedAt.toISOString() : "N/A",
      task.createdAt.toISOString(),
      qualityScore,
      efficiency > 0 ? efficiency.toFixed(1) : "N/A",
      task.notes || ""
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
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 15;
  worksheet.getColumn(5).width = 30;
  worksheet.getColumn(6).width = 25;
  worksheet.getColumn(7).width = 25;
  worksheet.getColumn(8).width = 25;
  worksheet.getColumn(9).width = 25;
  worksheet.getColumn(10).width = 12;
  worksheet.getColumn(11).width = 10;
  worksheet.getColumn(12).width = 20;
  worksheet.getColumn(13).width = 18;
  worksheet.getColumn(14).width = 18;
  worksheet.getColumn(15).width = 20;
  worksheet.getColumn(16).width = 20;
  worksheet.getColumn(17).width = 20;
  worksheet.getColumn(18).width = 15;
  worksheet.getColumn(19).width = 12;
  worksheet.getColumn(20).width = 40;

  console.log(
    `✓ Raw Worker Data Sheet generated with ${tasks.length} task records`
  );
}
