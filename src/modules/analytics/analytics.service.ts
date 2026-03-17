import { User } from "../user/user.model";
import { Task } from "../../models/Task";
import {
  WorkerPerformanceFilters,
  WorkerPerformanceData,
  WorkerMetrics
} from "./analytics.types";

export class AnalyticsService {
  async getWorkerPerformance(
    filters: WorkerPerformanceFilters = {}
  ): Promise<WorkerPerformanceData> {
    const {
      timeRange = "daily",
      department: departmentFilter,
      limit = 100
    } = filters;

    const now = new Date();
    let startDate = new Date();

    if (timeRange === "weekly") {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === "monthly") {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      startDate.setDate(now.getDate() - 1);
    }

    const workerQuery: any = { role: "worker" };
    if (departmentFilter) workerQuery.department = departmentFilter;

    const workers = await User.find(workerQuery)
      .limit(limit)
      .select("-password");

    const workerStats = await Promise.all(
      workers.map(async (worker) => {
        return this.calculateWorkerMetrics(worker, startDate, now);
      })
    );

    const totalWorkers = workerStats.length;
    const activeWorkers = workerStats.filter(
      (w) => w.status === "ACTIVE"
    ).length;
    const avgCompletionRate =
      totalWorkers > 0
        ? workerStats.reduce((sum, w) => sum + w.completionRate, 0) /
          totalWorkers
        : 0;
    const avgQualityScore =
      totalWorkers > 0
        ? workerStats.reduce((sum, w) => sum + w.qualityScore, 0) / totalWorkers
        : 0;
    const avgProductivity =
      totalWorkers > 0
        ? workerStats.reduce((sum, w) => sum + w.productivity, 0) / totalWorkers
        : 0;

    return {
      items: workerStats,
      summary: {
        totalWorkers,
        activeWorkers,
        avgCompletionRate: Math.round(avgCompletionRate),
        avgQualityScore: Math.round(avgQualityScore),
        avgProductivity: Math.round(avgProductivity)
      }
    };
  }

  private async calculateWorkerMetrics(
    worker: any,
    startDate: Date,
    endDate: Date
  ): Promise<WorkerMetrics> {
    const allTasks = await Task.find({
      workerId: worker._id,
      createdAt: { $gte: startDate, $lte: endDate }
    })
      .populate("recipeSnapshotId", "name")
      .populate("productSnapshotId", "customerName");

    const assignedTasks = allTasks.length;
    const completedTasks = allTasks.filter(
      (t) => t.status === "COMPLETED"
    ).length;
    const inProgressTasks = allTasks.filter(
      (t) => t.status === "ONGOING"
    ).length;
    const failedTasks = allTasks.filter((t) => t.status === "FAILED").length;

    const completionRate = this.calculateCompletionRate(
      completedTasks,
      assignedTasks
    );

    const completedTasksWithDuration = allTasks
      .filter((t) => t.status === "COMPLETED" && t.actualDuration)
      .map((t) => t.actualDuration || 0);
    const avgDuration =
      completedTasksWithDuration.length > 0
        ? completedTasksWithDuration.reduce((a, b) => a + b, 0) /
          completedTasksWithDuration.length
        : 0;

    const errorFreeTasks = completedTasks - failedTasks;
    const qualityScore = this.calculateQualityScore(
      errorFreeTasks,
      completedTasks
    );

    const currentTask = allTasks.find((t) => t.status === "ONGOING");

    const onTimeCompleted = allTasks.filter((t) => {
      if (t.status !== "COMPLETED") return false;
      if (t.actualDuration && t.estimatedDuration) {
        return t.actualDuration <= t.estimatedDuration;
      }
      return true;
    }).length;
    const productivity =
      assignedTasks > 0 ? (onTimeCompleted / assignedTasks) * 100 : 0;

    const totalMinutesWorked = allTasks
      .filter((t) => t.actualDuration)
      .reduce((sum, t) => sum + (t.actualDuration || 0), 0);
    const totalHoursWorked = totalMinutesWorked / 60;

    const tasksPerHour =
      totalHoursWorked > 0 ? completedTasks / totalHoursWorked : completedTasks;

    const performanceRating = this.determinePerformanceRating({
      completion: completionRate,
      quality: qualityScore,
      productivity
    });

    return {
      workerId: worker._id.toString(),
      workerName: worker.name,
      department: worker.department || "N/A",
      status: worker.isActive ? "ACTIVE" : "OFFLINE",
      completionRate: Math.round(completionRate),
      avgDuration: Math.round(avgDuration),
      qualityScore: Math.round(qualityScore),
      taskCount: {
        assigned: assignedTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        failed: failedTasks
      },
      currentTask: currentTask
        ? {
            taskId: (currentTask._id as any).toString(),
            taskName: currentTask.title,
            device: currentTask.deviceId
              ? currentTask.deviceId.toString()
              : "N/A",
            progress: currentTask.progress,
            startTime: currentTask.startedAt,
            partName: (currentTask as any).recipeSnapshotId?.name || undefined,
            customerName:
              (currentTask as any).productSnapshotId?.customerName || undefined,
            recipeSnapshotId: (currentTask as any).recipeSnapshotId
              ? {
                  _id: (currentTask as any).recipeSnapshotId._id.toString(),
                  name: (currentTask as any).recipeSnapshotId.name
                }
              : undefined,
            productSnapshotId: (currentTask as any).productSnapshotId
              ? {
                  _id: (currentTask as any).productSnapshotId._id.toString(),
                  customerName: (currentTask as any).productSnapshotId
                    .customerName
                }
              : undefined
          }
        : null,
      productivity: Math.round(productivity),
      totalHoursWorked: Math.round(totalHoursWorked),
      tasksPerHour: Math.round(tasksPerHour * 10) / 10,
      lastActivityTime:
        allTasks.length > 0
          ? new Date(
              Math.max(
                ...allTasks.map((t) => new Date(t.updatedAt).getTime())
              )
            )
          : null,
      performanceRating
    };
  }

  private calculateCompletionRate(
    completed: number,
    total: number
  ): number {
    return total > 0 ? (completed / total) * 100 : 0;
  }

  private calculateQualityScore(
    errorFree: number,
    completed: number
  ): number {
    return completed > 0
      ? (Math.max(0, errorFree) / completed) * 100
      : 0;
  }

  private determinePerformanceRating(metrics: {
    completion: number;
    quality: number;
    productivity: number;
  }): string {
    const avgMetric =
      (metrics.completion + metrics.quality + metrics.productivity) / 3;
    
    if (avgMetric >= 85) {
      return "EXCELLENT";
    } else if (avgMetric >= 70) {
      return "GOOD";
    } else if (avgMetric >= 50) {
      return "AVERAGE";
    } else {
      return "POOR";
    }
  }
}

export const analyticsService = new AnalyticsService();
