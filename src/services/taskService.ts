import { Task } from "../models/Task";
import { IProject } from "../models/Project";
import { IProductSnapshot } from "../models/ProductSnapshot";
import { IRecipeSnapshot } from "../models/RecipeSnapshot";
import mongoose from "mongoose";
import { realtimeService } from "./realtimeService";

/**
 * Generate all first-step tasks for a project when it becomes ACTIVE
 * @param project - The project document
 * @param productSnapshot - Product snapshot (if product-based project)
 * @param recipeSnapshot - Recipe snapshot (if recipe-based project)
 * @returns Array of created tasks
 */
export const generateTasksForProject = async (
  project: IProject,
  productSnapshot?: IProductSnapshot,
  recipeSnapshot?: IRecipeSnapshot
): Promise<any[]> => {
  const createdTasks: any[] = [];

  // Product-based project
  if (productSnapshot) {
    // Process each recipe in the product
    for (const productRecipe of productSnapshot.recipes) {
      // Calculate total executions: targetQuantity × recipe quantity
      const totalExecutions = project.targetQuantity * productRecipe.quantity;

      // Get the recipe snapshot reference
      const recipeSnapshotId = productRecipe.recipeSnapshotId;
      if (!recipeSnapshotId) continue;

      // Fetch the recipe snapshot to get steps
      const RecipeSnapshot = mongoose.model("RecipeSnapshot");
      const recipeSnap = await RecipeSnapshot.findById(recipeSnapshotId);
      if (!recipeSnap) continue;

      // Get all steps and sort them by order
      const steps = (recipeSnap as any).steps.sort(
        (a: any, b: any) => a.order - b.order
      );
      if (steps.length === 0) continue;

      const maxStepOrder = steps[steps.length - 1].order;

      // Create ALL tasks for ALL steps for ALL executions upfront
      for (let execution = 1; execution <= totalExecutions; execution++) {
        let previousTaskId: mongoose.Types.ObjectId | undefined = undefined;

        for (const step of steps) {
          // Validate deviceTypeId exists
          if (!step.deviceTypeId) {
            throw new Error(
              `Step ${step.order} of recipe in product "${productSnapshot.name}" does not have a deviceTypeId`
            );
          }

          const isLastStep = step.order === maxStepOrder;

          const newTask = new Task({
            title: `${step.name} - Exec ${execution}/${totalExecutions} - ${productSnapshot.name}`,
            description: step.description,
            projectId: project._id,
            projectNumber: project.projectNumber, // Denormalize projectNumber from project
            productId: productSnapshot.originalProductId,
            productSnapshotId: productSnapshot._id,
            recipeId: (recipeSnap as any).originalRecipeId,
            recipeSnapshotId: recipeSnapshotId,
            recipeStepId: step._id,
            recipeExecutionNumber: execution,
            totalRecipeExecutions: totalExecutions,
            stepOrder: step.order,
            isLastStepInRecipe: isLastStep,
            deviceTypeId: step.deviceTypeId,
            status: "PENDING",
            priority: project.priority,
            estimatedDuration: step.estimatedDuration,
            deadline: project.deadline, // Inherit deadline from project
            progress: 0,
            pausedDuration: 0,
            dependentTask: previousTaskId // Link to previous step
          });

          await newTask.save();
          createdTasks.push(newTask);
          previousTaskId = newTask._id as mongoose.Types.ObjectId;
        }
      }
    }
  }

  // Recipe-based project
  if (recipeSnapshot) {
    // Total executions = targetQuantity for standalone recipes
    const totalExecutions = project.targetQuantity;

    // Get all steps and sort them by order
    const steps = recipeSnapshot.steps.sort((a, b) => a.order - b.order);
    if (steps.length === 0) {
      throw new Error(
        `Recipe "${recipeSnapshot.name}" does not have any steps`
      );
    }

    const maxStepOrder = steps[steps.length - 1].order;

    // Create ALL tasks for ALL steps for ALL executions upfront
    for (let execution = 1; execution <= totalExecutions; execution++) {
      let previousTaskId: mongoose.Types.ObjectId | undefined = undefined;

      for (const step of steps) {
        // Validate deviceTypeId exists
        if (!step.deviceTypeId) {
          throw new Error(
            `Step ${step.order} of recipe "${recipeSnapshot.name}" does not have a deviceTypeId`
          );
        }

        const isLastStep = step.order === maxStepOrder;

        const newTask = new Task({
          title: `${step.name} - Exec ${execution}/${totalExecutions} - ${project.name}`,
          description: step.description,
          projectId: project._id,
          projectNumber: project.projectNumber, // Denormalize projectNumber from project
          recipeId: recipeSnapshot.originalRecipeId,
          recipeSnapshotId: recipeSnapshot._id,
          recipeStepId: step._id,
          recipeExecutionNumber: execution,
          totalRecipeExecutions: totalExecutions,
          stepOrder: step.order,
          isLastStepInRecipe: isLastStep,
          deviceTypeId: step.deviceTypeId,
          status: "PENDING",
          priority: project.priority,
          estimatedDuration: step.estimatedDuration,
          deadline: project.deadline, // Inherit deadline from project
          progress: 0,
          pausedDuration: 0,
          dependentTask: previousTaskId // Link to previous step
        });

        await newTask.save();
        createdTasks.push(newTask);
        previousTaskId = newTask._id as mongoose.Types.ObjectId;
      }
    }
  }

  // Broadcast task generation to affected device types
  if (createdTasks.length > 0) {
    await realtimeService.broadcastTasksGeneratedForDeviceTypes(
      createdTasks,
      (project._id as mongoose.Types.ObjectId).toString(),
      project.name
    );
  }

  return createdTasks;
};

