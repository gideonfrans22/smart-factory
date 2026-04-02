import type { AlertDocument } from "../alert.model";
import type { AlertRepository } from "../ports/AlertRepository";

export interface DeleteAlertDeps {
  repo: AlertRepository;
}

export async function deleteAlert(
  deps: DeleteAlertDeps,
  input: { id: string }
): Promise<AlertDocument | null> {
  return deps.repo.deleteById(input.id);
}
