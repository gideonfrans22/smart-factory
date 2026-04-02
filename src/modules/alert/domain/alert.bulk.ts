import type { AlertBulkIdsDTO, BulkResult } from "../alert.types";
import type { AlertNotifierPort } from "../ports/AlertNotifierPort";
import type { DeviceForAlertPort } from "../ports/DeviceForAlertPort";
import type { AlertRepository } from "../ports/AlertRepository";

export interface BulkAlertDeps {
  repo: AlertRepository;
  device: DeviceForAlertPort;
  notifier: AlertNotifierPort;
}

export async function bulkReadAlerts(
  deps: Pick<BulkAlertDeps, "repo">,
  body: AlertBulkIdsDTO
): Promise<BulkResult> {
  return deps.repo.bulkRead(body);
}

export async function bulkAcknowledgeAlerts(
  deps: Pick<BulkAlertDeps, "repo">,
  body: AlertBulkIdsDTO,
  userId?: string
): Promise<BulkResult> {
  return deps.repo.bulkAcknowledge(body.alertIds, userId);
}

export async function bulkResolveAlerts(
  deps: BulkAlertDeps,
  body: AlertBulkIdsDTO,
  resolvedByUserId?: string
): Promise<BulkResult> {
  const { alertIds } = body;

  const unresolvedEquipmentErrors =
    await deps.repo.findUnresolvedMachineErrorAlerts(alertIds);

  const result = await deps.repo.bulkMarkResolved(alertIds);

  for (const row of unresolvedEquipmentErrors) {
    const deviceId = row.device?.toString();
    if (deviceId) {
      await deps.device.setOnlineWithHistory({
        deviceId,
        reason: `Machine error resolved: ${row.message}`,
        changedBy: row.reportedBy?.toString() || "System"
      });
    }
  }

  deps.notifier.emitAlertBulkResolved({
    alertIds,
    resolvedBy: resolvedByUserId || "system",
    resolvedAt: new Date().toISOString(),
    count: result.modifiedCount,
    timestamp: Date.now()
  });

  return result;
}
