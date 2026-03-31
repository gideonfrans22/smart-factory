import type { TaskStatus } from "../task.types";

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

/** Mongoose task document after save + populate (opaque at the port boundary). */
export type TaskPersisted = object;

export interface TaskRepo {
  loadForPause(id: string): Promise<TaskPauseState | null>;
  persistPause(state: TaskPauseState): Promise<TaskPersisted>;

  loadForStart(id: string): Promise<TaskStartReadModel | null>;
  persistStart(state: TaskStartPersistState): Promise<TaskPersisted>;

  loadForResume(id: string): Promise<TaskResumeReadModel | null>;
  persistResume(state: TaskResumePersistState): Promise<TaskPersisted>;
}
