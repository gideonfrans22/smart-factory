import { Task } from "../task.model";
import type {
  DeviceTaskQuery,
  TaskGroupedQuery,
  TaskListQuery,
  TaskStandaloneQuery,
  TaskStatisticsQuery,
  WorkerTaskQuery
} from "../task.types";

export type TaskReadListPage = {
  items: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type TaskReadWorkerListResult = {
  items: unknown[];
  statistics: {
    totalTasks: number;
    byStatus: {
      PENDING: number;
      ONGOING: number;
      PAUSED: number;
      COMPLETED: number;
      FAILED: number;
    };
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type TaskReadGroupedResult = {
  items: Record<string, unknown>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export interface TaskReadPort {
  listTasks(query: TaskListQuery): Promise<TaskReadListPage>;
  getTaskById(id: string): Promise<InstanceType<typeof Task>>;
  listStandaloneTasks(query: TaskStandaloneQuery): Promise<TaskReadListPage>;
  listDeviceTasks(
    deviceId: string,
    query: DeviceTaskQuery
  ): Promise<TaskReadListPage>;
  listWorkerTasks(
    workerId: string,
    query: WorkerTaskQuery
  ): Promise<TaskReadWorkerListResult>;
  getTaskStatistics(query: TaskStatisticsQuery): Promise<Record<string, unknown>>;
  getGroupedTasks(query: TaskGroupedQuery): Promise<TaskReadGroupedResult>;
}
