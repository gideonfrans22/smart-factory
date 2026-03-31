import { roundToTwoDecimals } from "@shared/helpers";
import { ProductSnapshot, Project } from "@shared/models";
import { loggerService } from "@shared/services";
import mongoose from "mongoose";
import { Task } from "../../task.model";
import type {
  ProjectMetricsPersistState,
  ProjectMetricsReadModel,
  ProjectPersisted,
  ProjectRepo
} from "../../ports/ProjectRepo";
import type { TaskNotifier } from "../../ports/TaskNotifier";

export class MongoProjectRepository implements ProjectRepo {
  async loadForMetrics(projectId: string): Promise<ProjectMetricsReadModel | null> {
    const project = await Project.findById(projectId)
      .select({
        status: 1,
        progress: 1,
        producedQuantity: 1,
        targetQuantity: 1,
        productSnapshot: 1,
        recipeSnapshot: 1,
        name: 1,
        endDate: 1
      })
      .lean();
    if (!project) {
      return null;
    }
    return {
      id: String((project as { _id: unknown })._id),
      status: String((project as { status: unknown }).status),
      progress: (project as { progress?: number | null }).progress ?? null,
      producedQuantity: (project as { producedQuantity?: number }).producedQuantity ?? 0,
      targetQuantity: (project as { targetQuantity?: number }).targetQuantity ?? 0,
      productSnapshotId:
        (project as { productSnapshot?: unknown }).productSnapshot == null
          ? null
          : String((project as { productSnapshot: unknown }).productSnapshot),
      recipeSnapshotId:
        (project as { recipeSnapshot?: unknown }).recipeSnapshot == null
          ? null
          : String((project as { recipeSnapshot: unknown }).recipeSnapshot),
      name: String((project as { name?: unknown }).name ?? "")
    };
  }

  async persistMetrics(state: ProjectMetricsPersistState): Promise<ProjectPersisted> {
    const project = await Project.findById(state.id);
    if (!project) {
      throw new Error("Project disappeared during metrics recalculation");
    }
    project.progress = state.progress;
    project.producedQuantity = state.producedQuantity;
    project.status = state.status as any;
    if (state.endDate !== undefined) {
      project.endDate = state.endDate ?? undefined;
    }
    await project.save();
    return project as ProjectPersisted;
  }

  async resolveProjectAfterFail(
    projectId: string,
    notifier: TaskNotifier
  ): Promise<ProjectPersisted | null> {
    const project = await Project.findById(projectId);
    if (!project) {
      return null;
    }
    if (project.status !== "COMPLETED") {
      const projectTasks = await Task.find({ projectId });
      const allTasksFinished = projectTasks.every(
        (t) => t.status === "COMPLETED" || t.status === "FAILED"
      );
      if (allTasksFinished) {
        project.status = "COMPLETED";
        project.endDate = new Date();
        await project.save();
        await notifier.broadcastProjectUpdate(project);
      }
    }
    return project as ProjectPersisted;
  }

  async completeProjectEarlyWhenAllTasksDone(
    projectId: string
  ): Promise<ProjectPersisted | null> {
    const projectTasks = await Task.find({ projectId });
    const allTasksFinishedEarly = projectTasks.every(
      (t) => t.status === "COMPLETED" || t.status === "FAILED"
    );
    if (!allTasksFinishedEarly) {
      return null;
    }
    const project = await Project.findById(projectId);
    if (!project || project.status === "COMPLETED") {
      return null;
    }
    project.status = "COMPLETED";
    await project.save();
    return project as ProjectPersisted;
  }

  async applyProjectUpdatesAfterTaskCompletion(
    ctx: {
      projectId: string;
      isLastStepInRecipe: boolean;
      productId?: string | null;
      recipeSnapshotId?: string | null;
    },
    notifier: TaskNotifier
  ): Promise<ProjectPersisted | null> {
    const project = await Project.findById(ctx.projectId);
    if (!project) {
      return null;
    }
    const projectOid = new mongoose.Types.ObjectId(ctx.projectId);
    const allProjectTasks = await Task.find({ projectId: projectOid });
    const totalTasks = allProjectTasks.length;
    const completedTasks = allProjectTasks.filter(
      (t) => t.status === "COMPLETED"
    ).length;

    project.progress = roundToTwoDecimals(
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    );

    loggerService.info(`📊 Project Progress Updated:`, {
      projectId: project._id,
      projectName: project.name,
      completedTasks,
      totalTasks,
      progress: project.progress,
      producedQuantity: project.producedQuantity,
      targetQuantity: project.targetQuantity
    });

    await notifier.broadcastProjectProgress(project);

    if (ctx.isLastStepInRecipe) {
      if (ctx.productId) {
        const productSnapshot = await ProductSnapshot.findById(
          project.productSnapshot
        );
        if (productSnapshot) {
          let minCompletedSets = Infinity;
          for (const recipeRef of productSnapshot.recipes) {
            const recipeSnapshotId = recipeRef.recipeSnapshotId.toString();
            const requiredQuantity = recipeRef.quantity;
            const completedExecutions = await Task.countDocuments({
              projectId: projectOid,
              recipeSnapshotId: recipeSnapshotId,
              isLastStepInRecipe: true,
              status: "COMPLETED"
            });
            const completedSets = Math.floor(
              completedExecutions / requiredQuantity
            );
            if (completedSets < minCompletedSets) {
              minCompletedSets = completedSets;
            }
          }
          project.producedQuantity =
            minCompletedSets === Infinity ? 0 : minCompletedSets;
        }
      } else {
        project.producedQuantity += 1;
      }
    }

    const allTasksFinished = allProjectTasks.every(
      (t) => t.status === "COMPLETED" || t.status === "FAILED"
    );

    if (allTasksFinished) {
      project.status = "COMPLETED";
      project.endDate = new Date();
    } else if (project.producedQuantity >= project.targetQuantity) {
      project.status = "COMPLETED";
      project.progress = 100;
    }

    await project.save();
    await notifier.broadcastProjectUpdate(project);
    return project as ProjectPersisted;
  }
}

export const mongoProjectRepository = new MongoProjectRepository();
