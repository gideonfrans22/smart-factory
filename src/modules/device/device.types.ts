import mongoose from "mongoose";

export interface DeviceDTO {
  name: string;
  deviceTypeId: string;
  status?: "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR";
  ipAddress?: string;
  macAddress?: string;
  config?: Record<string, any>;
}

export interface DeviceUpdateDTO {
  name?: string;
  deviceTypeId?: string;
  status?: "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR";
  currentUser?: string | null;
  ipAddress?: string;
  config?: Record<string, any>;
  errorReason?: string;
  statusChangeReason?: string;
}

export interface DeviceFilters {
  status?: "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR";
  page?: number;
  limit?: number;
}

export interface DeviceStatisticsFilters {
  timeRange?: "daily" | "weekly" | "monthly";
  status?: "ONLINE" | "OFFLINE" | "MAINTENANCE" | "ERROR";
  limit?: number;
}

export interface DevicesByTaskFilters {
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  limit?: number;
  sortBy?: "workload" | "status" | "name";
}

export interface DeviceStatistics {
  deviceId: string | mongoose.Types.ObjectId;
  deviceName: string;
  status: string;
  utilization: number;
  workload: number;
  healthScore: number;
  uptime: number;
  efficiency: number;
  lastStatusChange: Date;
  totalTasksProcessed: number;
  avgTaskDuration: number;
  failureRate: number;
}

export interface DeviceWithTasks {
  deviceId: string | mongoose.Types.ObjectId;
  deviceName: string;
  status: string;
  tasks: Array<{
    taskId: any;
    taskName: any;
    status: any;
    assignedWorker: {
      workerId: any;
      workerName: any;
    } | null;
    progress: any;
    startTime: any;
    estimatedEndTime: Date | null;
    priority: any;
  }>;
  activeTaskCount: number;
  pendingTaskCount: number;
  totalWorkload: number;
}
  