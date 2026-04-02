import type { AlertDocument } from "../alert.model";
import type { AlertNotifierPort } from "../ports/AlertNotifierPort";
import type { AlertRepository } from "../ports/AlertRepository";
import { AlertDomainError } from "./errors";

export interface AcknowledgeAlertDeps {
  repo: AlertRepository;
  notifier: AlertNotifierPort;
}

export async function acknowledgeAlert(
  deps: AcknowledgeAlertDeps,
  input: { id: string; userId?: string }
): Promise<AlertDocument | null> {
  const alert = await deps.repo.findById(input.id);
  if (!alert) {
    return null;
  }

  if (alert.status === "RESOLVED") {
    throw new AlertDomainError({
      statusCode: 400,
      errorCode: "ALREADY_RESOLVED",
      message: "Cannot acknowledge resolved alert"
    });
  }

  alert.status = "ACKNOWLEDGED";
  if (input.userId) {
    (alert as { acknowledgedBy?: unknown }).acknowledgedBy = input.userId;
  }
  alert.acknowledgedAt = new Date();

  await deps.repo.save(alert);
  await deps.repo.populateAcknowledgedBy(alert);

  const alertId =
    (alert._id as { toString(): string })?.toString() ||
    (alert as { id?: string }).id ||
    "";

  deps.notifier.emitAlertAcknowledged({
    alertId,
    acknowledgedBy: input.userId?.toString() || "system",
    acknowledgedAt: alert.acknowledgedAt!.toISOString(),
    timestamp: Date.now()
  });

  return alert;
}
