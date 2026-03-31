import { roundToTwoDecimals } from "@shared/helpers";
import type { ProductSnapshotRepo } from "../ports/ProductSnapshotRepo";
import type {
  ProjectMetricsPersistState,
  ProjectRepo
} from "../ports/ProjectRepo";
import type { TaskRepo } from "../ports/TaskRepo";

export interface RecalculateProjectMetricsDeps {
  projectRepo: ProjectRepo;
  taskRepo: TaskRepo;
  productSnapshotRepo: ProductSnapshotRepo;
}

export async function recalculateProjectMetrics(
  deps: RecalculateProjectMetricsDeps,
  projectId: string
): Promise<object | null> {
  const project = await deps.projectRepo.loadForMetrics(projectId);
  if (!project) {
    return null;
  }

  const allProjectTasks = await deps.taskRepo.listByProjectIdForMetrics(projectId);
  const totalTasks = allProjectTasks.length;
  const completedTasks = allProjectTasks.filter(
    (t) => t.status === "COMPLETED"
  ).length;

  const progress = roundToTwoDecimals(
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  );

  let producedQuantity = project.producedQuantity ?? 0;

  if (project.productSnapshotId) {
    const productSnapshot = await deps.productSnapshotRepo.findById(
      project.productSnapshotId
    );
    if (productSnapshot) {
      let minCompletedSets = Infinity;
      for (const recipeRef of productSnapshot.recipes) {
        const recipeSnapshotId = recipeRef.recipeSnapshotId.toString();
        const requiredQuantity = recipeRef.quantity;

        const completedExecutions =
          await deps.taskRepo.countCompletedLastStepsByRecipeSnapshot(
            projectId,
            recipeSnapshotId
          );
        const completedSets = Math.floor(
          completedExecutions / (requiredQuantity || 1)
        );
        if (completedSets < minCompletedSets) {
          minCompletedSets = completedSets;
        }
      }
      producedQuantity = minCompletedSets === Infinity ? 0 : minCompletedSets;
    }
  } else if (project.recipeSnapshotId) {
    const completedExecutions = await deps.taskRepo.countCompletedLastSteps(projectId);
    producedQuantity = completedExecutions;
  }

  const allTasksFinished = allProjectTasks.every(
    (t) => t.status === "COMPLETED" || t.status === "FAILED"
  );

  let status = project.status;
  let endDate: Date | null | undefined = undefined;

  if (allTasksFinished && project.status !== "COMPLETED") {
    status = "COMPLETED";
    endDate = new Date();
  } else if (!allTasksFinished && project.status === "COMPLETED") {
    status = "ACTIVE";
    endDate = null;
  } else if (producedQuantity >= project.targetQuantity && project.status !== "COMPLETED") {
    status = "COMPLETED";
    endDate = project.status === "COMPLETED" ? undefined : new Date();
  }

  const persistState: ProjectMetricsPersistState = {
    id: project.id,
    status,
    progress: status === "COMPLETED" ? 100 : progress,
    producedQuantity,
    ...(endDate !== undefined ? { endDate } : {})
  };

  return await deps.projectRepo.persistMetrics(persistState);
}

