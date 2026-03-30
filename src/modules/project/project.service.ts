import { Product, ProductSnapshot } from "@modules/product";
import { Recipe } from "@modules/recipe";
import { taskService } from "@modules/task";
import { RecipeSnapshot, Task } from "@shared/models";
import { loggerService, realtimeService } from "@shared/services";
import { SnapshotService } from "@shared/services/snapshotService";
import { DateTime } from "@shared/utils";
import { Project } from "./project.model";
import { ProjectMonitoringData } from "./project.types";
import {
  projectDeviceConfigurationService,
  ProjectDeviceConfigurationServiceError,
  serializeDeviceConfigurationByDeviceType
} from "./project-device-configuration.service";

/**
 * Generate project name with quantity suffix
 * @param productName - Name of the product (if product-based project)
 * @param recipeName - Name of the recipe (if recipe-based project)
 * @param targetQuantity - Target quantity for the project
 * @returns Formatted project name: "Name (Qty: X)"
 */
export const generateProjectName = (
  productName?: string,
  recipeName?: string,
  targetQuantity: number = 1
): string => {
  const baseName = productName || recipeName || "Unnamed Project";
  return `${baseName} (Qty: ${targetQuantity})`;
};

/**
 * Generate unique project number with format: SMYY-MM-XXXX
 * Includes retry logic to handle potential duplicates
 * @param createdAt - Creation date for the project
 * @returns Formatted project number
 */
export const generateProjectNumber = async (
  createdAt: Date = DateTime
): Promise<string> => {
  const year = String(createdAt.getFullYear()).slice(-2);
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  const datePrefix = `SM${year}-${month}`;

  // Get start and end of the day for the query
  const startOfDay = new Date(createdAt);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(createdAt);
  endOfDay.setHours(23, 59, 59, 999);

  // Count projects created on the same month
  const latestProjectThisMonth = await Project.findOne({
    projectNumber: { $regex: `^${datePrefix}-\\d{4}$` }
  }).sort({ projectNumber: -1 });
  const count = latestProjectThisMonth
    ? parseInt(latestProjectThisMonth.projectNumber.split("-")[2] || "0", 10)
    : 0;

  // Generate sequential number (count + 1, padded to 4 digits)
  const sequentialNumber = String(count + 1).padStart(4, "0");
  return `${datePrefix}-${sequentialNumber}`;
};

/**
 * Validate that project has exactly one of productSnapshot or recipeSnapshot
 * @param productSnapshot - Product snapshot ID
 * @param recipeSnapshot - Recipe snapshot ID
 * @throws Error if validation fails
 */
export const validateProjectSnapshotExclusivity = (
  productSnapshot?: any,
  recipeSnapshot?: any
): void => {
  const hasProduct = !!productSnapshot;
  const hasRecipe = !!recipeSnapshot;

  if (!hasProduct && !hasRecipe) {
    throw new Error("Project must have exactly one product or one recipe");
  }

  if (hasProduct && hasRecipe) {
    throw new Error("Project cannot have both product and recipe. Choose one.");
  }
};

export class ProjectServiceError extends Error {
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
    this.name = "ProjectServiceError";
    this.statusCode = options.statusCode;
    this.errorCode = options.errorCode;
    this.data = options.data;
  }
}

export const buildProjectMonitoringData = (
  activeProjects: any[],
  tasks: any[]
): ProjectMonitoringData[] => {
  return activeProjects.map((project) => {
    const recipes = project.productSnapshot
      ? (project.productSnapshot as any).recipes.map((r: any) =>
          r.recipeSnapshotId._id.toString()
        )
      : [project.recipeSnapshot?._id.toString()];

    const projectTaskList = tasks.filter(
      (task) => task.projectId?.toString() === project.id.toString()
    );

    const recipeTasks = recipes.map((recipeId: string) => {
      const recipeInfo = project.productSnapshot
        ? (project.productSnapshot as any).recipes.find(
            (r: any) => r.recipeSnapshotId._id.toString() === recipeId
          ).recipeSnapshotId
        : project.recipeSnapshot;

      const tasksForThisRecipe = projectTaskList.filter(
        (task) => task.recipeSnapshotId?.toString() === recipeId
      );

      return {
        recipeInfo,
        tasks: tasksForThisRecipe
      };
    });

    const taskSummary = {
      total: projectTaskList.length,
      byStatus: {
        PENDING: projectTaskList.filter((t) => t.status === "PENDING").length,
        ONGOING: projectTaskList.filter((t) => t.status === "ONGOING").length,
        COMPLETED: projectTaskList.filter((t) => t.status === "COMPLETED")
          .length,
        PAUSED: projectTaskList.filter((t) => t.status === "PAUSED").length,
        FAILED: projectTaskList.filter((t) => t.status === "FAILED").length
      }
    };

    return {
      projectInfo: project,
      recipeTasks,
      taskSummary
    };
  });
};

