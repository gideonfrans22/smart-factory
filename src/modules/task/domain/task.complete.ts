import type { DeviceRepo } from "../ports/DeviceRepo";
import type { ProjectRepo } from "../ports/ProjectRepo";
import type { TaskNotifier } from "../ports/TaskNotifier";
import type {
  TaskCompletePersistState,
  TaskPersisted,
  TaskRepo
} from "../ports/TaskRepo";
import type { TaskCompleteBody } from "../task.types";
import { TaskDomainError } from "./errors";
import { computeActualDurationMinutes } from "./task.duration";

export interface CompleteTaskDeps {
  taskRepo: TaskRepo;
  deviceRepo: DeviceRepo;
  projectRepo: ProjectRepo;
  notifier: TaskNotifier;
}

export interface CompleteTaskInput {
  taskId: string;
  body: TaskCompleteBody;
  userName?: string;
}

export interface CompleteTaskResult {
  message: string;
  data: Record<string, unknown>;
}

export async function completeTask(
  deps: CompleteTaskDeps,
  input: CompleteTaskInput
): Promise<CompleteTaskResult> {
  const { workerId, notes, qualityData, actualDuration } = input.body;
  const task = await deps.taskRepo.loadForComplete(input.taskId);
  if (!task) {
    throw new TaskDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Task not found"
    });
  }
  if (!workerId && !task.workerId) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "workerId is required to complete a task"
    });
  }
  if (!task.recipeSnapshotId) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "Task does not have a recipe snapshot reference"
    });
  }

  const completionProgress =
    (qualityData as { progress?: number } | undefined)?.progress ?? 100;

  const completedAt = new Date();

  let pauseHistory = [...task.pauseHistory];
  let pausedDuration = task.pausedDuration;
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
          resolvedBy: input.userName || "System"
        }
      ];
      pausedDuration = (pausedDuration || 0) + lastPauseDuration;
    }
  }

  let resolvedActualDuration = actualDuration ?? null;
  if (
    resolvedActualDuration == null &&
    task.startedAt &&
    completedAt
  ) {
    resolvedActualDuration = computeActualDurationMinutes(
      task.startedAt,
      completedAt,
      pausedDuration || 0
    );
  }

  const resolvedWorkerId = workerId
    ? String(workerId)
    : task.workerId ?? null;

  const persistState: TaskCompletePersistState = {
    id: task.id,
    status: "COMPLETED",
    workerId: resolvedWorkerId,
    completedAt,
    progress: completionProgress,
    ...(notes !== undefined ? { notes } : {}),
    ...(qualityData !== undefined ? { qualityData } : {}),
    actualDuration: resolvedActualDuration,
    pausedDuration,
    pauseHistory
  };

  await deps.taskRepo.persistComplete(persistState);

  if (task.deviceId) {
    await deps.deviceRepo.clearCurrentAssignment(task.deviceId);
  }

  let project: TaskPersisted | null = null;

  if (task.projectId) {
    const early = await deps.projectRepo.completeProjectEarlyWhenAllTasksDone(
      task.projectId
    );
    if (early) {
      await deps.notifier.broadcastProjectUpdate(early);
    }
  }

  const nextTask = await deps.taskRepo.findNextByDependentTask(input.taskId);

  if (task.projectId) {
    project = await deps.projectRepo.applyProjectUpdatesAfterTaskCompletion(
      {
        projectId: task.projectId,
        isLastStepInRecipe: task.isLastStepInRecipe,
        productId: task.productId
      },
      deps.notifier
    );
  }

  const populatedTask = await deps.taskRepo.populateTaskForCompleteResponse(
    input.taskId
  );

  await deps.notifier.broadcastTaskCompletion(
    populatedTask,
    nextTask,
    (project as { progress?: number } | undefined)?.progress
  );

  if (nextTask) {
    await deps.notifier.broadcastTaskStatusChange(nextTask);
  }

  const responseData: Record<string, unknown> = {
    completedTask: populatedTask,
    nextTask: nextTask || null,
    isLastStep: task.isLastStepInRecipe,
    executionInfo: {
      executionNumber: task.recipeExecutionNumber,
      totalExecutions: task.totalRecipeExecutions,
      isLastStepInRecipe: task.isLastStepInRecipe
    }
  };

  if (task.projectId && project) {
    responseData.project = {
      _id: (project as { _id?: unknown })._id,
      progress: (project as { progress?: unknown }).progress
    };
    await deps.notifier.broadcastProjectUpdate(project);
  }

  const message = nextTask
    ? `Task completed. Next step ready for execution ${task.recipeExecutionNumber}.`
    : task.isLastStepInRecipe
    ? `Recipe execution ${task.recipeExecutionNumber}/${task.totalRecipeExecutions} completed!`
    : "Task completed";

  await deps.notifier.broadcastTaskStatusChange(populatedTask);

  return { message, data: responseData };
}
