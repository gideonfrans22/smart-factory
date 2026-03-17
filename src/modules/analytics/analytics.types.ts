export interface WorkerPerformanceFilters {
  timeRange?: "daily" | "weekly" | "monthly";
  department?: string;
  limit?: number;
}

export interface WorkerMetrics {
  workerId: string;
  workerName: string;
  department: string;
  status: string;
  completionRate: number;
  avgDuration: number;
  qualityScore: number;
  taskCount: {
    assigned: number;
    completed: number;
    inProgress: number;
    failed: number;
  };
  currentTask: {
    taskId: string;
    taskName: string;
    device: string;
    progress: number;
    startTime?: Date;
    partName?: string;
    customerName?: string;
    recipeSnapshotId?: {
      _id: string;
      name: string;
    };
    productSnapshotId?: {
      _id: string;
      customerName: string;
    };
  } | null;
  productivity: number;
  totalHoursWorked: number;
  tasksPerHour: number;
  lastActivityTime: Date | null;
  performanceRating: string;
}

export interface WorkerPerformanceSummary {
  totalWorkers: number;
  activeWorkers: number;
  avgCompletionRate: number;
  avgQualityScore: number;
  avgProductivity: number;
}

export interface WorkerPerformanceData {
  items: WorkerMetrics[];
  summary: WorkerPerformanceSummary;
}
