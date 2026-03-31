import type { DeviceRepo } from "../ports/DeviceRepo";
import type { ProjectRepo } from "../ports/ProjectRepo";
import type { TaskNotifier } from "../ports/TaskNotifier";
import type {
  TaskBatchUpdateResult,
  TaskRepo,
  TaskStatusUpdatePersistState,
  TaskStatusUpdateReadModel
} from "../ports/TaskRepo";
import type { TaskBatchUpdateDTO, TaskUpdateDTO } from "../task.types";
import { TaskDomainError } from "./errors";
import { computeActualDurationMinutes } from "./task.duration";

export interface BatchUpdateTasksDeps {
  taskRepo: TaskRepo;
  deviceRepo: DeviceRepo;
  notifier: TaskNotifier;
  projectRepo: ProjectRepo;
}

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

  const { status: updateStatus, userId } = updates;

  const isPauseStatus =
    updateStatus === "PAUSED" || updateStatus === "PAUSED_EMERGENCY";
  const isCompleteStatus = updateStatus === "COMPLETED";

  if (isPauseStatus && !userId) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "userId is required to pause tasks in batch."
    });
  }

  // Generic guard against updating ongoing tasks only applies to non-pause/complete
  // scenarios. For pause/complete, we intentionally target ongoing tasks.
  if (!isPauseStatus && !isCompleteStatus) {
    const ongoingIds = await deps.taskRepo.batchFindOngoingIds(taskIds);
    if (ongoingIds.length > 0) {
      throw new TaskDomainError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "일부 선택된 작업이 현재 진행 중입니다, 업데이트 불가!"
      });
    }
  }

  if (isPauseStatus || isCompleteStatus) {
    const updatedTasks: object[] = [];
    const foundIds: string[] = [];
    const notFoundIds: string[] = [];

    const loadedTasks: Array<TaskStatusUpdateReadModel | null> = [];
    for (const id of taskIds) {
      const task = await deps.taskRepo.loadForStatusUpdate(id);
      if (!task) {
        notFoundIds.push(id);
        loadedTasks.push(null);
      } else {
        foundIds.push(id);
        loadedTasks.push(task);
      }
    }

    if (isPauseStatus) {
      const invalidStatusIds: string[] = [];
      for (let i = 0; i < loadedTasks.length; i++) {
        const task = loadedTasks[i];
        if (!task) continue;
        if (task.status !== "ONGOING") {
          invalidStatusIds.push(task.id);
        }
      }
      if (invalidStatusIds.length > 0) {
        throw new TaskDomainError({
          statusCode: 400,
          errorCode: "VALIDATION_ERROR",
          message:
            "Only ONGOING tasks can be paused in batch. Some selected tasks have invalid status."
        });
      }

      for (const task of loadedTasks) {
        if (!task) continue;

        const pauseEntry = {
          pausedAt: new Date(),
          reason: updates.notes ?? "Manual pause",
          pausedBy: userId as string
        };

        const state: TaskStatusUpdatePersistState = {
          id: task.id,
          status: updateStatus!,
          notes: updates.notes ?? task.notes ?? null,
          startedAt: task.startedAt ?? null,
          completedAt: task.completedAt ?? null,
          progress:
            updates.progress !== undefined ? updates.progress : task.progress ?? null,
          pauseHistory: [...task.pauseHistory, pauseEntry],
          pausedDuration: task.pausedDuration ?? null,
          actualDuration: null
        };

        const persisted = await deps.taskRepo.persistStatusUpdate(state);
        updatedTasks.push(persisted);
        await deps.notifier.broadcastTaskStatusChange(persisted);
      }

      const modifiedCount = updatedTasks.length;
      let message = `Batch update completed. ${modifiedCount} task(s) updated successfully.`;
      if (notFoundIds.length > 0) {
        message += ` ${notFoundIds.length} task(s) not found.`;
      }

      return {
        updated: updatedTasks,
        summary: {
          totalRequested: taskIds.length,
          found: foundIds.length,
          updated: modifiedCount,
          notFound: notFoundIds
        },
        message
      };
    }

    if (isCompleteStatus) {
      const completedProjectIds = new Set<string>();

      for (const task of loadedTasks) {
        if (!task) continue;

        const now = new Date();
        const completedAt =
          updates.completedAt != null ? new Date(updates.completedAt) : now;

        let pauseHistory = [...task.pauseHistory];
        let pausedDuration = task.pausedDuration ?? 0;

        if (pauseHistory.length > 0) {
          const lastPause = pauseHistory[pauseHistory.length - 1];
          if (lastPause && !lastPause.resumedAt) {
            const lastPauseDuration = Math.floor(
              (completedAt.getTime() - new Date(lastPause.pausedAt).getTime()) /
                (1000 * 60)
            );
            pauseHistory = [
              ...pauseHistory.slice(0, -1),
              {
                ...lastPause,
                resumedAt: completedAt,
                resolvedBy: userId ?? "System"
              }
            ];
            pausedDuration = (pausedDuration || 0) + lastPauseDuration;
          }
        }

        let actualDuration: number | null = null;
        if (task.startedAt) {
          actualDuration = computeActualDurationMinutes(
            task.startedAt,
            completedAt,
            pausedDuration || 0
          );
        }

        const state: TaskStatusUpdatePersistState = {
          id: task.id,
          status: "COMPLETED",
          notes: updates.notes ?? task.notes ?? null,
          startedAt: task.startedAt ?? null,
          completedAt,
          progress:
            updates.progress !== undefined ? updates.progress : task.progress ?? null,
          pauseHistory,
          pausedDuration,
          actualDuration
        };

        const persisted = await deps.taskRepo.persistStatusUpdate(state);
        updatedTasks.push(persisted);
        await deps.notifier.broadcastTaskStatusChange(persisted);

        if (task.projectId) {
          completedProjectIds.add(String(task.projectId));
        }
      }

      if (foundIds.length > 0) {
        const deviceIds = await deps.taskRepo.findDeviceIdsForTasks(foundIds);
        for (const deviceIdToClear of deviceIds) {
          await deps.deviceRepo.clearCurrentAssignment(deviceIdToClear);
        }
      }

      // After batch completion, recalculate project progress/metrics for affected projects.
      for (const projectId of completedProjectIds) {
        await deps.projectRepo.applyProjectUpdatesAfterTaskCompletion(
          {
            projectId,
            isLastStepInRecipe: false,
            productId: undefined
          },
          deps.notifier
        );
      }

      const modifiedCount = updatedTasks.length;
      let message = `Batch update completed. ${modifiedCount} task(s) updated successfully.`;
      if (notFoundIds.length > 0) {
        message += ` ${notFoundIds.length} task(s) not found.`;
      }

      return {
        updated: updatedTasks,
        summary: {
          totalRequested: taskIds.length,
          found: foundIds.length,
          updated: modifiedCount,
          notFound: notFoundIds
        },
        message
      };
    }
  }

  const {
    status,
    workerId: ongoingWorkerId,
    deviceId: ongoingDeviceId
  } = updates;

  if (status === "ONGOING") {
    if (!ongoingWorkerId) {
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
    if (!ongoingDeviceId) {
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
