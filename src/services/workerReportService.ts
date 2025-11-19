import mongoose from "mongoose";
import { Task } from "../models/Task";
import { User } from "../models/User";

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
