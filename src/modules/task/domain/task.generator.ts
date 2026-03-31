import type { IdFactory } from "../ports/IdFactory";
import type { ProjectDeviceConfigurationRepo } from "../ports/ProjectDeviceConfigurationRepo";
import type { RecipeSnapshotRepo } from "../ports/RecipeSnapshotRepo";
import type { TaskNotifier } from "../ports/TaskNotifier";
import type { TaskCreateManyDoc, TaskPersisted, TaskRepo } from "../ports/TaskRepo";

export interface GenerateTasksForProjectDeps {
  taskRepo: TaskRepo;
  projectDeviceConfigurationRepo: ProjectDeviceConfigurationRepo;
  recipeSnapshotRepo: RecipeSnapshotRepo;
  idFactory: IdFactory;
  notifier: TaskNotifier;
}

export interface GenerateTasksForProjectInput {
  project: any;
  productSnapshot?: any;
  recipeSnapshot?: any;
  normalizeProjectDeviceConfigurationMap: (
    byDeviceType: unknown
  ) => Map<string, string[]>;
  createDeviceRoundRobinPicker: (
    byDeviceType: Map<string, string[]>
  ) => (deviceTypeId: string) => string | undefined;
}

export async function generateTasksForProject(
  deps: GenerateTasksForProjectDeps,
  input: GenerateTasksForProjectInput
): Promise<TaskPersisted[]> {
  const createdTasks: TaskPersisted[] = [];

  const configLean = await deps.projectDeviceConfigurationRepo.findByProjectId(
    String(input.project._id)
  );
  const byDeviceTypeMap = input.normalizeProjectDeviceConfigurationMap(
    configLean?.byDeviceType
  );
  const nextDeviceId = input.createDeviceRoundRobinPicker(byDeviceTypeMap);

  if (input.productSnapshot) {
    const taskDocs: TaskCreateManyDoc[] = [];
    for (const productRecipe of input.productSnapshot.recipes) {
      const totalExecutions =
        input.project.targetQuantity * productRecipe.quantity;
      const recipeSnapshotId = productRecipe.recipeSnapshotId;
      if (!recipeSnapshotId) continue;

      const recipeSnap = await deps.recipeSnapshotRepo.findById(
        String(recipeSnapshotId)
      );
      if (!recipeSnap) continue;

      const steps = [...recipeSnap.steps].sort((a, b) => a.order - b.order);
      if (steps.length === 0) continue;

      const maxStepOrder = steps[steps.length - 1].order;

      for (let execution = 1; execution <= totalExecutions; execution++) {
        let previousTaskId: string | undefined = undefined;

        for (const step of steps) {
          const isLastStep = step.order === maxStepOrder;
          const deviceId = nextDeviceId(step.deviceTypeId);
          const taskId = deps.idFactory.newObjectIdHex();

          const doc: TaskCreateManyDoc = {
            _id: taskId,
            title: `${step.name} - Exec ${execution}/${totalExecutions} - ${input.productSnapshot.name}`,
            description: step.description,
            projectId: input.project._id,
            projectNumber: input.project.projectNumber,
            productId: input.productSnapshot.originalProductId,
            productSnapshotId: input.productSnapshot._id,
            recipeId: recipeSnap.originalRecipeId,
            recipeSnapshotId: recipeSnap.id,
            recipeStepId: step.id,
            recipeExecutionNumber: execution,
            totalRecipeExecutions: totalExecutions,
            stepOrder: step.order,
            isLastStepInRecipe: isLastStep,
            deviceTypeId: step.deviceTypeId,
            ...(deviceId ? { deviceId } : {}),
            status: "PENDING",
            priority: input.project.priority,
            estimatedDuration: step.estimatedDuration,
            deadline: input.project.deadline,
            progress: 0,
            pausedDuration: 0,
            dependentTask: previousTaskId
          };

          taskDocs.push(doc);
          previousTaskId = taskId;
        }
      }
    }
    const created = await deps.taskRepo.createMany(taskDocs);
    createdTasks.push(...created);
  }

  if (input.recipeSnapshot) {
    const taskDocs: TaskCreateManyDoc[] = [];
    const totalExecutions = input.project.targetQuantity;
    const steps = [...input.recipeSnapshot.steps].sort(
      (a: any, b: any) => a.order - b.order
    );
    if (steps.length === 0) {
      throw new Error(`Recipe "${input.recipeSnapshot.name}" does not have any steps`);
    }

    const maxStepOrder = steps[steps.length - 1].order;

    for (let execution = 1; execution <= totalExecutions; execution++) {
      let previousTaskId: string | undefined = undefined;

      for (const step of steps) {
        if (!step.deviceTypeId) {
          throw new Error(
            `Step ${step.order} of recipe "${input.recipeSnapshot.name}" does not have a deviceTypeId`
          );
        }

        const isLastStep = step.order === maxStepOrder;
        const deviceId = nextDeviceId(String(step.deviceTypeId));
        const taskId = deps.idFactory.newObjectIdHex();

        const doc: TaskCreateManyDoc = {
          _id: taskId,
          title: `${step.name} - Exec ${execution}/${totalExecutions} - ${input.project.name}`,
          description: step.description,
          projectId: input.project._id,
          projectNumber: input.project.projectNumber,
          recipeId: input.recipeSnapshot.originalRecipeId,
          recipeSnapshotId: input.recipeSnapshot._id,
          recipeStepId: step._id ?? step.id,
          recipeExecutionNumber: execution,
          totalRecipeExecutions: totalExecutions,
          stepOrder: step.order,
          isLastStepInRecipe: isLastStep,
          deviceTypeId: String(step.deviceTypeId),
          ...(deviceId ? { deviceId } : {}),
          status: "PENDING",
          priority: input.project.priority,
          estimatedDuration: step.estimatedDuration,
          deadline: input.project.deadline,
          progress: 0,
          pausedDuration: 0,
          dependentTask: previousTaskId
        };

        taskDocs.push(doc);
        previousTaskId = taskId;
      }
    }
    const created = await deps.taskRepo.createMany(taskDocs);
    createdTasks.push(...created);
  }

  if (createdTasks.length > 0) {
    const projectIdStr = String(input.project._id);
    await deps.notifier.broadcastTasksGeneratedForDeviceTypes(
      createdTasks,
      projectIdStr,
      input.project.name
    );
  }

  return createdTasks;
}

