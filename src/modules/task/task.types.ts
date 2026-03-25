export type TaskStatus =
  | "PENDING"
  | "ONGOING"
  | "PAUSED"
  | "PAUSED_EMERGENCY"
  | "COMPLETED"
  | "FAILED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskCreateDTO {
  title: string;
  description?: string;
  projectId?: string;
  recipeId?: string;
  productId?: string;
  deviceId?: string;
  workerId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  estimatedDuration?: number;
  notes?: string;
  qualityData?: any;
}

export interface TaskUpdateDTO {
  status?: TaskStatus;
  priority?: TaskPriority;
  notes?: string;
  mediaFiles?: string[];
  deviceId?: string;
  workerId?: string;
  pausedDuration?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  progress?: number;
}

export interface TaskBatchUpdateDTO {
  taskIds: string[];
  updates: TaskUpdateDTO;
}

export interface TaskListQuery {
  status?: TaskStatus;
  deviceId?: string;
  deviceTypeId?: string;
  projectId?: string;
  recipeId?: string;
  productId?: string;
  priority?: TaskPriority;
  workerId?: string;
  search?: string;
  includePendingAndPartial?: string;
  page?: string;
  limit?: string;
}

export interface TaskStatisticsQuery {
  projectId?: string;
  deviceTypeId?: string;
  workerId?: string;
  startDate?: string;
  endDate?: string;
}

export interface TaskGroupedQuery {
  projectStatus?: string;
  taskStatus?: TaskStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: string;
  limit?: string;
}

export interface TaskStandaloneQuery {
  status?: TaskStatus;
  deviceId?: string;
  deviceTypeId?: string;
  recipeId?: string;
  workerId?: string;
  search?: string;
  page?: string;
  limit?: string;
}

export interface DeviceTaskQuery {
  status?: TaskStatus;
  workerId?: string;
  start?: string;
  end?: string;
  page?: string;
  limit?: string;
}

export interface WorkerTaskQuery {
  status?: TaskStatus;
  start?: string;
  end?: string;
  page?: string;
  limit?: string;
}

export interface TaskStatusUpdateBody {
  status?: TaskStatus;
  notes?: string;
  startTime?: string;
  endTime?: string;
  progress?: number;
  workerId?: string;
  deviceId?: string;
}

export interface TaskCompleteBody {
  workerId?: string;
  notes?: string;
  qualityData?: { progress?: number } & Record<string, unknown>;
  actualDuration?: number;
}

export interface TaskStartBody {
  workerId?: string;
  deviceId?: string;
}

export interface TaskResumeBody {
  resolvedBy?: string;
}

export interface TaskPauseBody {
  reason?: string;
  notes?: string;
  reportedBy?: string;
  isEmergency?: boolean;
}