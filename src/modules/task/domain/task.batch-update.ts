import type { DeviceRepo } from "../ports/DeviceRepo";
import type { TaskNotifier } from "../ports/TaskNotifier";
import type { TaskBatchUpdateResult, TaskRepo } from "../ports/TaskRepo";
import type { TaskBatchUpdateDTO, TaskUpdateDTO } from "../task.types";
import { TaskDomainError } from "./errors";

export interface BatchUpdateTasksDeps {
  taskRepo: TaskRepo;
  deviceRepo: DeviceRepo;
  notifier: TaskNotifier;
}

/**
 * Maps HTTP batch `updates` to Mongo `$set` fields (legacy rule: raw wall-clock
 * minutes when both `startedAt` and `completedAt` are present in the DTO).
 */
export function buildBatchUpdateFields(
  updates: TaskUpdateDTO
): Record<string, unknown> {
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
  } = updates;

  const updateFields: Record<string, unknown> = {};
  if (status !== undefined) {
    updateFields.status = status;
  }
  if (priority !== undefined) {
    updateFields.priority = priority;
  }
  if (notes !== undefined) {
    updateFields.notes = notes;
  }
  if (mediaFiles !== undefined) {
    updateFields.mediaFiles = mediaFiles;
  }
  if (deviceId !== undefined) {
    updateFields.deviceId = deviceId;
  }
  if (workerId !== undefined) {
    updateFields.workerId = workerId;
  }
  if (pausedDuration !== undefined) {
    updateFields.pausedDuration = pausedDuration;
  }
  if (startedAt !== undefined) {
    updateFields.startedAt = startedAt ? new Date(startedAt) : undefined;
  }
  if (completedAt !== undefined) {
    updateFields.completedAt = completedAt ? new Date(completedAt) : undefined;
  }
  if (progress !== undefined) {
    updateFields.progress = progress;
  }

  if (startedAt && completedAt) {
    updateFields.actualDuration = Math.floor(
      (new Date(completedAt).getTime() - new Date(startedAt).getTime()) /
        60000
    );
  }

  return updateFields;
}

export async function batchUpdateTasks(
  deps: BatchUpdateTasksDeps,
  dto: TaskBatchUpdateDTO
): Promise<TaskBatchUpdateResult> {
  const { taskIds, updates } = dto;

  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "taskIds must be a non-empty array"
    });
  }

  if (!updates || typeof updates !== "object") {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "updates must be an object"
    });
  }

  const ongoingIds = await deps.taskRepo.batchFindOngoingIds(taskIds);
  if (ongoingIds.length > 0) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "일부 선택된 작업이 현재 진행 중입니다, 업데이트 불가!"
    });
  }

  const { status, workerId, deviceId } = updates;

  if (status === "ONGOING") {
    if (!workerId) {
      const n = await deps.taskRepo.countTasksWithoutWorkerId(taskIds);
      if (n > 0) {
        throw new TaskDomainError({
          statusCode: 400,
          errorCode: "VALIDATION_ERROR",
          message:
            "workerId is required to set task status to ONGOING. Some tasks do not have a workerId assigned."
        });
      }
    }
    if (!deviceId) {
      const n = await deps.taskRepo.countTasksWithoutDeviceId(taskIds);
      if (n > 0) {
        throw new TaskDomainError({
          statusCode: 400,
          errorCode: "VALIDATION_ERROR",
          message:
            "deviceId is required to set task status to ONGOING. Some tasks do not have a deviceId assigned."
        });
      }
    }
  }

  const updateFields = buildBatchUpdateFields(updates);
  const outcome = await deps.taskRepo.batchUpdate(taskIds, updateFields);

  if (updates.status !== undefined) {
    for (const task of outcome.updatedTasks) {
      await deps.notifier.broadcastTaskStatusChange(task);
    }
  }

  if (updates.status === "COMPLETED" || updates.status === "FAILED") {
    const deviceIds = await deps.taskRepo.findDeviceIdsForTasks(
      outcome.foundIds
    );
    for (const deviceIdToClear of deviceIds) {
      await deps.deviceRepo.clearCurrentAssignment(deviceIdToClear);
    }
  }

  let message = `Batch update completed. ${outcome.modifiedCount} task(s) updated successfully.`;
  if (outcome.notFoundIds.length > 0) {
    message += ` ${outcome.notFoundIds.length} task(s) not found.`;
  }

  return {
    updated: outcome.updatedTasks,
    summary: {
      totalRequested: taskIds.length,
      found: outcome.foundIds.length,
      updated: outcome.modifiedCount,
      notFound: outcome.notFoundIds
    },
    message
  };
}
