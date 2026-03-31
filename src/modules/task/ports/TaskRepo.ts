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

/** Persisted task document after save + populate (opaque at the port boundary). */
export type TaskPausePersisted = object;

export interface TaskRepo {
  loadForPause(id: string): Promise<TaskPauseState | null>;
  persistPause(state: TaskPauseState): Promise<TaskPausePersisted>;
}
