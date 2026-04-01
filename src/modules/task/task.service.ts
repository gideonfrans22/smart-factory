import {
  Device,
  Product,
  Project,
  Recipe
} from "@shared/models";
import { realtimeService } from "@shared/services";
import { SnapshotService } from "@shared/services/snapshotService";
import mongoose from "mongoose";
import { mongoAlertRepository } from "./adapters/mongo/alert.repository";
import { mongoDeviceRepository } from "./adapters/mongo/device.repository";
import { mongoIdFactory } from "./adapters/mongo/id.factory";
import { mongoRecipeSnapshotRepository } from "./adapters/mongo/recipe-snapshot.repository";
import { mongoProductSnapshotRepository } from "./adapters/mongo/product-snapshot.repository";
import { mongoProjectDeviceConfigurationRepository } from "./adapters/mongo/project-device-configuration.repository";
import { mongoProjectRepository } from "./adapters/mongo/project.repository";
import { mongoTaskReadRepository } from "./adapters/mongo/task.read.repository";
import { mongoTaskRepository } from "./adapters/mongo/task.repository";
import { realtimeTaskNotifier } from "./adapters/realtime/task.notifier";
import { TaskDomainError } from "./domain/errors";
import { batchUpdateTasks as batchUpdateTasksDomain } from "./domain/task.batch-update";
import { completeTask as completeTaskDomain } from "./domain/task.complete";
import { failTask as failTaskDomain } from "./domain/task.fail";
import { generateTasksForProject as generateTasksForProjectDomain } from "./domain/task.generator";
import { recalculateProjectMetrics as recalculateProjectMetricsDomain } from "./domain/task.metrics";
import { patchTask as patchTaskDomain } from "./domain/task.patch";
import { pauseTask as pauseTaskDomain } from "./domain/task.pause";
import { resumeTask as resumeTaskDomain } from "./domain/task.resume";
import { startTask as startTaskDomain } from "./domain/task.start";
import { startTasksBatch as startTasksBatchDomain } from "./domain/task.start-batch";
import { updateTaskStatus as updateTaskStatusDomain } from "./domain/task.status.update";
import { ITask, Task } from "./task.model";
import { TaskServiceError } from "./task.service-error";
import type {
  DeviceTaskQuery,
  TaskBatchUpdateDTO,
  TaskCompleteBody,
  TaskCreateDTO,
  TaskGroupedQuery,
  TaskListQuery,
  TaskPauseBody,
  TaskResumeBody,
  TaskStandaloneQuery,
  TaskStartBody,
  TaskStatisticsQuery,
  TaskStatusUpdateBody,
  TaskUpdateDTO,
  WorkerTaskQuery
} from "./task.types";

export type TaskDocument = ITask;

export { TaskServiceError } from "./task.service-error";

function mapTaskDomainErrorToServiceError(
  error: TaskDomainError
): TaskServiceError {
  return new TaskServiceError({
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    message: error.message,
    data: error.data
  });
}

export class TaskService {
  /**
   * Build lookup from stored project device configuration (Map or plain object from lean).
   */
  private normalizeProjectDeviceConfigurationMap(
    byDeviceType: unknown
  ): Map<string, string[]> {
    const m = new Map<string, string[]>();
    if (byDeviceType == null) {
      return m;
    }

    const toId = (id: unknown): string => String(id);

    if (byDeviceType instanceof Map) {
      byDeviceType.forEach((ids, key) => {
        const arr = Array.isArray(ids) ? ids : [];
        m.set(String(key), arr.map(toId));
      });
      return m;
    }

    if (typeof byDeviceType === "object") {
      for (const [k, v] of Object.entries(
        byDeviceType as Record<string, unknown>
      )) {
        const arr = Array.isArray(v) ? v : [];
        m.set(k, arr.map(toId));
      }
    }
    return m;
  }

  /**
   * Round-robin per device type: index increments for each task created with that type
   * (follows deterministic generation order in generateTasksForProject).
   */
  private createDeviceRoundRobinPicker(
    byDeviceType: Map<string, string[]>
  ): (deviceTypeId: string) => string | undefined {
    const roundRobinByType = new Map<string, number>();
    return (deviceTypeId: string) => {
      const key = String(deviceTypeId);
      const list = byDeviceType.get(key);
      if (!list?.length) {
        return undefined;
      }
      const i = roundRobinByType.get(key) ?? 0;
      roundRobinByType.set(key, i + 1);
      return list[i % list.length];
    };
  }