export class ProjectService {
  async listProjects(params: {
    status?: string;
    priority?: string;
    page: number;
    limit: number;
  }) {
    const { status, priority, page, limit } = params;

    const query: any = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const skip = (page - 1) * limit;

    const total = await Project.countDocuments(query);

    const items = await Project.find(query)
      .populate("createdBy", "name email username")
      .populate("modifiedBy", "name email username")
      .populate("product", "name designNumber")
      .populate("recipe", "name recipeNumber")
      .populate("productSnapshot", "name version originalProductId")
      .populate("recipeSnapshot", "name version originalRecipeId")
      .skip(skip)
      .limit(limit)
      .sort({ startDate: -1, createdAt: -1 });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async getProjectById(id: string) {
    const project = await Project.findById(id)
      .populate("createdBy", "name email username")
      .populate("modifiedBy", "name email username")
      .populate("product", "name designNumber")
      .populate("recipe", "name recipeNumber")
      .populate("productSnapshot", "name version originalProductId")
      .populate("recipeSnapshot", "name version originalRecipeId");

    if (!project) {
      throw new ProjectServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Project not found"
      });
    }

    return project;
  }

  async createProjectsBatch(params: {
    products?: any[];
    recipes?: any[];
    createdBy?: string;
    modifiedBy?: string;
  }) {
    const { products = [], recipes = [], createdBy, modifiedBy } = params;

    if (!createdBy) {
      throw new ProjectServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "CreatedBy is required"
      });
    }

    if (products.length === 0 && recipes.length === 0) {
      throw new ProjectServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "At least one product or recipe is required"
      });
    }

    const totalItems = products.length + recipes.length;
    if (totalItems > 40) {
      throw new ProjectServiceError({
        statusCode: 400,
        errorCode: "VALIDATION_ERROR",
        message: "Batch size limit exceeded. Maximum 40 projects per request"
      });
    }

    const createdProjects: any[] = [];
    const taskCounts: Record<string, number> = {};

    for (const item of products) {
      const {
        productId,
        targetQuantity = 1,
        priority = "MEDIUM",
        status = "PLANNING",
        deadline
      } = item;

      if (!productId) {
        throw new ProjectServiceError({
          statusCode: 400,
          errorCode: "VALIDATION_ERROR",
          message: "Each product must have productId"
        });
      }

      const product = await Product.findById(productId);
      if (!product) {
        throw new ProjectServiceError({
          statusCode: 404,
          errorCode: "NOT_FOUND",
          message: `Product not found: ${productId}`
        });
      }

      const projectName = generateProjectName(
        product.productName,
        undefined,
        targetQuantity
      );

      const project = new Project({
        name: projectName,
        description: "",
        targetQuantity,
        product: productId,
        producedQuantity: 0,
        status,
        priority,
        deadline: deadline ? new Date(deadline) : undefined,
        createdBy,
        modifiedBy
      });

      if (status === "ACTIVE") {
        const productSnapshot =
          await SnapshotService.getOrCreateProductSnapshot(productId);
        project.productSnapshot = productSnapshot._id;

        if (!project.startDate) {
          project.startDate = new Date();
        }

        await project.save();

        const tasks = await taskService.generateTasksForProject(
          project,
          productSnapshot,
          undefined
        );
        taskCounts[(project._id as any).toString()] = tasks.length;
      } else {
        await project.save();
      }

      await project.populate("createdBy", "name email username");
      createdProjects.push(project);
    }

    for (const item of recipes) {
      const {
        recipeId,
        targetQuantity = 1,
        priority = "MEDIUM",
        status = "PLANNING",
        deadline
      } = item;

      if (!recipeId) {
        throw new ProjectServiceError({
          statusCode: 400,
          errorCode: "VALIDATION_ERROR",
          message: "Each recipe must have recipeId"
        });
      }

      const recipe = await Recipe.findById(recipeId);
      if (!recipe) {
        throw new ProjectServiceError({
          statusCode: 404,
          errorCode: "NOT_FOUND",
          message: `Recipe not found: ${recipeId}`
        });
      }

      const projectName = generateProjectName(
        undefined,
        recipe.name,
        targetQuantity
      );

      const project = new Project({
        name: projectName,
        description: "",
        targetQuantity,
        recipe: recipeId,
        producedQuantity: 0,
        status,
        priority,
        deadline: deadline ? new Date(deadline) : undefined,
        createdBy,
        modifiedBy
      });

      if (status === "ACTIVE") {
        const recipeSnapshot = await SnapshotService.getOrCreateRecipeSnapshot(
          recipeId
        );
        project.recipeSnapshot = recipeSnapshot._id;

        if (!project.startDate) {
          project.startDate = new Date();
        }

        await project.save();

        const tasks = await taskService.generateTasksForProject(
          project,
          undefined,
          recipeSnapshot
        );
        taskCounts[(project._id as any).toString()] = tasks.length;
      } else {
        await project.save();
      }

      await project.populate("createdBy", "name email username");
      createdProjects.push(project);
    }

    return {
      projects: createdProjects,
      taskCounts
    };
  }

  async updateProject(params: { id: string; body: any; userId?: string }) {
    const { id, body, userId } = params;
    const {
      productId,
      recipeId,
      targetQuantity,
      description,
      deadline,
      status,
      priority
    } = body;

    const project = await Project.findById(id);

    if (!project) {
      throw new ProjectServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Project not found"
      });
    }

    const oldStatus = project.status;
    const isPlanning = oldStatus === "PLANNING";
    const isActivating = status === "ACTIVE" && oldStatus !== "ACTIVE";
    const isDeactivating =
      status === "PLANNING" &&
      (oldStatus === "ACTIVE" || oldStatus === "ON_HOLD");

    if (description !== undefined) project.description = description;
    if (deadline !== undefined) {
      project.deadline = deadline ? new Date(deadline) : undefined;
    }
    if (status !== undefined) project.status = status;

    project.modifiedBy = userId as any;

    let productIdToUse: string;
    let recipeIdToUse: string;
    if (recipeId) {
      productIdToUse = "";
      recipeIdToUse = recipeId;
    } else if (productId) {
      productIdToUse = productId;
      recipeIdToUse = "";
    } else {
      productIdToUse = project.product?.toString() || "";
      recipeIdToUse = project.recipe?.toString() || "";
    }

    if (isDeactivating) {
      const deletedCount = await taskService.deleteProjectTasks(
        project._id as any
      );
      loggerService.info(
        `Deleted ${deletedCount} tasks for project ${project._id}`
      );

      project.productSnapshot = undefined;
      project.recipeSnapshot = undefined;
      project.producedQuantity = 0;
    }

    if ((isPlanning || isDeactivating) && !isActivating) {
      if (!!productIdToUse) {
        const product = await Product.findById(productIdToUse);
        if (!product) {
          throw new ProjectServiceError({
            statusCode: 404,
            errorCode: "NOT_FOUND",
            message: `Product not found: ${productIdToUse}`
          });
        }

        project.recipeSnapshot = undefined;
        project.productSnapshot = undefined;
        project.recipe = undefined;
        project.product = productIdToUse as any;

        project.name = generateProjectName(
          product.productName,
          undefined,
          targetQuantity || project.targetQuantity
        );
      }

      if (!!recipeIdToUse) {
        const recipeDoc = await Recipe.findById(recipeIdToUse);
        if (!recipeDoc) {
          throw new ProjectServiceError({
            statusCode: 404,
            errorCode: "NOT_FOUND",
            message: `Recipe not found: ${recipeIdToUse}`
          });
        }

        project.productSnapshot = undefined;
        project.recipeSnapshot = undefined;
        project.product = undefined;
        project.recipe = recipeIdToUse as any;

        project.name = generateProjectName(
          undefined,
          recipeDoc.name,
          targetQuantity || project.targetQuantity
        );
      }

      if (targetQuantity !== undefined) {
        if (targetQuantity < 1) {
          throw new ProjectServiceError({
            statusCode: 400,
            errorCode: "VALIDATION_ERROR",
            message: "Target quantity must be at least 1"
          });
        }
        project.targetQuantity = targetQuantity;

        const isProductProject = !!productIdToUse || !!project.productSnapshot;
        if (isProductProject && productIdToUse) {
          const product = await Product.findById(productIdToUse);
          if (product) {
            project.name = generateProjectName(
              product.productName,
              undefined,
              targetQuantity
            );
          }
        } else if (!isProductProject && recipeIdToUse) {
          const recipeDoc = await Recipe.findById(recipeIdToUse);
          if (recipeDoc) {
            project.name = generateProjectName(
              undefined,
              recipeDoc.name,
              targetQuantity
            );
          }
        }
      }

      if (priority !== undefined) {
        project.priority = priority;
      }
    }

    let createdTasks: any[] = [];
    let tasksDeleted = false;

    if (isActivating) {
      const configDoc =
        await projectDeviceConfigurationService.getByProjectId(id);
      const byDeviceTypeForStart = configDoc
        ? serializeDeviceConfigurationByDeviceType(configDoc.byDeviceType)
        : {};

      try {
        await projectDeviceConfigurationService.validateCoverageForStart(
          id,
          byDeviceTypeForStart
        );
      } catch (err) {
        if (err instanceof ProjectDeviceConfigurationServiceError) {
          throw new ProjectServiceError({
            statusCode: err.statusCode,
            errorCode: err.errorCode,
            message: err.message
          });
        }
        throw err;
      }

      if (!project.startDate) {
        project.startDate = new Date();
      }

      if (!!productIdToUse) {
        const productSnapshot =
          await SnapshotService.getOrCreateProductSnapshot(
            productIdToUse as any
          );
        project.productSnapshot = productSnapshot._id;

        await project.save();

        createdTasks = await taskService.generateTasksForProject(
          project,
          productSnapshot,
          undefined
        );
      } else if (!!recipeIdToUse) {
        const recipeSnapshot = await SnapshotService.getOrCreateRecipeSnapshot(
          recipeIdToUse as any
        );
        project.recipeSnapshot = recipeSnapshot._id;

        await project.save();

        createdTasks = await taskService.generateTasksForProject(
          project,
          undefined,
          recipeSnapshot
        );
      } else {
        throw new ProjectServiceError({
          statusCode: 400,
          errorCode: "VALIDATION_ERROR",
          message: "Cannot activate project without product or recipe"
        });
      }
    }

    if (project.status === "ACTIVE") {
      if (priority !== undefined) {
        project.priority = priority;

        await Task.updateMany(
          { projectId: project._id },
          { $set: { priority } }
        );
      }

      if (
        !!productIdToUse &&
        targetQuantity !== undefined &&
        targetQuantity !== project.targetQuantity
      ) {
        const productSnapshot = await ProductSnapshot.findById(
          project.productSnapshot as any
        );
        if (!productSnapshot) {
          throw new ProjectServiceError({
            statusCode: 404,
            errorCode: "NOT_FOUND",
            message: `Product snapshot not found: ${project.productSnapshot}`
          });
        }

        project.targetQuantity = targetQuantity;
        project.name = generateProjectName(
          productSnapshot.name,
          undefined,
          targetQuantity || project.targetQuantity
        );

        await taskService.deleteProjectTasks(project._id as any);
        createdTasks = await taskService.generateTasksForProject(
          project,
          productSnapshot,
          undefined
        );
        tasksDeleted = true;
      } else if (
        !!recipeIdToUse &&
        targetQuantity !== undefined &&
        targetQuantity !== project.targetQuantity
      ) {
        const recipeSnapshot = await RecipeSnapshot.findById(
          project.recipeSnapshot as any
        );
        if (!recipeSnapshot) {
          throw new ProjectServiceError({
            statusCode: 404,
            errorCode: "NOT_FOUND",
            message: `Recipe snapshot not found: ${project.recipeSnapshot}`
          });
        }

        project.targetQuantity = targetQuantity;
        project.name = generateProjectName(
          undefined,
          recipeSnapshot.name,
          targetQuantity || project.targetQuantity
        );

        await taskService.deleteProjectTasks(project._id as any);
        createdTasks = await taskService.generateTasksForProject(
          project,
          undefined,
          recipeSnapshot
        );
        tasksDeleted = true;
      }
    }

    await project.save();
    await project.populate("createdBy", "name email username");
    await project.populate("productSnapshot", "name version");
    await project.populate("recipeSnapshot", "name version");

    await realtimeService.broadcastProjectUpdate(project.toObject());

    return {
      project,
      isActivating,
      isDeactivating,
      createdTasksCount: createdTasks.length,
      tasksDeleted
    };
  }

  async deleteProject(params: { id: string; userId?: string }) {
    const { id, userId } = params;

    const project = await Project.findById(id);

    if (!project) {
      throw new ProjectServiceError({
        statusCode: 404,
        errorCode: "NOT_FOUND",
        message: "Project not found"
      });
    }

    const deletedTaskCount = await taskService.deleteProjectTasks(
      project._id as any
    );

    project.modifiedBy = userId as any;
    await project.save();

    await Project.findOneAndDelete({ _id: id });

    return { deletedTaskCount };
  }

  async getActiveProjectMonitorData(): Promise<ProjectMonitoringData[]> {
    const activeProjects = await Project.find({ status: "ACTIVE" })
      .populate({
        path: "productSnapshot",
        populate: { path: "recipes.recipeSnapshotId" }
      })
      .populate("recipeSnapshot")
      .sort({ deadline: 1, createdAt: 1 });

    const tasks = await Task.find({
      projectId: { $in: activeProjects.map((p) => p._id) }
    })
      .populate("deviceId", "name")
      .populate("deviceTypeId", "name")
      .populate("workerId", "name");

    return buildProjectMonitoringData(activeProjects, tasks);
  }
}

export const projectService = new ProjectService();