/**
 * Delete all tasks associated with a project
 * @param projectId - The project ID
 * @returns Number of tasks deleted
 */
export const deleteProjectTasks = async (
  projectId: string | mongoose.Types.ObjectId
): Promise<number> => {
  const result = await Task.deleteMany({ projectId });
  return result.deletedCount || 0;
};

/**
 * Recalculate project progress and producedQuantity after task changes
 * @param projectId - The project ID
 * @returns Updated project document
 */
export const recalculateProjectMetrics = async (
  projectId: string | mongoose.Types.ObjectId
): Promise<any> => {
  const Project = mongoose.model("Project");
  const ProductSnapshot = mongoose.model("ProductSnapshot");
  const project = await Project.findById(projectId);

  if (!project) {
    return null;
  }

  // Get all tasks for this project
  const allProjectTasks = await Task.find({ projectId });
  const totalTasks = allProjectTasks.length;
  const completedTasks = allProjectTasks.filter(
    (t) => t.status === "COMPLETED"
  ).length;

  // Calculate progress: (completed tasks / total tasks) × 100
  const { roundToTwoDecimals } = await import("../utils/helpers");
  project.progress = roundToTwoDecimals(
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  );

  // Recalculate producedQuantity based on completed last-step tasks
  if (project.productSnapshot) {
    // Product project: Calculate based on completed recipe executions
    const productSnapshot = await ProductSnapshot.findById(
      project.productSnapshot
    );
    if (productSnapshot) {
      let minCompletedSets = Infinity;

      for (const recipeRef of productSnapshot.recipes) {
        const recipeSnapshotId = recipeRef.recipeSnapshotId.toString();
        const requiredQuantity = recipeRef.quantity;

        // Count completed last-step tasks for this recipe
        const completedExecutions = await Task.countDocuments({
          projectId: project._id,
          recipeSnapshotId: recipeSnapshotId,
          isLastStepInRecipe: true,
          status: "COMPLETED"
        });

        // Calculate how many complete sets this recipe can produce
        const completedSets = Math.floor(
          completedExecutions / requiredQuantity
        );

        // Track the minimum (bottleneck)
        if (completedSets < minCompletedSets) {
          minCompletedSets = completedSets;
        }
      }

      // Update producedQuantity to the minimum completed sets
      project.producedQuantity =
        minCompletedSets === Infinity ? 0 : minCompletedSets;
    }
  } else if (project.recipeSnapshot) {
    // Standalone recipe project: Count completed last-step tasks
    const completedExecutions = await Task.countDocuments({
      projectId: project._id,
      isLastStepInRecipe: true,
      status: "COMPLETED"
    });
    project.producedQuantity = completedExecutions;
  }

  // Check if project should be marked as COMPLETED
  const allTasksFinished = allProjectTasks.every(
    (t) => t.status === "COMPLETED" || t.status === "FAILED"
  );

  if (allTasksFinished && project.status !== "COMPLETED") {
    project.status = "COMPLETED";
    project.endDate = new Date();
  } else if (!allTasksFinished && project.status === "COMPLETED") {
    // If tasks were deleted and project is no longer complete, revert status
    project.status = "ACTIVE";
    project.endDate = undefined;
  } else if (
    project.producedQuantity >= project.targetQuantity &&
    project.status !== "COMPLETED"
  ) {
    // All required quantity produced
    project.status = "COMPLETED";
    project.progress = 100;
    if (!project.endDate) {
      project.endDate = new Date();
    }
  }

  await project.save();
  return project;
};
