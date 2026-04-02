import type { AlertDocument } from "../alert.model";
import type { AlertRepository } from "../ports/AlertRepository";
import { AlertDomainError } from "./errors";

export interface MarkReadAlertDeps {
  repo: AlertRepository;
}

export async function markReadAlert(
  deps: MarkReadAlertDeps,
  input: { id: string }
): Promise<AlertDocument | null> {
  const alert = await deps.repo.findById(input.id);
  if (!alert) {
    return null;
  }

  if (alert.status === "RESOLVED") {
    throw new AlertDomainError({
      statusCode: 400,
      errorCode: "ALREADY_RESOLVED",
      message: "Cannot mark resolved alert as read"
    });
  }

  alert.status = "READ";
  if (!alert.acknowledgedAt) {
    alert.acknowledgedAt = new Date();
  }

  await deps.repo.save(alert);
  await deps.repo.populateAcknowledgedBy(alert);

  return alert;
}
