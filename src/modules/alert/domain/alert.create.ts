import type { AlertCreateDTO } from "../alert.types";
import type { AlertDocument } from "../alert.model";
import type { AlertNotifierPort } from "../ports/AlertNotifierPort";
import type { DeviceForAlertPort } from "../ports/DeviceForAlertPort";
import type { AlertRepository } from "../ports/AlertRepository";
import type { TaskForAlertPort } from "../ports/TaskForAlertPort";

export interface CreateAlertDeps {
  repo: AlertRepository;
  task: TaskForAlertPort;
  device: DeviceForAlertPort;
  notifier: AlertNotifierPort;
}

export async function createAlert(
  deps: CreateAlertDeps,
  input: {
    data: AlertCreateDTO & { metadata?: Record<string, unknown> };
    modifiedBy?: string;
  }
): Promise<{ alert: AlertDocument; emergencyActions?: Record<string, unknown> }> {
  const {
    type,
    level,
    title,
    message,
    source,
    relatedEntityType,
    relatedEntityId,
    deviceId,
    taskId,
    projectId,
    reportedBy,
    metadata,
    status
  } = input.data;

  let device = deviceId;
  let task = taskId;
  let project = projectId;
  if (relatedEntityType === "DEVICE") {
    device = relatedEntityId;
  } else if (relatedEntityType === "TASK") {
    task = relatedEntityId;
  } else if (relatedEntityType === "PROJECT") {
    project = relatedEntityId;
  }

  const emergencyActions: Record<string, unknown> = {};
  const meta = metadata ?? {};
  const pausedBy =
    (meta.workerName as string | undefined) ||
    (meta.reportedBy as string | undefined) ||
    "System";

  if (level === "CRITICAL" || level === "HIGH") {
    if (taskId) {
      const paused = await deps.task.pauseOngoingForEmergency({
        taskId,
        title,
        pausedBy
      });
      if (paused) {
        emergencyActions.taskPaused = taskId;
      }
    }

    if (deviceId) {
      const maint = await deps.device.setMaintenanceIfNotAlready({
        deviceId,
        errorReasonTitle: title,
        changedBy: pausedBy
      });
      if (maint) {
        emergencyActions.deviceSetToMaintenance = deviceId;
        emergencyActions.previousDeviceStatus = maint.previousStatus;
      }
    }
  }

  const alert = await deps.repo.insertNew({
    type,
    level,
    title,
    message,
    source,
    relatedEntityType,
    relatedEntityId,
    device,
    task,
    project,
    reportedBy,
    metadata: {
      ...meta,
      emergencyActions:
        Object.keys(emergencyActions).length > 0 ? emergencyActions : undefined
    },
    status: status ?? "UNREAD",
    modifiedBy: input.modifiedBy
  });

  await deps.notifier.broadcastAlert(alert.toObject() as Record<string, unknown>);

  return {
    alert,
    emergencyActions:
      Object.keys(emergencyActions).length > 0 ? emergencyActions : undefined
  };
}
