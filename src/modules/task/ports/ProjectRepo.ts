import type { TaskNotifier } from "./TaskNotifier";

/** Opaque project document for realtime/broadcast (mongoose doc or plain object). */
export type ProjectPersisted = object;

export interface ProjectRepo {
  /**
   * After a task fail cascade: loads the project; if not already COMPLETED and every task is
   * COMPLETED or FAILED, marks COMPLETED with endDate, saves, and broadcasts. Returns the project
   * document for the API response when found (matches legacy failTask).
   */
  resolveProjectAfterFail(
    projectId: string,
    notifier: TaskNotifier
  ): Promise<ProjectPersisted | null>;

  /**
   * Task completion early path: if every task is COMPLETED or FAILED and project is not already COMPLETED,
   * marks project COMPLETED (no endDate) and saves — matches legacy completeTask behavior.
   */
  completeProjectEarlyWhenAllTasksDone(
    projectId: string
  ): Promise<ProjectPersisted | null>;

  /**
   * Recalculates progress, produced quantity, and completion status after a task completes.
   * Matches legacy ordering: progress log + progress broadcast, then metrics, save, project update broadcast.
   */
  applyProjectUpdatesAfterTaskCompletion(
    ctx: {
      projectId: string;
      isLastStepInRecipe: boolean;
      productId?: string | null;
    },
    notifier: TaskNotifier
  ): Promise<ProjectPersisted | null>;
}
