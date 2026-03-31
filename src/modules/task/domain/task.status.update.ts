import type { DeviceRepo } from "../ports/DeviceRepo";
import type {
  TaskPersisted,
  TaskRepo,
  TaskStatusUpdatePersistState
} from "../ports/TaskRepo";
import type { TaskStatusUpdateBody } from "../task.types";
import { TaskDomainError } from "./errors";
import { computeActualDurationMinutes } from "./task.duration";

export interface UpdateTaskStatusDeps {
  taskRepo: TaskRepo;
  deviceRepo: DeviceRepo;
}

export interface UpdateTaskStatusInput {
  taskId: string;
  body: TaskStatusUpdateBody;
  userName?: string;
}

export async function updateTaskStatus(
  deps: UpdateTaskStatusDeps,
  input: UpdateTaskStatusInput
): Promise<TaskPersisted> {
  const task = await deps.taskRepo.loadForStatusUpdate(input.taskId);
  if (!task) {
    throw new TaskDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Task not found"
    });
  }

  const { status, notes, startTime, endTime, progress, workerId, deviceId } =
    input.body;

  if (status === "ONGOING" && !workerId && !task.workerId) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "workerId is required to set task status to ONGOING"
    });
  }
  if (status === "ONGOING" && !deviceId && !task.deviceId) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "deviceId is required to set task status to ONGOING"
    });
  }

  let nextStatus = task.status;
  if (status) {
    nextStatus = status;
  }

  let nextNotes = task.notes;
  if (notes) {
    nextNotes = notes;
  }

  let nextStartedAt = task.startedAt;
  if (startTime) {
    nextStartedAt = new Date(startTime);
  }

  let nextCompletedAt = task.completedAt;
  if (endTime) {
    nextCompletedAt = new Date(endTime);
  }

  let nextProgress = task.progress;
  if (progress !== undefined) {
    nextProgress = progress;
  }

  const pauseHistory = task.pauseHistory.map((e) => ({
    pausedAt: e.pausedAt,
    resumedAt: e.resumedAt,
    reason: e.reason,
    pausedBy: e.pausedBy,
    resolvedBy: e.resolvedBy
  }));

  let nextPausedDuration = task.pausedDuration ?? 0;

  if (status === "COMPLETED" && pauseHistory.length > 0) {
    const lastPause = pauseHistory[pauseHistory.length - 1];
    if (lastPause && !lastPause.resumedAt) {
      const completedAt = nextCompletedAt || new Date();
      lastPause.resumedAt = completedAt;
      lastPause.resolvedBy = input.userName || "System";
      const lastPauseDuration = Math.floor(
        (new Date(completedAt).getTime() -
          new Date(lastPause.pausedAt).getTime()) /
          (1000 * 60)
      );
      nextPausedDuration = (task.pausedDuration || 0) + lastPauseDuration;
    }
  }

  let actualDuration: number | undefined;
  if (
    status === "COMPLETED" &&
    nextStartedAt &&
    nextCompletedAt
  ) {
    actualDuration = computeActualDurationMinutes(
      nextStartedAt,
      nextCompletedAt,
      nextPausedDuration
    );
  }

  const persistState: TaskStatusUpdatePersistState = {
    id: task.id,
    status: nextStatus,
    notes: nextNotes,
    startedAt: nextStartedAt,
    completedAt: nextCompletedAt,
    progress: nextProgress,
    pauseHistory,
    pausedDuration: nextPausedDuration,
    actualDuration
  };

  const persisted = await deps.taskRepo.persistStatusUpdate(persistState);

  if (status === "COMPLETED" || status === "FAILED") {
    if (task.deviceId) {
      await deps.deviceRepo.clearCurrentAssignment(task.deviceId);
    }
  }

  return persisted;
}
