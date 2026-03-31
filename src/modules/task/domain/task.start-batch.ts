import type { DeviceRepo } from "../ports/DeviceRepo";
import type { TaskNotifier } from "../ports/TaskNotifier";
import type {
  TaskPersisted,
  TaskRepo,
  TaskStartPersistState
} from "../ports/TaskRepo";
import { TaskDomainError } from "./errors";

export interface StartTasksBatchDeps {
  taskRepo: TaskRepo;
  deviceRepo: DeviceRepo;
  notifier: TaskNotifier;
}

export interface StartTasksBatchInput {
  projectId: string;
  recipeSnapshotId: string;
  stepOrder: number;
  limit: number;
  workerId: string;
  deviceId?: string;
}

export async function startTasksBatch(
  deps: StartTasksBatchDeps,
  input: StartTasksBatchInput
): Promise<{ tasks: TaskPersisted[] }> {
  if (!input.workerId) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "workerId is required to start tasks"
    });
  }

  const candidates = await deps.taskRepo.findPendingForStartBatch(
    input.projectId,
    input.recipeSnapshotId,
    input.stepOrder,
    input.limit
  );

  if (candidates.length === 0) {
    throw new TaskDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "No pending tasks found for given filter"
    });
  }

  const nonPending = candidates.filter((t) => t.status !== "PENDING");
  if (nonPending.length > 0) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "All tasks must be PENDING to start"
    });
  }

  const now = new Date();
  const states: TaskStartPersistState[] = candidates.map((task) => ({
    id: task.id,
    workerId: input.workerId,
    deviceId: input.deviceId,
    startedAt: now,
    progress:
      task.progress === undefined || task.progress === null ? 0 : task.progress
  }));

  if (input.deviceId) {
    for (const state of states) {
      await deps.deviceRepo.assignCurrentTask({
        deviceId: input.deviceId,
        taskId: state.id,
        workerId: input.workerId
      });
    }
  }

  const persisted = await deps.taskRepo.persistStartMany(states);
  for (const task of persisted) {
    await deps.notifier.broadcastTaskStatusChange(task);
  }

  return { tasks: persisted };
}

