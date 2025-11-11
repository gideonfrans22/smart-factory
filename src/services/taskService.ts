import { Task } from "../models/Task";
import { IProject } from "../models/Project";
import { IProductSnapshot } from "../models/ProductSnapshot";
import { IRecipeSnapshot } from "../models/RecipeSnapshot";
import mongoose from "mongoose";

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

      // Find the first step (order = 1)
      const firstStep = (recipeSnap as any).steps.find(
        (step: any) => step.order === 1
      );

      if (!firstStep) continue;

      // Validate deviceTypeId exists
      if (!firstStep.deviceTypeId) {
        throw new Error(
          `First step of recipe in product "${productSnapshot.name}" does not have a deviceTypeId`
        );
      }

      // Determine if this is the last step
      const maxStepOrder = Math.max(
        ...(recipeSnap as any).steps.map((s: any) => s.order)
      );
      const isLastStep = firstStep.order === maxStepOrder;

      // Create ALL first-step tasks for ALL executions upfront
      for (let execution = 1; execution <= totalExecutions; execution++) {
        const newTask = new Task({
          title: `${firstStep.name} - Exec ${execution}/${totalExecutions} - ${productSnapshot.name}`,
          description: firstStep.description,
          projectId: project._id,
          productId: productSnapshot.originalProductId,
          productSnapshotId: productSnapshot._id,
          recipeId: (recipeSnap as any).originalRecipeId,
          recipeSnapshotId: recipeSnapshotId,
          recipeStepId: firstStep._id,
          recipeExecutionNumber: execution,
          totalRecipeExecutions: totalExecutions,
          stepOrder: firstStep.order,
          isLastStepInRecipe: isLastStep,
          deviceTypeId: firstStep.deviceTypeId,
          status: "PENDING",
          priority: project.priority,
          estimatedDuration: firstStep.estimatedDuration,
          progress: 0,
          pausedDuration: 0
        });

        await newTask.save();
        createdTasks.push(newTask);
      }
    }
  }

  // Recipe-based project
  if (recipeSnapshot) {
    // Total executions = targetQuantity for standalone recipes
    const totalExecutions = project.targetQuantity;

    // Find the first step (order = 1)
    const firstStep = recipeSnapshot.steps.find((step) => step.order === 1);

    if (!firstStep) {
      throw new Error(
        `Recipe "${recipeSnapshot.name}" does not have a first step`
      );
    }

    // Validate deviceTypeId exists
    if (!firstStep.deviceTypeId) {
      throw new Error(
        `First step of recipe "${recipeSnapshot.name}" does not have a deviceTypeId`
      );
    }

    // Determine if this is the last step
    const maxStepOrder = Math.max(...recipeSnapshot.steps.map((s) => s.order));
    const isLastStep = firstStep.order === maxStepOrder;

    // Create ALL first-step tasks for ALL executions upfront
    for (let execution = 1; execution <= totalExecutions; execution++) {
      const newTask = new Task({
        title: `${firstStep.name} - Exec ${execution}/${totalExecutions} - ${project.name}`,
        description: firstStep.description,
        projectId: project._id,
        recipeId: recipeSnapshot.originalRecipeId,
        recipeSnapshotId: recipeSnapshot._id,
        recipeStepId: firstStep._id,
        recipeExecutionNumber: execution,
        totalRecipeExecutions: totalExecutions,
        stepOrder: firstStep.order,
        isLastStepInRecipe: isLastStep,
        deviceTypeId: firstStep.deviceTypeId,
        status: "PENDING",
        priority: project.priority,
        estimatedDuration: firstStep.estimatedDuration,
        progress: 0,
        pausedDuration: 0
      });

      await newTask.save();
      createdTasks.push(newTask);
    }
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
