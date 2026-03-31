import type { TaskNotifier } from "../ports/TaskNotifier";
import type {
  TaskPatchPersistState,
  TaskPersisted,
  TaskRepo
} from "../ports/TaskRepo";
import type { TaskStatus, TaskUpdateDTO } from "../task.types";
import { TaskDomainError } from "./errors";
import { computeActualDurationMinutes } from "./task.duration";

export interface PatchTaskDeps {
  taskRepo: TaskRepo;
  notifier: TaskNotifier;
}

export interface PatchTaskInput {
  taskId: string;
  dto: TaskUpdateDTO;
}

export async function patchTask(
  deps: PatchTaskDeps,
  input: PatchTaskInput
): Promise<TaskPersisted> {
  const task = await deps.taskRepo.loadForPatch(input.taskId);
  if (!task) {
    throw new TaskDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Task not found"
    });
  }

  const {
    status,
    priority,
    notes,
    mediaFiles,
    deviceId,
    workerId,
    pausedDuration,
    startedAt,
    completedAt,
    progress
  } = input.dto;

  if (task.status === "ONGOING") {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "작업이 이미 진행 중입니다, 업데이트 불가!"
    });
  }

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

  let nextStatus: TaskStatus = task.status as TaskStatus;
  if (status !== undefined) {
    nextStatus = status;
  }

  let nextPriority = task.priority;
  if (priority !== undefined) {
    nextPriority = priority;
  }

  let nextNotes = task.notes;
  if (notes !== undefined) {
    nextNotes = notes;
  }

  let nextMediaFiles = task.mediaFiles;
  if (mediaFiles !== undefined) {
    nextMediaFiles = mediaFiles;
  }

  let nextDeviceId = task.deviceId;
  if (deviceId !== undefined) {
    nextDeviceId = deviceId;
  }

  let nextWorkerId = task.workerId;
  if (workerId !== undefined) {
    nextWorkerId = workerId;
  }

  let nextPausedDuration = task.pausedDuration;
  if (pausedDuration !== undefined) {
    nextPausedDuration = pausedDuration;
  }

  let nextStartedAt = task.startedAt;
  if (startedAt !== undefined) {
    nextStartedAt = startedAt ? new Date(startedAt) : undefined;
  }

  let nextCompletedAt = task.completedAt;
  if (completedAt !== undefined) {
    nextCompletedAt = completedAt ? new Date(completedAt) : undefined;
  }

  let nextProgress = task.progress;
  if (progress !== undefined) {
    nextProgress = progress;
  }

  let actualDuration: number | undefined;
  if (nextStartedAt && nextCompletedAt) {
    actualDuration = computeActualDurationMinutes(
      nextStartedAt,
      nextCompletedAt,
      nextPausedDuration ?? 0
    );
  }

  const persistState: TaskPatchPersistState = {
    id: task.id,
    status: nextStatus,
    priority: nextPriority,
    notes: nextNotes,
    mediaFiles: nextMediaFiles,
    deviceId: nextDeviceId,
    workerId: nextWorkerId,
    pausedDuration: nextPausedDuration,
    startedAt: nextStartedAt,
    completedAt: nextCompletedAt,
    progress: nextProgress,
    actualDuration
  };

  const persisted = await deps.taskRepo.persistPatch(persistState);

  if (status !== undefined) {
    await deps.notifier.broadcastTaskStatusChange(persisted);
  }

  return persisted;
}