  async generateTasksForProject(
    project: any,
    productSnapshot?: any,
    recipeSnapshot?: any
  ): Promise<any[]> {
    return await generateTasksForProjectDomain(
      {
        taskRepo: mongoTaskRepository,
        projectDeviceConfigurationRepo:
          mongoProjectDeviceConfigurationRepository,
        recipeSnapshotRepo: mongoRecipeSnapshotRepository,
        idFactory: mongoIdFactory,
        notifier: realtimeTaskNotifier
      },
      {
        project,
        productSnapshot,
        recipeSnapshot,
        normalizeProjectDeviceConfigurationMap:
          this.normalizeProjectDeviceConfigurationMap.bind(this),
        createDeviceRoundRobinPicker:
          this.createDeviceRoundRobinPicker.bind(this),
      }
    );
  }

  async deleteProjectTasks(
    projectId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const result = await Task.deleteMany({ projectId });
    return result.deletedCount || 0;
  }

  async recalculateProjectMetrics(
    projectId: string | mongoose.Types.ObjectId
  ): Promise<any> {
    return await recalculateProjectMetricsDomain(
      {
        projectRepo: mongoProjectRepository,
        taskRepo: mongoTaskRepository,
        productSnapshotRepo: mongoProductSnapshotRepository
      },
      String(projectId)
    );
  }

  async listTasks(query: TaskListQuery) {
    return mongoTaskReadRepository.listTasks(query);
  }

  async getTaskById(id: string): Promise<InstanceType<typeof Task>> {
    return mongoTaskReadRepository.getTaskById(id);
  }

  async listStandaloneTasks(query: TaskStandaloneQuery) {
    return mongoTaskReadRepository.listStandaloneTasks(query);
  }

  async listDeviceTasks(deviceId: string, query: DeviceTaskQuery) {
    return mongoTaskReadRepository.listDeviceTasks(deviceId, query);
  }

  async listWorkerTasks(workerId: string, query: WorkerTaskQuery) {
    return mongoTaskReadRepository.listWorkerTasks(workerId, query);
  }

