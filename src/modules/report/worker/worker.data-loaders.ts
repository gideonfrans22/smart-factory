/**
 * Worker Performance Report Data Aggregation Service
 * Handles all data queries and calculations for worker performance reports
 */

import { Task } from "@/modules/task";
import { DateRangeFilter } from "../helpers/adjustDateRangeForPeriod";

/**
 * Interface for Worker Performance Summary Data
 */
export interface WorkerPerformanceSummary {
  sequence: number;
  workerId: string;
  workerName: string;
  department: string;
  totalWorkMinutes: number; // in minutes
  overtimeMinutes: number; // in minutes
  productionVolume: number; // count of completed tasks
  defectCount: number; // count of failed tasks
  workDelayRate: number; // percentage (0-100)
  remarks?: string;
}

/**
 * Get Worker Performance Summary Data for all workers
 */
export async function aggregateWorkerPerformanceSummary(
  dateRange: DateRangeFilter
): Promise<WorkerPerformanceSummary[]> {
  const { startDate, endDate } = dateRange;

  // Calculate number of weeks in the period for overtime calculation
  const daysInPeriod =
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
  const weeksInPeriod = daysInPeriod / 7;
  const standardHoursPerPeriod = weeksInPeriod * 40; // 40 hours per week

  // Get all tasks in the date range with worker assignments
  const tasks = await Task.find({
    workerId: { $ne: null },
    $or: [
      { createdAt: { $gte: startDate, $lte: endDate } },
      { startedAt: { $gte: startDate, $lte: endDate } },
      { completedAt: { $gte: startDate, $lte: endDate } }
    ]
  })
    .populate("workerId", "name department")
    .lean();

  // Group tasks by worker
  const workerMap = new Map<
    string,
    {
      workerId: string;
      workerName: string;
      department: string;
      tasks: any[];
    }
  >();

  tasks.forEach((task) => {
    const worker = task.workerId as any;
    if (!worker || !worker._id) return;

    const workerId = worker._id.toString();
    if (!workerMap.has(workerId)) {
      workerMap.set(workerId, {
        workerId,
        workerName: worker.name || "Unknown",
        department: worker.department || "N/A",
        tasks: []
      });
    }
    workerMap.get(workerId)!.tasks.push(task);
  });

  // Calculate metrics for each worker
  const summaryData: WorkerPerformanceSummary[] = [];

  workerMap.forEach((workerData) => {
    const workerTasks = workerData.tasks;
    const completedTasks = workerTasks.filter((t) => t.status === "COMPLETED");
    const failedTasks = workerTasks.filter((t) => t.status === "FAILED");

    // Total Work Hours: Sum of actual durations (convert minutes to hours)
    const totalWorkMinutes = completedTasks.reduce((sum, task) => {
      return sum + (task.actualDuration || 0);
    }, 0);

    // Overtime: max(0, Total Hours - Standard Hours)
    const overtimeMinutes = Math.max(
      0,
      totalWorkMinutes - standardHoursPerPeriod
    );

    // Production Volume: Count of completed tasks
    const productionVolume = completedTasks.length;

    // Defect Count: Count of failed tasks
    const defectCount = failedTasks.length;

    // Work Delay Rate: (Delayed Tasks / Total Tasks) * 100%
    // Delayed Task: CompletedAt > Deadline OR ActualDuration > EstimatedDuration
    const totalTasks = workerTasks.length;
    let delayedTasks = 0;

    workerTasks.forEach((task) => {
      let isDelayed = false;

      // Check if missed deadline
      if (task.deadline && task.completedAt) {
        if (new Date(task.completedAt) > new Date(task.deadline)) {
          isDelayed = true;
        }
      }

      // Check if exceeded estimated duration
      if (
        !isDelayed &&
        task.estimatedDuration &&
        task.actualDuration &&
        task.actualDuration > task.estimatedDuration
      ) {
        isDelayed = true;
      }

      if (isDelayed) {
        delayedTasks++;
      }
    });

    const workDelayRate =
      totalTasks > 0 ? (delayedTasks / totalTasks) * 100 : 0;

    summaryData.push({
      sequence: 0, // Will be set when sorting
      workerId: workerData.workerId,
      workerName: workerData.workerName,
      department: workerData.department,
      totalWorkMinutes,
      overtimeMinutes,
      productionVolume,
      defectCount,
      workDelayRate
    });
  });

  // Sort by worker name and assign sequence numbers
  summaryData.sort((a, b) => {
    if (a.department !== b.department) {
      return a.department.localeCompare(b.department);
    }
    return a.workerName.localeCompare(b.workerName);
  });

  summaryData.forEach((data, index) => {
    data.sequence = index + 1;
  });

  return summaryData;
}
