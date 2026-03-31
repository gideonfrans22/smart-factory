import type { TaskPriority, TaskStatus } from "../task.types";

export interface TaskPauseHistoryEntry {
  pausedAt: Date;
  resumedAt?: Date;
  reason: string;
  pausedBy: string;
  resolvedBy?: string;
}

export interface TaskPauseState {
  id: string;
  status: TaskStatus;
  pauseHistory: TaskPauseHistoryEntry[];
}

export interface TaskStartReadModel {
  id: string;
  status: TaskStatus;
  progress?: number | null;
}

export interface TaskStartPersistState {
  id: string;
  workerId: string;
  deviceId?: string;
  startedAt: Date;
  progress: number;
}

export interface TaskResumeReadModel {
  id: string;
  status: TaskStatus;
  progress?: number | null;
  deviceId?: string;
  pauseHistory: TaskPauseHistoryEntry[];
  pausedDuration: number;
}

export interface TaskResumePersistState {
  id: string;
  status: TaskStatus;
  pauseHistory: TaskPauseHistoryEntry[];
  pausedDuration: number;
}

export interface TaskStatusUpdateReadModel {
  id: string;
  status: TaskStatus;
  progress?: number | null;
  notes?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  pauseHistory: TaskPauseHistoryEntry[];
  pausedDuration?: number | null;
  workerId?: string | null;
  deviceId?: string | null;
}

export interface TaskStatusUpdatePersistState {
  id: string;
  status: TaskStatus;
  notes?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  progress?: number | null;
  pauseHistory: TaskPauseHistoryEntry[];
  pausedDuration?: number | null;
  actualDuration?: number | null;
}

export interface TaskPatchReadModel {
  id: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress?: number | null;
  notes?: string | null;
  mediaFiles: string[];
  deviceId?: string | null;
  workerId?: string | null;
  pausedDuration?: number | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface TaskPatchPersistState {
  id: string;
  status: TaskStatus;
  priority: TaskPriority;
  notes?: string | null;
  mediaFiles: string[];
  deviceId?: string | null;
  workerId?: string | null;
  pausedDuration?: number | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  progress?: number | null;
  actualDuration?: number | null;
}

export interface TaskBatchUpdateSummary {
  totalRequested: number;
  found: number;
  updated: number;
  notFound: string[];
}

/** Mongoose task document after save + populate (opaque at the port boundary). */
export type TaskPersisted = object;

export interface TaskBatchUpdateResult {
  updated: TaskPersisted[];
  summary: TaskBatchUpdateSummary;
  message: string;
}

/** Pure persistence outcome from `batchUpdate` (no broadcasts or device side effects). */
export interface TaskBatchPersistResult {
  updatedTasks: TaskPersisted[];
  foundIds: string[];
  notFoundIds: string[];
  modifiedCount: number;
}

export interface TaskRepo {
  loadForPause(id: string): Promise<TaskPauseState | null>;
  persistPause(state: TaskPauseState): Promise<TaskPersisted>;

  loadForStart(id: string): Promise<TaskStartReadModel | null>;
  persistStart(state: TaskStartPersistState): Promise<TaskPersisted>;

  loadForResume(id: string): Promise<TaskResumeReadModel | null>;
  persistResume(state: TaskResumePersistState): Promise<TaskPersisted>;

  loadForStatusUpdate(id: string): Promise<TaskStatusUpdateReadModel | null>;
  persistStatusUpdate(
    state: TaskStatusUpdatePersistState
  ): Promise<TaskPersisted>;

  loadForPatch(id: string): Promise<TaskPatchReadModel | null>;
  persistPatch(state: TaskPatchPersistState): Promise<TaskPersisted>;

  batchFindOngoingIds(taskIds: string[]): Promise<string[]>;
  countTasksWithoutWorkerId(taskIds: string[]): Promise<number>;
  countTasksWithoutDeviceId(taskIds: string[]): Promise<number>;
  batchUpdate(
    taskIds: string[],
    updateFields: Record<string, unknown>
  ): Promise<TaskBatchPersistResult>;
  /** Distinct device ids (string) for tasks in `taskIds` that have a non-null `deviceId`. */
  findDeviceIdsForTasks(taskIds: string[]): Promise<string[]>;
}
