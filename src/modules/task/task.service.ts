import { parseDateAsKST, roundToTwoDecimals } from "@shared/helpers";
import {
  Device,
  IRecipeSnapshot,
  Product,
  ProductSnapshot,
  Project,
  Recipe
} from "@shared/models";
import { loggerService, realtimeService } from "@shared/services";
import { SnapshotService } from "@shared/services/snapshotService";
import mongoose from "mongoose";
import { mongoAlertRepository } from "./adapters/mongo/alert.repository";
import { mongoDeviceRepository } from "./adapters/mongo/device.repository";
import { mongoTaskRepository } from "./adapters/mongo/task.repository";
import { realtimeTaskNotifier } from "./adapters/realtime/task.notifier";
import { batchUpdateTasks as batchUpdateTasksDomain } from "./domain/task.batch-update";
import { pauseTask as pauseTaskDomain } from "./domain/task.pause";
import { patchTask as patchTaskDomain } from "./domain/task.patch";
import { resumeTask as resumeTaskDomain } from "./domain/task.resume";
import { startTask as startTaskDomain } from "./domain/task.start";
import { updateTaskStatus as updateTaskStatusDomain } from "./domain/task.status.update";
import { TaskDomainError } from "./domain/errors";
import { ITask, Task } from "./task.model";
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

export class TaskServiceError extends Error {
  statusCode: number;
  errorCode: string;
  data?: unknown;

