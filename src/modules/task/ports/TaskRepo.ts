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

  loadForFail(id: string): Promise<TaskFailReadModel | null>;
  persistFailRoot(input: { id: string; notes?: string }): Promise<TaskPersisted>;
  findActiveDependentsForFail(
    taskId: string
  ): Promise<Array<{ id: string; title: string }>>;
  persistFailDependent(input: TaskFailDependentPersistInput): Promise<TaskPersisted>;
  listTasksByProjectId(
    projectId: string
  ): Promise<Array<{ id: string; status: TaskStatus }>>;

  loadForComplete(id: string): Promise<TaskCompleteReadModel | null>;
  persistComplete(state: TaskCompletePersistState): Promise<TaskPersisted>;
  populateTaskForCompleteResponse(taskId: string): Promise<TaskPersisted>;
  findNextByDependentTask(completedTaskId: string): Promise<TaskPersisted | null>;
}

export interface TaskFailReadModel {
  id: string;
  title: string;
  projectId?: string | null;
}

export interface TaskFailDependentPersistInput {
  id: string;
  rootTaskTitle: string;
}

export interface TaskCompleteReadModel {
  id: string;
  status: TaskStatus;
  workerId?: string | null;
  recipeSnapshotId: string | null;
  projectId?: string | null;
  deviceId?: string | null;
  pauseHistory: TaskPauseHistoryEntry[];
  pausedDuration: number;
  startedAt?: Date | null;
  isLastStepInRecipe: boolean;
  recipeExecutionNumber: number;
  totalRecipeExecutions: number;
  productId?: string | null;
  title: string;
}

export interface TaskCompletePersistState {
  id: string;
  status: TaskStatus;
  workerId?: string | null;
  completedAt: Date;
  progress: number;
  notes?: string;
  qualityData?: unknown;
  actualDuration?: number | null;
  pausedDuration?: number | null;
  pauseHistory: TaskPauseHistoryEntry[];
}
