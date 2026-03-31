import type { AlertRepo } from "../ports/AlertRepo";
import type { DeviceRepo } from "../ports/DeviceRepo";
import type { TaskNotifier } from "../ports/TaskNotifier";
import type { TaskPersisted, TaskRepo, TaskResumePersistState } from "../ports/TaskRepo";
import type { TaskStatus } from "../task.types";
import { TaskDomainError } from "./errors";

export interface ResumeTaskDeps {
  taskRepo: TaskRepo;
  deviceRepo: DeviceRepo;
  alertRepo: AlertRepo;
  notifier: TaskNotifier;
}

export interface ResumeTaskInput {
  taskId: string;
  resolvedBy?: string;
  userName?: string;
}

export async function resumeTask(
  deps: ResumeTaskDeps,
  input: ResumeTaskInput
): Promise<TaskPersisted> {
  const task = await deps.taskRepo.loadForResume(input.taskId);
  if (!task) {
    throw new TaskDomainError({
      statusCode: 404,
      errorCode: "NOT_FOUND",
      message: "Task not found"
    });
  }
  if (
    !["PAUSED", "PAUSED_EMERGENCY", "COMPLETED", "FAILED"].includes(task.status)
  ) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message: `Cannot resume task with status ${task.status}. Only PAUSED, PAUSED_EMERGENCY, COMPLETED (partial), or FAILED tasks can be resumed.`
    });
  }
  if (task.status === "COMPLETED" && (task.progress ?? 0) >= 100) {
    throw new TaskDomainError({
      statusCode: 400,
      errorCode: "VALIDATION_ERROR",
      message:
        "Cannot resume a fully completed task (progress = 100%). Create a new task instead."
    });
  }

  if (task.deviceId) {
    const unresolvedAlerts =
      await deps.alertRepo.countUnresolvedCriticalHighOnDevice(task.deviceId);
    if (unresolvedAlerts > 0) {
      throw new TaskDomainError({
        statusCode: 409,
        errorCode: "UNRESOLVED_ALERT",
        message:
          "미해결 알림이 있어 작업을 재개할 수 없습니다. 관리자의 확인이 필요합니다. (Unresolved alerts exist for this device. Admin must acknowledge or resolve the alert before resuming.)"
      });
    }
    const device = await deps.deviceRepo.findForResumeCheck(task.deviceId);
    if (device && ["MAINTENANCE", "ERROR"].includes(device.status)) {
      throw new TaskDomainError({
        statusCode: 409,
        errorCode: "DEVICE_NOT_AVAILABLE",
        message: `장비가 현재 ${
          device.status === "MAINTENANCE" ? "점검중" : "에러"
        } 상태입니다. 관리자의 조치 후 재개 가능합니다. (Device is currently in ${
          device.status
        } state. Admin must resolve before resuming.)`
      });
    }
  }

  const resolvedBy = input.resolvedBy ?? "System";
  const pauseHistory = [...task.pauseHistory];
  let pausedDuration = task.pausedDuration;

  if (pauseHistory.length > 0) {
    const lastPause = pauseHistory[pauseHistory.length - 1];
    if (!lastPause.resumedAt) {
      const resumedAt = new Date();
      lastPause.resumedAt = resumedAt;
      lastPause.resolvedBy = resolvedBy || input.userName || "Admin";
      const pauseDuration = Math.floor(
        (resumedAt.getTime() - lastPause.pausedAt.getTime()) / (1000 * 60)
      );
      pausedDuration = (task.pausedDuration || 0) + pauseDuration;
    }
  }

  const status: TaskStatus = "ONGOING";
  const state: TaskResumePersistState = {
    id: task.id,
    status,
    pauseHistory,
    pausedDuration
  };

  const persisted = await deps.taskRepo.persistResume(state);
  await deps.notifier.broadcastTaskStatusChange(persisted);
  return persisted;
}
