import type { TaskNotifier } from "../ports/TaskNotifier";
import type {
  TaskPauseState,
  TaskPersisted,
  TaskRepo
} from "../ports/TaskRepo";
import type { TaskStatus } from "../task.types";
import { TaskDomainError } from "./errors";

export interface PauseTaskDeps {
  taskRepo: TaskRepo;
  notifier: TaskNotifier;
}

export interface PauseTaskInput {
  taskId: string;
  reason?: string;
  notes?: string;
  reportedBy?: string;
  isEmergency?: boolean;
  userName?: string;
}

export async function pauseTask(
  deps: PauseTaskDeps,
  input: PauseTaskInput
): Promise<TaskPersisted> {
  const task = await deps.taskRepo.loadForPause(input.taskId);
  if (!task) {
    throw new TaskDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Task not found"
    });
  }
  if (task.status !== "ONGOING") {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: `Cannot pause task with status ${task.status}. Only ONGOING tasks can be paused.`
    });
  }

  const isEmergency = input.isEmergency ?? false;
  const status: TaskStatus = isEmergency ? "PAUSED_EMERGENCY" : "PAUSED";
  const pauseReason =
    input.reason ??
    input.notes ??
    (isEmergency ? "Emergency pause" : "Manual pause");

  const newEntry = {
    pausedAt: new Date(),
    reason: pauseReason,
    pausedBy: input.reportedBy ?? input.userName ?? "System"
  };

  const updatedState: TaskPauseState = {
    id: task.id,
    status,
    pauseHistory: [...task.pauseHistory, newEntry]
  };

  const persisted = await deps.taskRepo.persistPause(updatedState);
  await deps.notifier.broadcastTaskStatusChange(persisted);
  return persisted;
}