  constructor(options: {
    statusCode: number;
    errorCode: string;
    message: string;
    data?: unknown;
  }) {
    super(options.message);
    this.name = "TaskServiceError";
    this.statusCode = options.statusCode;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}

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
  ): Map<string, mongoose.Types.ObjectId[]> {
    const m = new Map<string, mongoose.Types.ObjectId[]>();
    if (byDeviceType == null) {
      return m;
    }

    const toOid = (id: unknown): mongoose.Types.ObjectId => {
      if (id instanceof mongoose.Types.ObjectId) {
        return id;
      }
      if (typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) {
        return new mongoose.Types.ObjectId(id);
      }
      return new mongoose.Types.ObjectId(String(id));
    };

    if (byDeviceType instanceof Map) {
      byDeviceType.forEach((ids, key) => {
        const arr = Array.isArray(ids) ? ids : [];
        m.set(String(key), arr.map(toOid));
      });
      return m;
    }

    if (typeof byDeviceType === "object") {
      for (const [k, v] of Object.entries(
        byDeviceType as Record<string, unknown>
      )) {
        const arr = Array.isArray(v) ? v : [];
        m.set(k, arr.map(toOid));
      }
    }
    return m;
  }

  /**
   * Round-robin per device type: index increments for each task created with that type
   * (follows deterministic generation order in generateTasksForProject).
   */
  private createDeviceRoundRobinPicker(
    byDeviceType: Map<string, mongoose.Types.ObjectId[]>
  ): (
    deviceTypeId: mongoose.Types.ObjectId
  ) => mongoose.Types.ObjectId | undefined {
    const roundRobinByType = new Map<string, number>();
    return (deviceTypeId: mongoose.Types.ObjectId) => {
      const key = deviceTypeId.toString();
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
    const createdTasks: any[] = [];

    const ProjectDeviceConfigurationModel = mongoose.model(
      "ProjectDeviceConfiguration"
    );
    const configLean = (await ProjectDeviceConfigurationModel.findOne({
      projectId: project._id
    }).lean()) as { byDeviceType?: unknown } | null;
    const byDeviceTypeMap = this.normalizeProjectDeviceConfigurationMap(
      configLean?.byDeviceType
    );
    const nextDeviceId = this.createDeviceRoundRobinPicker(byDeviceTypeMap);

    if (productSnapshot) {
      for (const productRecipe of productSnapshot.recipes) {
        const totalExecutions = project.targetQuantity * productRecipe.quantity;
        const recipeSnapshotId = productRecipe.recipeSnapshotId;
        if (!recipeSnapshotId) continue;

        const RecipeSnapshot = mongoose.model("RecipeSnapshot");
        const recipeSnap = await RecipeSnapshot.findById(recipeSnapshotId);
        if (!recipeSnap) continue;

        const steps = (recipeSnap as any).steps.sort(
          (a: any, b: any) => a.order - b.order
        );
        if (steps.length === 0) continue;

        const maxStepOrder = steps[steps.length - 1].order;

        for (let execution = 1; execution <= totalExecutions; execution++) {
          let previousTaskId: mongoose.Types.ObjectId | undefined = undefined;

          for (const step of steps) {
            if (!step.deviceTypeId) {
              throw new Error(
                `Step ${step.order} of recipe in product "${productSnapshot.name}" does not have a deviceTypeId`
              );
            }

            const isLastStep = step.order === maxStepOrder;

            const deviceId = nextDeviceId(step.deviceTypeId);

            const newTask = new Task({
              title: `${step.name} - Exec ${execution}/${totalExecutions} - ${productSnapshot.name}`,
              description: step.description,
              projectId: project._id,
              projectNumber: project.projectNumber,
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
              ...(deviceId ? { deviceId } : {}),
              status: "PENDING",
              priority: project.priority,
              estimatedDuration: step.estimatedDuration,
              deadline: project.deadline,
              progress: 0,
              pausedDuration: 0,
              dependentTask: previousTaskId
            });

            await newTask.save();
            createdTasks.push(newTask);
            previousTaskId = newTask._id as mongoose.Types.ObjectId;
          }
        }
      }
    }

    if (recipeSnapshot) {
      const totalExecutions = project.targetQuantity;
      const steps = recipeSnapshot.steps.sort(
        (a: any, b: any) => a.order - b.order
      );
      if (steps.length === 0) {
        throw new Error(
          `Recipe "${recipeSnapshot.name}" does not have any steps`
        );
      }

      const maxStepOrder = steps[steps.length - 1].order;

      for (let execution = 1; execution <= totalExecutions; execution++) {
        let previousTaskId: mongoose.Types.ObjectId | undefined = undefined;

        for (const step of steps) {
          if (!step.deviceTypeId) {
            throw new Error(
              `Step ${step.order} of recipe "${recipeSnapshot.name}" does not have a deviceTypeId`
            );
          }

          const isLastStep = step.order === maxStepOrder;

          const deviceId = nextDeviceId(step.deviceTypeId);

          const newTask = new Task({
            title: `${step.name} - Exec ${execution}/${totalExecutions} - ${project.name}`,
            description: step.description,
            projectId: project._id,
            projectNumber: project.projectNumber,
            recipeId: recipeSnapshot.originalRecipeId,
            recipeSnapshotId: recipeSnapshot._id,
            recipeStepId: step._id,
            recipeExecutionNumber: execution,
            totalRecipeExecutions: totalExecutions,
            stepOrder: step.order,
            isLastStepInRecipe: isLastStep,
            deviceTypeId: step.deviceTypeId,
            ...(deviceId ? { deviceId } : {}),
            status: "PENDING",
            priority: project.priority,
            estimatedDuration: step.estimatedDuration,
            deadline: project.deadline,
            progress: 0,
            pausedDuration: 0,
            dependentTask: previousTaskId
          });

          await newTask.save();
          createdTasks.push(newTask);
          previousTaskId = newTask._id as mongoose.Types.ObjectId;
        }
      }
    }

    if (createdTasks.length > 0) {
      const projectIdStr = (project._id as mongoose.Types.ObjectId).toString();
      await realtimeService.broadcastTasksGeneratedForDeviceTypes(
        createdTasks,
        projectIdStr,
        project.name
      );
    }

    return createdTasks;
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
    const Project = mongoose.model("Project");
    const ProductSnapshot = mongoose.model("ProductSnapshot");
    const project = await Project.findById(projectId);

    if (!project) {
      return null;
    }

    const allProjectTasks = await Task.find({ projectId });
    const totalTasks = allProjectTasks.length;
    const completedTasks = allProjectTasks.filter(
      (t) => t.status === "COMPLETED"
    ).length;

    project.progress = roundToTwoDecimals(
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    );

    if (project.productSnapshot) {
      const productSnapshot = await ProductSnapshot.findById(
        project.productSnapshot
      );
      if (productSnapshot) {
        let minCompletedSets = Infinity;

        for (const recipeRef of productSnapshot.recipes) {
          const recipeSnapshotId = recipeRef.recipeSnapshotId.toString();
          const requiredQuantity = recipeRef.quantity;

          const completedExecutions = await Task.countDocuments({
            projectId: project._id,
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
    } else if (project.recipeSnapshot) {
      const completedExecutions = await Task.countDocuments({
        projectId: project._id,
        isLastStepInRecipe: true,
        status: "COMPLETED"
      });
      project.producedQuantity = completedExecutions;
    }

    const allTasksFinished = allProjectTasks.every(
      (t) => t.status === "COMPLETED" || t.status === "FAILED"
    );

    if (allTasksFinished && project.status !== "COMPLETED") {
      project.status = "COMPLETED";
      project.endDate = new Date();
    } else if (!allTasksFinished && project.status === "COMPLETED") {
      project.status = "ACTIVE";
      project.endDate = undefined;
    } else if (
      project.producedQuantity >= project.targetQuantity &&
      project.status !== "COMPLETED"
    ) {
      project.status = "COMPLETED";
      project.progress = 100;
      if (!project.endDate) {
        project.endDate = new Date();
      }
    }

    await project.save();
    return project;
  }

  async listTasks(query: TaskListQuery): Promise<{
    items: unknown[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const {
      status,
      deviceId,
      deviceTypeId,
      projectId,
      recipeId,
      productId,
      priority,
      workerId,
      search,
      includePendingAndPartial,
      page = "1",
      limit = "10"
    } = query;

    const mongoQuery: Record<string, unknown> = {};

    if (includePendingAndPartial === "true") {
      mongoQuery.$or = [
        { status: "PENDING" },
        { status: "ONGOING" },
        { status: "PAUSED" },
        { status: "COMPLETED", progress: { $lt: 100 } }
      ];
    } else if (status) {
      mongoQuery.status = status;
    }

    if (deviceId) mongoQuery.deviceId = deviceId;
    if (deviceTypeId) mongoQuery.deviceTypeId = deviceTypeId;
    if (projectId) mongoQuery.projectId = projectId;
    if (recipeId) mongoQuery.recipeId = recipeId;
    if (productId) mongoQuery.productId = productId;
    if (workerId) mongoQuery.workerId = workerId;
    if (priority) mongoQuery.priority = priority;

    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i");
      const recipes = await Recipe.find({ name: searchRegex }).select("_id");
      const recipeIds = recipes.map((r) => r._id);
      const products = await Product.find({ name: searchRegex }).select("_id");
      const productIds = products.map((p) => p._id);

      if (recipeIds.length > 0 || productIds.length > 0) {
        const searchConditions: Record<string, unknown>[] = [];
        if (recipeIds.length > 0) {
          searchConditions.push({ recipeId: { $in: recipeIds } });
        }
        if (productIds.length > 0) {
          searchConditions.push({ productId: { $in: productIds } });
        }
        searchConditions.push({ title: searchRegex });

        if (mongoQuery.$or) {
          mongoQuery.$and = [
            { $or: mongoQuery.$or },
            { $or: searchConditions }
          ];
          delete mongoQuery.$or;
        } else {
          mongoQuery.$or = searchConditions;
        }
      } else {
        if (mongoQuery.$or) {
          mongoQuery.$and = [{ $or: mongoQuery.$or }, { title: searchRegex }];
          delete mongoQuery.$or;
        } else {
          mongoQuery.title = searchRegex;
        }
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(mongoQuery);
    const tasks = await Task.find(mongoQuery)
      .populate(
        "projectId",
        "name status priority deadline progress targetQuantity producedQuantity projectNumber"
      )
      .populate("workerId", "name username")
      .populate("deviceId", "name deviceName")
      .populate({
        path: "recipeSnapshotId",
        select: "name version steps",
        populate: {
          path: "rawMaterials",
          select: "quantityRequired name rawMaterialNumber specification"
        }
      })
      .populate(
        "productSnapshotId",
        "name version productNumber customerName personInCharge department"
      )
      .populate(
        "productId",
        "designNumber productName customerName personInCharge department"
      )
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    return {
      items: tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    };
  }

  async getTaskById(id: string): Promise<InstanceType<typeof Task>> {
    const task = await Task.findById(id)
      .populate(
        "projectId",
        "name status priority deadline progress targetQuantity producedQuantity projectNumber"
      )
      .populate("workerId", "name username")
      .populate({
        path: "recipeSnapshotId",
        select: "name version steps",
        populate: {
          path: "rawMaterials",
          select: "quantityRequired name rawMaterialNumber specification"
        }
      })
      .populate(
        "productSnapshotId",
        "name version productNumber customerName personInCharge department"
      )
      .populate(
        "productId",
        "designNumber productName customerName personInCharge department"
      )
      .populate("dependentTask", "title status");

    if (!task) {
      throw new TaskServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Task not found"
      });
    }
    return task;
  }

  async listStandaloneTasks(query: TaskStandaloneQuery): Promise<{
    items: unknown[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const {
      status,
      deviceId,
      deviceTypeId,
      recipeId,
      workerId,
      search,
      page = "1",
      limit = "10"
    } = query;

    const mongoQuery: Record<string, unknown> = {
      projectId: { $exists: false }
    };

    if (status) mongoQuery.status = status;
    if (deviceId) mongoQuery.deviceId = deviceId;
    if (deviceTypeId) mongoQuery.deviceTypeId = deviceTypeId;
    if (recipeId) mongoQuery.recipeId = recipeId;
    if (workerId) mongoQuery.workerId = workerId;

    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i");
      const recipes = await Recipe.find({ name: searchRegex }).select("_id");
      const recipeIds = recipes.map((r) => r._id);
      if (recipeIds.length > 0) {
        mongoQuery.$or = [
          { recipeId: { $in: recipeIds } },
          { title: searchRegex }
        ];
      } else {
        mongoQuery.title = searchRegex;
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(mongoQuery);
    const tasks = await Task.find(mongoQuery)
      .populate("recipeId", "name recipeNumber version")
      .populate("recipeSnapshotId", "name version steps")
      .populate("workerId", "name username")
      .populate("deviceTypeId", "name")
      .populate("deviceId", "name")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    return {
      items: tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    };
  }

  async listDeviceTasks(
    deviceId: string,
    query: DeviceTaskQuery
  ): Promise<{
    items: unknown[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    if (!deviceId) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "deviceId parameter is required"
      });
    }

    const { status, workerId, start, end, page = "1", limit = "10" } = query;

    const device = await Device.findById(deviceId)
      .select("deviceTypeId")
      .lean();
    if (!device) {
      throw new TaskServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Device not found"
      });
    }

    const deviceObjectId = new mongoose.Types.ObjectId(deviceId);
    const mongoQuery: Record<string, unknown> = {
      deviceTypeId: device.deviceTypeId,
      $or: [
        { deviceId: deviceObjectId },
        { deviceId: null },
        { deviceId: { $exists: false } }
      ]
    };

    if (status) mongoQuery.status = status;

    if (workerId) {
      const workerObjectId = new mongoose.Types.ObjectId(workerId);
      if (!mongoQuery.$and) mongoQuery.$and = [];
      (mongoQuery.$and as unknown[]).push({
        $or: [
          { workerId: workerObjectId },
          { workerId: null },
          { workerId: { $exists: false } }
        ]
      });
    }

    if (start || end) {
      const startDate = start ? new Date(start) : null;
      const endDate = end ? new Date(end) : null;
      const dateConditions: Record<string, unknown>[] = [];

      if (startDate) {
        dateConditions.push({
          $or: [
            { completedAt: { $gte: startDate } },
            { completedAt: null, createdAt: { $gte: startDate } }
          ]
        });
      }
      if (endDate) {
        dateConditions.push({
          $or: [
            { completedAt: { $lte: endDate } },
            { completedAt: null, createdAt: { $lte: endDate } }
          ]
        });
      }
      if (dateConditions.length > 0) {
        mongoQuery.$and = mongoQuery.$and || [];
        (mongoQuery.$and as unknown[]).push(...dateConditions);
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [total, tasks] = await Promise.all([
      Task.countDocuments(mongoQuery),
      Task.find(mongoQuery)
        .select(
          "title description projectId recipeId recipeSnapshotId productSnapshotId workerId deviceId deviceTypeId status priority progress notes createdAt updatedAt startedAt completedAt dependentTask mediaFiles recipeExecutionNumber totalRecipeExecutions stepOrder isLastStepInRecipe pausedDuration pauseHistory"
        )
        .populate(
          "projectId",
          "name status priority deadline startDate progress targetQuantity producedQuantity"
        )
        .populate("recipeId", "name recipeNumber version")
        .populate("workerId", "name username email")
        .populate("recipeSnapshotId", "name version steps")
        .populate(
          "productSnapshotId",
          "name productNumber customerName personInCharge department version"
        )
        .populate("mediaFiles", "url type filename")
        .populate("dependentTask", "title status")
        .skip(skip)
        .limit(limitNum)
        .sort({ completedAt: -1, createdAt: -1 })
        .lean()
    ]);

    return {
      items: tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    };
  }

  async listWorkerTasks(
    workerId: string,
    query: WorkerTaskQuery
  ): Promise<{
    items: unknown[];
    statistics: {
      totalTasks: number;
      byStatus: {
        PENDING: number;
        ONGOING: number;
        PAUSED: number;
        COMPLETED: number;
        FAILED: number;
      };
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    if (!workerId) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "workerId parameter is required"
      });
    }

    const { status, start, end, page = "1", limit = "10" } = query;

    const mongoQuery: Record<string, unknown> = { workerId };

    if (status) mongoQuery.status = status;

    if (start || end) {
      mongoQuery.$and = [];
      if (start) {
        (mongoQuery.$and as unknown[]).push({
          $or: [
            { createdAt: { $gte: new Date(start) } },
            { completedAt: { $gte: new Date(start) } }
          ]
        });
      }
      if (end) {
        (mongoQuery.$and as unknown[]).push({
          $or: [
            { createdAt: { $lte: new Date(end) } },
            { completedAt: { $lte: new Date(end) } }
          ]
        });
      }
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(mongoQuery);

    const tasks = await Task.find(mongoQuery)
      .populate(
        "projectId",
        "name status priority deadline progress targetQuantity producedQuantity"
      )
      .populate("recipeId", "name recipeNumber version")
      .populate("deviceId", "name deviceName")
      .populate("recipeSnapshotId", "name version steps")
      .populate(
        "productSnapshotId",
        "name productNumber customerName personInCharge department version"
      )
      .skip(skip)
      .limit(limitNum)
      .sort({ completedAt: -1, createdAt: -1 });

    const [PENDING, ONGOING, PAUSED, COMPLETED, FAILED] = await Promise.all([
      Task.countDocuments({ ...mongoQuery, status: "PENDING" }),
      Task.countDocuments({ ...mongoQuery, status: "ONGOING" }),
      Task.countDocuments({ ...mongoQuery, status: "PAUSED" }),
      Task.countDocuments({ ...mongoQuery, status: "COMPLETED" }),
      Task.countDocuments({ ...mongoQuery, status: "FAILED" })
    ]);

    return {
      items: tasks,
      statistics: {
        totalTasks: total,
        byStatus: {
          PENDING,
          ONGOING,
          PAUSED,
          COMPLETED,
          FAILED
        }
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    };
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
          notifier: realtimeTaskNotifier
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
    const task = await Task.findById(id);
    if (!task) {
      throw new TaskServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Task not found"
      });
    }
    task.status = "FAILED";
    if (notes) {
      task.notes = notes;
    }
    await task.save();
    await task.populate([
      { path: "projectId", select: "name status priority" },
      { path: "workerId", select: "name username email" },
      { path: "deviceId", select: "name deviceName ipAddress status" },
      { path: "recipeSnapshotId", select: "name version steps" },
      {
        path: "productSnapshotId",
        select:
          "name version productNumber customerName personInCharge department"
      }
    ]);

    const failedTaskIds: string[] = [];
    let project: InstanceType<typeof Project> | null = null;

    if (task._id) {
      failedTaskIds.push(task._id.toString());
      const failDependentTasksRecursively = async (taskId: string) => {
        const dependentTasks = await Task.find({
          dependentTask: taskId,
          status: { $in: ["PENDING", "ONGOING", "PAUSED"] }
        });
        for (const depTask of dependentTasks) {
          depTask.status = "FAILED";
          depTask.notes = `Automatically failed due to dependency failure: Task ${task.title}`;
          await depTask.save();
          await realtimeService.broadcastTaskStatusChange(depTask.toObject());
          if (depTask._id) {
            failedTaskIds.push(depTask._id.toString());
            await failDependentTasksRecursively(depTask._id.toString());
          }
        }
      };
      await failDependentTasksRecursively(task._id.toString());

      const projectId = task.projectId;
      if (projectId) {
        project = await Project.findById(projectId);
        if (project && project.status !== "COMPLETED") {
          const projectTasks = await Task.find({ projectId });
          const allTasksFinished = projectTasks.every(
            (t) => t.status === "COMPLETED" || t.status === "FAILED"
          );
          if (allTasksFinished) {
            project.status = "COMPLETED";
            project.endDate = new Date();
            await project.save();
            await realtimeService.broadcastProjectUpdate(project.toObject());
          }
        }
      }
    }

    await realtimeService.broadcastTaskStatusChange(task.toObject());

    return {
      failedTask: task,
      totalFailedTasks: failedTaskIds.length,
      project: project
        ? {
            _id: project._id,
            status: project.status,
            progress: project.progress
          }
        : null,
      message: `Task marked as failed. ${
        failedTaskIds.length - 1
      } dependent task(s) also marked as failed.`
    };
  }

  async completeTask(
    id: string,
    body: TaskCompleteBody,
    context: { userName?: string }
  ): Promise<{
    message: string;
    data: Record<string, unknown>;
  }> {
    const { workerId, notes, qualityData, actualDuration } = body;
    const task = await Task.findById(id).populate("recipeSnapshotId");
    if (!task) {
      throw new TaskServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Task not found"
      });
    }
    if (!workerId && !task.workerId) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "workerId is required to complete a task"
      });
    }
    if (!task.recipeSnapshotId) {
      throw new TaskServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "Task does not have a recipe snapshot reference"
      });
    }

    const completionProgress =
      (qualityData as { progress?: number } | undefined)?.progress ?? 100;

    task.status = "COMPLETED";
    task.workerId = workerId
      ? (new mongoose.Types.ObjectId(
          String(workerId)
        ) as unknown as typeof task.workerId)
      : task.workerId;
    task.completedAt = new Date();
    task.progress = completionProgress;
    if (notes) task.notes = notes;
    if (qualityData) task.qualityData = qualityData;
    if (actualDuration) task.actualDuration = actualDuration;

    if (task.pauseHistory && task.pauseHistory.length > 0) {
      const lastPause = task.pauseHistory[task.pauseHistory.length - 1];
      if (lastPause && !lastPause.resumedAt && task.completedAt) {
        lastPause.resumedAt = task.completedAt;
        lastPause.resolvedBy = context.userName || "System";
        const lastPauseDuration = Math.floor(
          (task.completedAt.getTime() -
            new Date(lastPause.pausedAt).getTime()) /
            (1000 * 60)
        );
        task.pausedDuration = (task.pausedDuration || 0) + lastPauseDuration;
      }
    }

    if (!actualDuration && task.startedAt && task.completedAt) {
      const totalDuration = Math.floor(
        (task.completedAt.getTime() - task.startedAt.getTime()) / 60000
      );
      task.actualDuration = Math.max(
        0,
        totalDuration - (task.pausedDuration || 0)
      );
    }

    await task.save();

    if (task.deviceId) {
      const device = await Device.findById(task.deviceId);
      if (device) {
        device.currentTask = undefined;
        device.currentUser = undefined;
        await device.save();
      }
    }

    let nextTask: InstanceType<typeof Task> | null = null;
    let project: InstanceType<typeof Project> | null = null;

    if (task.projectId) {
      const projectTasks = await Task.find({ projectId: task.projectId });
      const allTasksFinishedEarly = projectTasks.every(
        (t) => t.status === "COMPLETED" || t.status === "FAILED"
      );
      if (allTasksFinishedEarly) {
        project = await Project.findById(task.projectId);
        if (project && project.status !== "COMPLETED") {
          project.status = "COMPLETED";
          await project.save();
          await realtimeService.broadcastProjectUpdate(project.toObject());
        }
      }
    }

    nextTask = await Task.findOne({ dependentTask: task._id });

    if (task.projectId) {
      project = await Project.findById(task.projectId);
      if (project) {
        const allProjectTasks = await Task.find({ projectId: task.projectId });
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

        await realtimeService.broadcastProjectProgress(project);

        if (task.isLastStepInRecipe) {
          if (task.productId) {
            const productSnapshot = await ProductSnapshot.findById(
              project.productSnapshot
            );
            if (productSnapshot) {
              let minCompletedSets = Infinity;
              for (const recipeRef of productSnapshot.recipes) {
                const recipeSnapshotId = recipeRef.recipeSnapshotId.toString();
                const requiredQuantity = recipeRef.quantity;
                const completedExecutions = await Task.countDocuments({
                  projectId: task.projectId,
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
        await realtimeService.broadcastProjectUpdate(project.toObject());
      }
    }

    await task.populate("projectId workerId");

    await realtimeService.broadcastTaskCompletion(
      task.toObject(),
      nextTask?.toObject() || null,
      project?.progress
    );

    if (nextTask) {
      await realtimeService.broadcastTaskStatusChange(nextTask.toObject());
    }

    const responseData: Record<string, unknown> = {
      completedTask: task,
      nextTask: nextTask || null,
      isLastStep: task.isLastStepInRecipe,
      executionInfo: {
        executionNumber: task.recipeExecutionNumber,
        totalExecutions: task.totalRecipeExecutions,
        isLastStepInRecipe: task.isLastStepInRecipe
      }
    };

    if (task.projectId && project) {
      responseData.project = {
        _id: project._id,
        progress: project.progress
      };
      await realtimeService.broadcastProjectUpdate(project.toObject());
    }

    const message = nextTask
      ? `Task completed. Next step ready for execution ${task.recipeExecutionNumber}.`
      : task.isLastStepInRecipe
      ? `Recipe execution ${task.recipeExecutionNumber}/${task.totalRecipeExecutions} completed!`
      : "Task completed";

    await realtimeService.broadcastTaskStatusChange(task.toObject());

    return { message, data: responseData };
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

  async getTaskStatistics(
    query: TaskStatisticsQuery
  ): Promise<Record<string, unknown>> {
    const { projectId, deviceTypeId, workerId, startDate, endDate } = query;

    const baseQuery: Record<string, unknown> = {};
    if (projectId) baseQuery.projectId = projectId;
    else {
      const projects = await Project.find({ deletedAt: { $exists: false } });
      baseQuery.projectId = { $in: projects.map((p) => p._id) };
    }
    if (deviceTypeId) baseQuery.deviceTypeId = deviceTypeId;
    if (workerId) baseQuery.workerId = workerId;

    if (startDate || endDate) {
      baseQuery.createdAt = {};
      if (startDate) {
        (baseQuery.createdAt as Record<string, Date>).$gte = parseDateAsKST(
          startDate,
          false
        );
      }
      if (endDate) {
        (baseQuery.createdAt as Record<string, Date>).$lte = parseDateAsKST(
          endDate,
          true
        );
      }
    }

    const [
      statusCounts,
      priorityCounts,
      totalTasks,
      productTargetQuantity,
      completedTasks,
      overdueTasks,
      avgCompletionTime,
      tasksByDeviceType,
      tasksByProject,
      tasksByStepName,
      executionProgress
    ] = await Promise.all([
      Task.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Task.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$priority", count: { $sum: 1 } } }
      ]),
      Task.countDocuments(baseQuery),
      Task.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$projectId" } },
        {
          $lookup: {
            from: "projects",
            localField: "_id",
            foreignField: "_id",
            as: "project"
          }
        },
        { $unwind: "$project" },
        {
          $group: {
            _id: null,
            totalTargetQuantity: { $sum: "$project.targetQuantity" }
          }
        }
      ]),
      Task.countDocuments({ ...baseQuery, status: "COMPLETED" }),
      Task.countDocuments({
        ...baseQuery,
        status: { $in: ["PENDING", "ONGOING", "PAUSED"] },
        estimatedDuration: { $exists: true },
        $expr: {
          $gt: [
            { $subtract: [new Date(), "$createdAt"] },
            { $multiply: ["$estimatedDuration", 60000] }
          ]
        }
      }),
      Task.aggregate([
        {
          $match: {
            ...baseQuery,
            status: "COMPLETED",
            actualDuration: { $exists: true, $gt: 0 }
          }
        },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: "$actualDuration" },
            minDuration: { $min: "$actualDuration" },
            maxDuration: { $max: "$actualDuration" }
          }
        }
      ]),
      Task.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: "$deviceTypeId",
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
            }
          }
        },
        { $limit: 10 }
      ]),
      Task.aggregate([
        { $match: { ...baseQuery, projectId: { $exists: true } } },
        {
          $group: {
            _id: "$projectId",
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] }
            },
            ongoing: {
              $sum: { $cond: [{ $eq: ["$status", "ONGOING"] }, 1, 0] }
            }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Task.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: {
              recipeSnapshotId: "$recipeSnapshotId",
              stepOrder: "$stepOrder",
              status: "$status"
            },
            recipeTaskCount: { $count: {} }
          }
        },
        {
          $lookup: {
            from: "recipesnapshots",
            localField: "_id.recipeSnapshotId",
            foreignField: "_id",
            as: "recipeSnapshot"
          }
        },
        { $unwind: "$recipeSnapshot" },
        {
          $addFields: {
            stepName: {
              $arrayElemAt: [
                "$recipeSnapshot.steps.name",
                { $subtract: ["$_id.stepOrder", 1] }
              ]
            },
            status: "$_id.status"
          }
        },
        {
          $group: {
            _id: { stepName: "$stepName" },
            totalTaskCount: { $sum: "$recipeTaskCount" },
            completedTaskCount: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "COMPLETED"] },
                  "$recipeTaskCount",
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            stepName: "$_id.stepName",
            total: "$totalTaskCount",
            completed: "$completedTaskCount",
            completionRate: {
              $cond: [
                { $gt: ["$totalTaskCount", 0] },
                { $divide: ["$completedTaskCount", "$totalTaskCount"] },
                0
              ]
            }
          }
        }
      ]),
      Task.aggregate([
        {
          $match: {
            ...baseQuery,
            projectId: { $exists: true },
            recipeExecutionNumber: { $exists: true }
          }
        },
        {
          $group: {
            _id: {
              projectId: "$projectId",
              recipeId: "$recipeId",
              executionNumber: "$recipeExecutionNumber"
            },
            totalSteps: { $sum: 1 },
            completedSteps: {
              $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] }
            },
            isLastStepCompleted: {
              $max: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isLastStepInRecipe", true] },
                      { $eq: ["$status", "COMPLETED"] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalExecutions: { $sum: 1 },
            completedExecutions: { $sum: "$isLastStepCompleted" }
          }
        }
      ])
    ]);

    const statusStats: Record<string, number> = {
      PENDING: 0,
      ONGOING: 0,
      PAUSED: 0,
      COMPLETED: 0,
      FAILED: 0
    };
    (statusCounts as { _id?: string; count: number }[]).forEach((item) => {
      if (item._id) statusStats[item._id] = item.count;
    });

    const priorityStats: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0
    };
    (priorityCounts as { _id?: string; count: number }[]).forEach((item) => {
      if (item._id) priorityStats[item._id] = item.count;
    });

    const completionRate =
      totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : "0";

    const completionTimeStats = (
      avgCompletionTime as {
        avgDuration?: number;
        minDuration?: number;
        maxDuration?: number;
      }[]
    )[0] || {
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0
    };

    const executionStats = (
      executionProgress as {
        totalExecutions?: number;
        completedExecutions?: number;
      }[]
    )[0] || {
      totalExecutions: 0,
      completedExecutions: 0
    };
    const executionCompletionRate =
      (executionStats.totalExecutions ?? 0) > 0
        ? (
            ((executionStats.completedExecutions ?? 0) /
              (executionStats.totalExecutions ?? 1)) *
            100
          ).toFixed(2)
        : "0";

    return {
      overview: {
        totalTasks,
        completedTasks,
        targetQuantity:
          (productTargetQuantity as { totalTargetQuantity?: number }[])[0]
            ?.totalTargetQuantity || 0,
        pendingTasks: statusStats.PENDING,
        ongoingTasks: statusStats.ONGOING,
        pausedTasks: statusStats.PAUSED,
        failedTasks: statusStats.FAILED,
        overdueTasks,
        completionRate: parseFloat(completionRate)
      },
      byStatus: statusStats,
      byPriority: priorityStats,
      completionTime: {
        average: Math.round(completionTimeStats.avgDuration || 0),
        min: completionTimeStats.minDuration || 0,
        max: completionTimeStats.maxDuration || 0,
        unit: "minutes"
      },
      byDeviceType: (
        tasksByDeviceType as {
          _id: unknown;
          count: number;
          completed: number;
        }[]
      ).map((item) => ({
        deviceTypeId: item._id,
        total: item.count,
        completed: item.completed,
        completionRate:
          item.count > 0
            ? parseFloat(((item.completed / item.count) * 100).toFixed(2))
            : 0
      })),
      byProject: (
        tasksByProject as {
          _id: unknown;
          count: number;
          completed: number;
          pending: number;
          ongoing: number;
        }[]
      ).map((item) => ({
        projectId: item._id,
        total: item.count,
        completed: item.completed,
        pending: item.pending,
        ongoing: item.ongoing,
        completionRate:
          item.count > 0
            ? parseFloat(((item.completed / item.count) * 100).toFixed(2))
            : 0
      })),
      byStepName: tasksByStepName,
      executionProgress: {
        totalExecutions: executionStats.totalExecutions ?? 0,
        completedExecutions: executionStats.completedExecutions ?? 0,
        completionRate: parseFloat(executionCompletionRate)
      }
    };
  }

  async getGroupedTasks(query: TaskGroupedQuery): Promise<{
    items: Record<string, unknown>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const {
      projectStatus,
      taskStatus,
      startDate,
      endDate,
      search,
      page = "1",
      limit = "10"
    } = query;

    const taskQuery: Record<string, unknown> = {
      projectId: { $exists: true, $ne: null }
    };

    if (taskStatus) taskQuery.status = taskStatus;

    if (startDate || endDate) {
      taskQuery.createdAt = {};
      if (startDate) {
        (taskQuery.createdAt as Record<string, Date>).$gte = parseDateAsKST(
          startDate,
          false
        );
      }
      if (endDate) {
        (taskQuery.createdAt as Record<string, Date>).$lte = parseDateAsKST(
          endDate,
          true
        );
      }
    }

    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i");
      const projects = await Project.find({ name: searchRegex }).select("_id");
      const projectIds = projects.map((p) => p._id);
      const recipes = await Recipe.find({ name: searchRegex }).select("_id");
      const recipeIds = recipes.map((r) => r._id);
      const products = await Product.find({ name: searchRegex }).select("_id");
      const productIds = products.map((p) => p._id);

      if (
        projectIds.length > 0 ||
        recipeIds.length > 0 ||
        productIds.length > 0
      ) {
        taskQuery.$or = [];
        if (projectIds.length > 0) {
          (taskQuery.$or as unknown[]).push({
            projectId: { $in: projectIds }
          });
        }
        if (recipeIds.length > 0) {
          (taskQuery.$or as unknown[]).push({ recipeId: { $in: recipeIds } });
        }
        if (productIds.length > 0) {
          (taskQuery.$or as unknown[]).push({
            productId: { $in: productIds }
          });
        }
      }
    }

    const distinctProjectIds = await Task.distinct("projectId", taskQuery);

    const projectQuery: Record<string, unknown> = {
      _id: { $in: distinctProjectIds }
    };

    if (projectStatus) projectQuery.status = projectStatus;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const totalProjects = await Project.countDocuments(projectQuery);

    const projects = await Project.find(projectQuery)
      .populate("createdBy", "name email username")
      .populate(
        "productSnapshot",
        "name productNumber personInCharge customerName version remarks"
      )
      .populate("recipeSnapshot", "name recipeNumber version dwgNo remarks")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const groupedData: Record<string, unknown> = {};

    for (const project of projects) {
      const projectIdStr = (project._id as mongoose.Types.ObjectId).toString();

      const projectTaskQuery = {
        ...taskQuery,
        projectId: project._id
      };

      const tasks = await Task.find(projectTaskQuery)
        .populate("workerId", "name username email")
        .populate("deviceId", "name deviceName")
        .populate("deviceTypeId", "name")
        .populate({
          path: "recipeSnapshotId",
          populate: { path: "rawMaterials" }
        })
        .populate(
          "productSnapshotId",
          "name version customerName personInCharge department"
        )
        .sort({ createdAt: 1 });

      groupedData[projectIdStr] = {
        projectInfo: {
          _id: project._id,
          name: project.name,
          description: project.description,
          status: project.status,
          priority: project.priority,
          projectNumber: project.projectNumber,
          recipeSnapshot: project.recipeSnapshot,
          productSnapshot: project.productSnapshot,
          producedQuantity: project.producedQuantity,
          targetQuantity: project.targetQuantity,
          progress: project.progress,
          startDate: project.startDate,
          endDate: project.endDate,
          deadline: project.deadline,
          createdBy: project.createdBy,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        },
        recipes: {},
        summary: {
          totalTasks: tasks.length,
          byStatus: {
            PENDING: 0,
            ONGOING: 0,
            PAUSED: 0,
            COMPLETED: 0,
            FAILED: 0
          },
          byPriority: {
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0,
            URGENT: 0
          }
        }
      };

      const g = groupedData[projectIdStr] as {
        recipes: Record<string, unknown>;
        summary: {
          byStatus: Record<string, number>;
          byPriority: Record<string, number>;
        };
      };

      for (const task of tasks) {
        g.summary.byStatus[task.status]++;
        g.summary.byPriority[task.priority]++;

        const recipeSnapshot =
          task.recipeSnapshotId as unknown as IRecipeSnapshot;
        const recipeSnapshotId = recipeSnapshot._id.toString();

        if (!g.recipes[recipeSnapshotId]) {
          g.recipes[recipeSnapshotId] = {
            recipeInfo: {
              ...recipeSnapshot.toObject(),
              _id: recipeSnapshot._id,
              name: recipeSnapshot.name,
              version: recipeSnapshot.version,
              recipeId: task.recipeId
            },
            steps: {},
            summary: {
              totalTasks: 0,
              totalExecutions: task.totalRecipeExecutions,
              completedExecutions: 0,
              byStatus: {
                PENDING: 0,
                ONGOING: 0,
                PAUSED: 0,
                COMPLETED: 0,
                FAILED: 0
              }
            }
          };
        }

        const r = g.recipes[recipeSnapshotId] as {
          steps: Record<string, unknown>;
          summary: {
            totalTasks: number;
            byStatus: Record<string, number>;
            completedExecutions: number;
          };
        };

        const stepOrder = task.stepOrder.toString();
        if (!r.steps[stepOrder]) {
          const step = (
            recipeSnapshot as {
              steps: {
                order: number;
                _id?: unknown;
                name?: string;
                description?: string;
              }[];
            }
          ).steps.find((s) => s.order === task.stepOrder);
          r.steps[stepOrder] = {
            stepInfo: {
              _id: step?._id || task.recipeStepId,
              name: step?.name || "Unknown Step",
              description: step?.description,
              order: task.stepOrder,
              deviceTypeId: task.deviceTypeId,
              estimatedDuration: task.estimatedDuration
            },
            tasks: [] as unknown[],
            summary: {
              totalTasks: 0,
              byStatus: {
                PENDING: 0,
                ONGOING: 0,
                PAUSED: 0,
                COMPLETED: 0,
                FAILED: 0
              }
            }
          };
        }

        const st = r.steps[stepOrder] as {
          tasks: unknown[];
          summary: { totalTasks: number; byStatus: Record<string, number> };
        };
        st.tasks.push(task);
        st.summary.totalTasks++;
        st.summary.byStatus[task.status]++;

        r.summary.totalTasks++;
        r.summary.byStatus[task.status]++;

        if (task.isLastStepInRecipe && task.status === "COMPLETED") {
          r.summary.completedExecutions++;
        }
      }
    }

    return {
      items: groupedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalProjects,
        totalPages: Math.ceil(totalProjects / limitNum),
        hasNext: pageNum * limitNum < totalProjects,
        hasPrev: pageNum > 1
      }
    };
  }
}

export const taskService = new TaskService();