  async createStandaloneTask(dto: TaskCreateDTO): Promise<{
    task: InstanceType<typeof Task>;
    executionInfo: {
      executionNumber: number;
      totalExecutions: number;
      isProduct: boolean;
      isLastStep: boolean;
    };
    message: string;
  }> {
    const {
      title,
      description,
      projectId,
      recipeId,
      productId,
      deviceId,
      workerId,
      status,
      priority,
      estimatedDuration,
      notes,
      qualityData
    } = dto;

    if (!title || (!recipeId && !productId)) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "Title and either recipeId or productId are required"
      });
    }

    if (recipeId && productId) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message:
          "Cannot provide both recipeId and productId. Use one or the other."
      });
    }

    if (projectId) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message:
          "Project tasks are auto-generated on project activation. Use standalone task creation instead."
      });
    }

    let recipeStep: {
      _id?: unknown;
      deviceTypeId?: unknown;
      estimatedDuration?: number;
      order: number;
    } | null = null;
    let deviceTypeId: unknown = null;
    let taskEstimatedDuration: number | undefined = estimatedDuration;
    let recipeSnapshotId: unknown = null;
    let productSnapshotId: unknown = null;
    let stepOrder = 1;
    let isLastStepInRecipe = false;
    let totalExecutions = 1;
    let selectedRecipeId: unknown = recipeId;

    if (productId) {
      const product = await Product.findById(productId);
      if (!product) {
        throw new TaskServiceError({
          statusCode: 404,
          errorCode: "NOT_FOUND",
          message: "Product not found"
        });
      }
      if (!product.recipes || product.recipes.length === 0) {
        throw new TaskServiceError({
          statusCode: 400,
          errorCode: "VALIDATION_ERROR",
          message: "Product does not have any recipes"
        });
      }
      const firstProductRecipe = product.recipes[0];
      selectedRecipeId = firstProductRecipe.recipeId;
      const recipe = await Recipe.findById(selectedRecipeId);
      if (!recipe) {
        throw new TaskServiceError({
          statusCode: 404,
          errorCode: "NOT_FOUND",
          message: "First recipe in product not found"
        });
      }
      const productSnapshot = await SnapshotService.getOrCreateProductSnapshot(
        new mongoose.Types.ObjectId(String(productId))
      );
      productSnapshotId = productSnapshot._id;
      const recipeSnapshot = await SnapshotService.getOrCreateRecipeSnapshot(
        new mongoose.Types.ObjectId(String(selectedRecipeId))
      );
      recipeSnapshotId = recipeSnapshot._id;
      totalExecutions = 1;
      recipeStep = recipeSnapshot.steps[0];
      deviceTypeId = recipeStep.deviceTypeId;
      taskEstimatedDuration = estimatedDuration ?? recipeStep.estimatedDuration;
      stepOrder = recipeStep.order;
      const maxStepOrder = Math.max(
        ...recipeSnapshot.steps.map((s: { order: number }) => s.order)
      );
      isLastStepInRecipe = stepOrder === maxStepOrder;
    } else {
      const recipe = await Recipe.findById(recipeId);
      if (!recipe) {
        throw new TaskServiceError({
          statusCode: 404,
          errorCode: "NOT_FOUND",
          message: "Recipe not found"
        });
      }
      const recipeSnapshot = await SnapshotService.getOrCreateRecipeSnapshot(
        new mongoose.Types.ObjectId(String(recipeId))
      );
      recipeSnapshotId = recipeSnapshot._id;
      recipeStep = recipeSnapshot.steps[0];
      deviceTypeId = recipeStep.deviceTypeId;
      taskEstimatedDuration = estimatedDuration ?? recipeStep.estimatedDuration;
      stepOrder = recipeStep.order;
      const maxStepOrder = Math.max(
        ...recipeSnapshot.steps.map((s: { order: number }) => s.order)
      );
      isLastStepInRecipe = stepOrder === maxStepOrder;
      totalExecutions = 1;
    }

    if (!deviceTypeId) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "Recipe step does not have a deviceTypeId"
      });
    }

    const task = new Task({
      title,
      description,
      projectId: undefined,
      recipeId: selectedRecipeId,
      productId: productId || undefined,
      recipeSnapshotId,
      productSnapshotId: productSnapshotId || undefined,
      recipeStepId: recipeStep ? recipeStep._id : undefined,
      recipeExecutionNumber: 1,
      totalRecipeExecutions: totalExecutions,
      stepOrder,
      isLastStepInRecipe,
      deviceTypeId,
      deviceId,
      workerId: workerId || undefined,
      status: status || "PENDING",
      priority: priority || "MEDIUM",
      estimatedDuration: taskEstimatedDuration,
      progress: 0,
      notes,
      qualityData,
      pausedDuration: 0
    });

    await task.save();
    await task.populate([
      { path: "workerId", select: "name username email" },
      {
        path: "productSnapshotId",
        select:
          "name version productNumber customerName personInCharge department"
      },
      { path: "recipeSnapshotId", select: "name version" }
    ]);

    await realtimeService.broadcastTaskAssignment(task.toObject());

    return {
      task,
      executionInfo: {
        executionNumber: 1,
        totalExecutions: totalExecutions,
        isProduct: !!productId,
        isLastStep: isLastStepInRecipe
      },
      message: `Standalone task created successfully (Execution 1/${totalExecutions})`
    };
  }

  async updateTaskStatus(
    id: string,
    body: TaskStatusUpdateBody,
    context: { userName?: string }
  ): Promise<InstanceType<typeof Task>> {
    try {
      const result = await updateTaskStatusDomain(
        {
          taskRepo: mongoTaskRepository,
          deviceRepo: mongoDeviceRepository
        },
        {
          taskId: id,
          body,
          userName: context.userName
        }
      );
      return result as InstanceType<typeof Task>;
    } catch (error) {
      if (error instanceof TaskDomainError) {
        throw mapTaskDomainErrorToServiceError(error);
      }
      throw error;
    }
  }

  async patchTask(
    id: string,
    dto: TaskUpdateDTO,
    _options?: { userName?: string }
  ): Promise<InstanceType<typeof Task>> {
    try {
      const result = await patchTaskDomain(
        {
          taskRepo: mongoTaskRepository,
          notifier: realtimeTaskNotifier
        },
        {
          taskId: id,
          dto
        }
      );
      return result as InstanceType<typeof Task>;
    } catch (error) {
      if (error instanceof TaskDomainError) {
        throw mapTaskDomainErrorToServiceError(error);
      }
      throw error;
    }
  }

  async batchUpdateTasks(dto: TaskBatchUpdateDTO): Promise<{
    updated: InstanceType<typeof Task>[];
    summary: {
      totalRequested: number;
      found: number;
      updated: number;
      notFound: string[];
    };
    message: string;
  }> {
    try {
      const result = await batchUpdateTasksDomain(
        {
          taskRepo: mongoTaskRepository,
          deviceRepo: mongoDeviceRepository,
          notifier: realtimeTaskNotifier,
          projectRepo: mongoProjectRepository
        },
        dto
      );
      return {
        ...result,
        updated: result.updated as InstanceType<typeof Task>[]
      };
    } catch (error) {
      if (error instanceof TaskDomainError) {
        throw mapTaskDomainErrorToServiceError(error);
      }
      throw error;
    }
  }

  async startTask(
    id: string,
    body: TaskStartBody
  ): Promise<InstanceType<typeof Task>> {
    try {
      const { workerId, deviceId } = body;
      const result = await startTaskDomain(
        {
          taskRepo: mongoTaskRepository,
          deviceRepo: mongoDeviceRepository,
          notifier: realtimeTaskNotifier
        },
        {
          taskId: id,
          workerId,
          deviceId
        }
      );
      return result as InstanceType<typeof Task>;
    } catch (error) {
      if (error instanceof TaskDomainError) {
        throw mapTaskDomainErrorToServiceError(error);
      }
      throw error;
    }
  }

  async startTasksBatch(
    body: import("./task.types").TaskStartBatchBody
  ): Promise<InstanceType<typeof Task>[]> {
    try {
      const { projectId, recipeSnapshotId, stepOrder, limit, workerId, deviceId } =
        body;
      const result = await startTasksBatchDomain(
        {
          taskRepo: mongoTaskRepository,
          deviceRepo: mongoDeviceRepository,
          notifier: realtimeTaskNotifier
        },
        {
          projectId,
          recipeSnapshotId,
          stepOrder,
          limit,
          workerId,
          deviceId
        }
      );
      return result.tasks as InstanceType<typeof Task>[];
    } catch (error) {
      if (error instanceof TaskDomainError) {
        throw mapTaskDomainErrorToServiceError(error);
      }
      throw error;
    }
  }

  async resumeTask(
    id: string,
    body: TaskResumeBody,
    context: { userName?: string }
  ): Promise<InstanceType<typeof Task>> {
    try {
      const { resolvedBy = "System" } = body || {};
      const result = await resumeTaskDomain(
        {
          taskRepo: mongoTaskRepository,
          deviceRepo: mongoDeviceRepository,
          alertRepo: mongoAlertRepository,
          notifier: realtimeTaskNotifier
        },
        {
          taskId: id,
          resolvedBy,
          userName: context.userName
        }
      );
      return result as InstanceType<typeof Task>;
    } catch (error) {
      if (error instanceof TaskDomainError) {
        throw mapTaskDomainErrorToServiceError(error);
      }
      throw error;
    }
  }

  async pauseTask(
    id: string,
    body: TaskPauseBody,
    context: { userName?: string }
  ): Promise<InstanceType<typeof Task>> {
    try {
      const result = await pauseTaskDomain(
        {
          taskRepo: mongoTaskRepository,
          notifier: realtimeTaskNotifier
        },
        {
          taskId: id,
          reason: body.reason,
          notes: body.notes,
          reportedBy: body.reportedBy,
          isEmergency: body.isEmergency,
          userName: context.userName
        }
      );
      return result as InstanceType<typeof Task>;
    } catch (error) {
      if (error instanceof TaskDomainError) {
        throw mapTaskDomainErrorToServiceError(error);
      }
      throw error;
    }
  }

  async failTask(
    id: string,
    notes: string | undefined
  ): Promise<{
    failedTask: InstanceType<typeof Task>;
    totalFailedTasks: number;
    project: {
      _id: unknown;
      status: unknown;
      progress: unknown;
    } | null;
    message: string;
  }> {
    try {
      const result = await failTaskDomain(
        {
          taskRepo: mongoTaskRepository,
          projectRepo: mongoProjectRepository,
          notifier: realtimeTaskNotifier
        },
        { taskId: id, notes }
      );
      return {
        ...result,
        failedTask: result.failedTask as InstanceType<typeof Task>
      };
    } catch (error) {
      if (error instanceof TaskDomainError) {
        throw mapTaskDomainErrorToServiceError(error);
      }
      throw error;
    }
  }

  async completeTask(
    id: string,
    body: TaskCompleteBody,
    context: { userName?: string }
  ): Promise<{
    message: string;
    data: Record<string, unknown>;
  }> {
    try {
      return await completeTaskDomain(
        {
          taskRepo: mongoTaskRepository,
          deviceRepo: mongoDeviceRepository,
          projectRepo: mongoProjectRepository,
          notifier: realtimeTaskNotifier
        },
        { taskId: id, body, userName: context.userName }
      );
    } catch (error) {
      if (error instanceof TaskDomainError) {
        throw mapTaskDomainErrorToServiceError(error);
      }
      throw error;
    }
  }

  async deleteTask(
    id: string,
    options: { cascadeDelete: boolean }
  ): Promise<{
    message: string;
    data: Record<string, unknown>;
  }> {
    const { cascadeDelete } = options;
    const task = await Task.findById(id);
    if (!task) {
      throw new TaskServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Task not found"
      });
    }

    const dependentTasks = await Task.find({
      dependentTask: task._id
    });

    if (dependentTasks.length > 0 && !cascadeDelete) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: `Cannot delete task: ${dependentTasks.length} task(s) depend on this task. Use cascadeDelete=true to delete dependent tasks as well.`,
        data: {
          dependentTasksCount: dependentTasks.length,
          dependentTasks: dependentTasks.map((t) => ({
            _id: t._id,
            title: t.title,
            status: t.status
          }))
        }
      });
    }

    const taskId = task._id as mongoose.Types.ObjectId;
    const projectId = task.projectId;
    const deviceId = task.deviceId;
    const taskData = task.toObject();

    const deletedDependentTasks: unknown[] = [];
    if (cascadeDelete && dependentTasks.length > 0) {
      const deleteDependentTasksRecursively = async (
        taskIds: mongoose.Types.ObjectId[]
      ) => {
        const tasksToDelete = await Task.find({
          _id: { $in: taskIds }
        });

        for (const depTask of tasksToDelete) {
          const depTaskId = depTask._id as mongoose.Types.ObjectId;
          const nextDependentTasks = await Task.find({
            dependentTask: depTaskId
          });

          if (nextDependentTasks.length > 0) {
            await deleteDependentTasksRecursively(
              nextDependentTasks.map((t) => t._id as mongoose.Types.ObjectId)
            );
          }

          if (depTask.deviceId) {
            const device = await Device.findById(depTask.deviceId);
            if (
              device &&
              device.currentTask?.toString() === depTaskId.toString()
            ) {
              device.currentTask = undefined;
              device.currentUser = undefined;
              await device.save();
            }
          }

          deletedDependentTasks.push(depTask.toObject());
          await Task.findByIdAndDelete(depTaskId);
        }
      };

      await deleteDependentTasksRecursively(
        dependentTasks.map((t) => t._id as mongoose.Types.ObjectId)
      );
    } else if (dependentTasks.length > 0) {
      await Task.updateMany(
        { dependentTask: taskId },
        { $unset: { dependentTask: "" } }
      );
    }

    if (deviceId) {
      const device = await Device.findById(deviceId);
      if (device && device.currentTask?.toString() === taskId.toString()) {
        device.currentTask = undefined;
        device.currentUser = undefined;
        await device.save();
      }
    }

    await Task.findByIdAndDelete(taskId);

    let updatedProject: InstanceType<typeof Project> | null = null;
    if (projectId) {
      updatedProject = await this.recalculateProjectMetrics(projectId);
      if (updatedProject) {
        await realtimeService.broadcastProjectUpdate(updatedProject.toObject());
      }
    }

    await realtimeService.broadcastTaskStatusChange(taskData);

    const message = `Task deleted successfully${
      deletedDependentTasks.length > 0
        ? `. ${deletedDependentTasks.length} dependent task(s) also deleted.`
        : dependentTasks.length > 0
        ? `. ${dependentTasks.length} dependent task(s) dependency removed.`
        : ""
    }`;

    return {
      message,
      data: {
        deletedTask: {
          _id: taskData._id,
          title: taskData.title,
          status: taskData.status,
          projectId: taskData.projectId
        },
        deletedDependentTasksCount: deletedDependentTasks.length,
        project: updatedProject
          ? {
              _id: updatedProject._id,
              progress: updatedProject.progress,
              producedQuantity: updatedProject.producedQuantity,
              status: updatedProject.status
            }
          : null
      }
    };
  }

  async getTaskStatistics(query: TaskStatisticsQuery) {
    return mongoTaskReadRepository.getTaskStatistics(query);
  }

  async getGroupedTasks(query: TaskGroupedQuery) {
    return mongoTaskReadRepository.getGroupedTasks(query);
  }
}

export const taskService = new TaskService();
