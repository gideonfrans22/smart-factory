import type { AlertDocument } from "../alert.model";
import type { AlertNotifierPort } from "../ports/AlertNotifierPort";
import type { DeviceForAlertPort } from "../ports/DeviceForAlertPort";
import type { AlertRepository } from "../ports/AlertRepository";
import { AlertDomainError } from "./errors";

export interface ResolveAlertDeps {
  repo: AlertRepository;
  device: DeviceForAlertPort;
  notifier: AlertNotifierPort;
}

export async function resolveAlert(
  deps: ResolveAlertDeps,
  input: { id: string; resolvedByUserId?: string }
): Promise<AlertDocument | null> {
  const alert = await deps.repo.findById(input.id);
  if (!alert) {
    return null;
  }

  if (alert.status === "RESOLVED") {
    throw new AlertDomainError({
      statusCode: 400,
      errorCode: "ALREADY_RESOLVED",
      message: "Alert is already resolved"
    });
  }

  alert.status = "RESOLVED";
  alert.resolvedAt = new Date();

  await deps.repo.save(alert);
  await deps.repo.populateAcknowledgedBy(alert);

  if (alert.type === "EQUIPMENT_DEFECT" || alert.type === "TOOL_CHANGE") {
    const deviceId = alert.device?.toString();
    if (deviceId) {
      await deps.device.setOnlineWithHistory({
        deviceId,
        reason: `Alert resolved: ${alert.message}`,
        changedBy: alert.reportedBy?.toString() || "System"
      });
    }
  }

  const alertId =
    (alert._id as { toString(): string })?.toString() ||
    (alert as { id?: string }).id ||
    "";

  deps.notifier.emitAlertResolved({
    alertId,
    resolvedBy: input.resolvedByUserId || "system",
    resolvedAt: alert.resolvedAt!.toISOString(),
    timestamp: Date.now()
  });

  return alert;
}
