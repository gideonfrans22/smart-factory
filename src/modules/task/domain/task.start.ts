import type { DeviceRepo } from "../ports/DeviceRepo";
import type { TaskNotifier } from "../ports/TaskNotifier";
import type {
  TaskPersisted,
  TaskRepo,
  TaskStartPersistState
} from "../ports/TaskRepo";
import { TaskDomainError } from "./errors";

export interface StartTaskDeps {
  taskRepo: TaskRepo;
  deviceRepo: DeviceRepo;
  notifier: TaskNotifier;
}

export interface StartTaskInput {
  taskId: string;
  workerId?: string;
  deviceId?: string;
}

export async function startTask(
  deps: StartTaskDeps,
  input: StartTaskInput
): Promise<TaskPersisted> {
  const task = await deps.taskRepo.loadForStart(input.taskId);
  if (!task) {
    throw new TaskDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Task not found"
    });
  }
  if (task.status !== "PENDING") {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: `Task is already ${String(
        task.status
      ).toLowerCase()}. Only PENDING tasks can be started.`
    });
  }
  if (!input.workerId) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: "workerId is required to start a task"
    });
  }

  if (input.deviceId) {
    await deps.deviceRepo.assignCurrentTask({
      deviceId: input.deviceId,
      taskId: task.id,
      workerId: input.workerId
    });
  }

  const progress =
    task.progress === undefined || task.progress === null ? 0 : task.progress;

  const state: TaskStartPersistState = {
    id: task.id,
    workerId: input.workerId,
    deviceId: input.deviceId,
    startedAt: new Date(),
    progress
  };

  const persisted = await deps.taskRepo.persistStart(state);
  await deps.notifier.broadcastTaskStatusChange(persisted);
  return persisted;
}
