import type { AlertDocument } from "../alert.model";
import type { AlertResolveEmergencyDTO } from "../alert.types";
import type { AlertNotifierPort } from "../ports/AlertNotifierPort";
import type { DeviceForAlertPort } from "../ports/DeviceForAlertPort";
import type { AlertRepository } from "../ports/AlertRepository";
import type { TaskForAlertPort } from "../ports/TaskForAlertPort";
import { AlertDomainError } from "./errors";

export interface ResolveEmergencyDeps {
  repo: AlertRepository;
  task: TaskForAlertPort;
  device: DeviceForAlertPort;
  notifier: AlertNotifierPort;
}

export async function resolveEmergencyAlert(
  deps: ResolveEmergencyDeps,
  input: {
    id: string;
    body: AlertResolveEmergencyDTO;
    resolvedByName?: string;
  }
): Promise<{ alert: AlertDocument; actionsPerformed: Record<string, unknown> } | null> {
  const { resolvedBy, resolutionNotes } = input.body;

  const alert = await deps.repo.findByIdWithEmergencyPopulate(input.id);
  if (!alert) {
    return null;
  }

  if (alert.level !== "CRITICAL") {
    throw new AlertDomainError({
      statusCode: 400,
      errorCode: "INVALID_TYPE",
      message:
        "Only CRITICAL level alerts can be resolved with this endpoint"
    });
  }

  const actionsPerformed: Record<string, unknown> = {};

  alert.status = "RESOLVED";
  alert.resolvedAt = new Date();
  alert.metadata = {
    ...alert.metadata,
    resolvedBy,
    resolutionNotes,
    resolvedAt: new Date()
  };
  await deps.repo.save(alert);
  actionsPerformed.alertResolved = true;

  const resolvedByEffective =
    resolvedBy || input.resolvedByName || "Admin";

  if (alert.device) {
    const deviceId =
      typeof alert.device === "object"
        ? String((alert.device as { _id?: unknown })._id)
        : String(alert.device);

    const previousStatus =
      (alert.metadata as { emergencyActions?: { previousDeviceStatus?: string } })
        ?.emergencyActions?.previousDeviceStatus || "ONLINE";

    const restored = await deps.device.restoreFromEmergencyMaintenance({
      deviceId,
      previousStatus,
      reason: `Emergency resolved: ${resolutionNotes || "Issue fixed"}`,
      changedBy: resolvedByEffective
    });

    if (restored) {
      actionsPerformed.equipmentRestored = restored.displayName;
    }
  }

  if (alert.task) {
    const taskId =
      typeof alert.task === "object"
        ? String((alert.task as { _id?: unknown })._id)
        : String(alert.task);

    const resumed = await deps.task.resumeFromEmergency({
      taskId,
      resolvedBy: resolvedByEffective
    });

    if (resumed) {
      actionsPerformed.taskResumed = resumed.taskLabel;
    }
  }

  await deps.notifier.broadcastAlert(alert.toObject() as Record<string, unknown>);

  return {
    alert,
    actionsPerformed
  };
}
