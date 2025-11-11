import { Request, Response } from "express";
import { Project } from "../models/Project";
import { Recipe } from "../models/Recipe";
import { Product } from "../models/Product";
import { APIResponse, AuthenticatedRequest } from "../types";
import { SnapshotService } from "../services/snapshotService";
import { generateProjectName } from "../services/projectService";
import {
  generateTasksForProject,
  deleteProjectTasks
} from "../services/taskService";

/**
 * Get all projects with optional filtering and pagination
 * GET /api/projects?status=ACTIVE&page=1&limit=10
 */
export const getProjects = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;

    // Build query
    const query: any = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Project.countDocuments(query);

    // Get projects (snapshots contain all data, no need to populate products/recipes)
    const projects = await Project.find(query)
      .populate("createdBy", "name email username")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Projects retrieved successfully",
      data: {
        items: projects,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get projects error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get project by ID
 * GET /api/projects/:id
 */
export const getProjectById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id)
      .populate("createdBy", "name email username")
      .populate("productSnapshot", "name version originalProductId")
      .populate("recipeSnapshot", "name version originalRecipeId");

    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Project retrieved successfully",
      data: project
    };

    res.json(response);
  } catch (error) {
    console.error("Get project error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Create multiple projects in batch (products and/or recipes)
 * POST /api/projects
 * Body: {
 *   products: [{ productId, targetQuantity?, priority?, status?, deadline? }],
 *   recipes: [{ recipeId, targetQuantity?, priority?, status?, deadline? }],
 *   createdBy: string
 * }
 */
export const createProjectsBatch = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { products = [], recipes = [], createdBy } = req.body;

    // Validation: createdBy required
    if (!createdBy) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "CreatedBy is required"
      };
      res.status(400).json(response);
      return;
    }

    // Validation: At least one item required
    if (products.length === 0 && recipes.length === 0) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "At least one product or recipe is required"
      };
      res.status(400).json(response);
      return;
    }

    // Validation: Batch size limit (40 max)
    const totalItems = products.length + recipes.length;
    if (totalItems > 40) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Batch size limit exceeded. Maximum 40 projects per request"
      };
      res.status(400).json(response);
      return;
    }

    const createdProjects: any[] = [];
    const taskCounts: Record<string, number> = {};

    // Process products
    for (const item of products) {
      const {
        productId,
        targetQuantity = 1,
        priority = "MEDIUM",
        status = "PLANNING",
        deadline
      } = item;

      // Validate productId
      if (!productId) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Each product must have productId"
        };
        res.status(400).json(response);
        return;
      }

      // Fetch product to get name
      const product = await Product.findById(productId);
      if (!product) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: `Product not found: ${productId}`
        };
        res.status(404).json(response);
        return;
      }

      // Generate project name
      const projectName = generateProjectName(
        product.productName,
        undefined,
        targetQuantity
      );

      // Create project (snapshots deferred until ACTIVE)
      const project = new Project({
        name: projectName,
        description: "", // Leave empty
        targetQuantity,
        product: productId,
        producedQuantity: 0,
        status,
        priority,
        deadline: deadline ? new Date(deadline) : undefined,
        createdBy
      });

      // If status is ACTIVE, create snapshots and tasks immediately
      if (status === "ACTIVE") {
        // Create product snapshot
        const productSnapshot =
          await SnapshotService.getOrCreateProductSnapshot(productId);
        project.productSnapshot = productSnapshot._id;

        // Auto-set startDate
        if (!project.startDate) {
          project.startDate = new Date();
        }

        // Save project first (to get _id for tasks)
        await project.save();

        // Generate tasks
        const tasks = await generateTasksForProject(
          project,
          productSnapshot,
          undefined
        );
        taskCounts[(project._id as any).toString()] = tasks.length;
      } else {
        // For PLANNING status, just store reference temporarily
        // We need to set productSnapshot field but without creating snapshot
        // Actually, we can't set it yet since snapshots are created on ACTIVE
        // So leave it undefined for PLANNING
        await project.save();
      }

      await project.populate("createdBy", "name email username");
      createdProjects.push(project);
    }

    // Process recipes
    for (const item of recipes) {
      const {
        recipeId,
        targetQuantity = 1,
        priority = "MEDIUM",
        status = "PLANNING",
        deadline
      } = item;

      // Validate recipeId
      if (!recipeId) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Each recipe must have recipeId"
        };
        res.status(400).json(response);
        return;
      }

      // Fetch recipe to get name
      const recipe = await Recipe.findById(recipeId);
      if (!recipe) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: `Recipe not found: ${recipeId}`
        };
        res.status(404).json(response);
        return;
      }

      // Generate project name
      const projectName = generateProjectName(
        undefined,
        recipe.name,
        targetQuantity
      );

      // Create project (snapshots deferred until ACTIVE)
      const project = new Project({
        name: projectName,
        description: "", // Leave empty
        targetQuantity,
        recipe: recipeId,
        producedQuantity: 0,
        status,
        priority,
        deadline: deadline ? new Date(deadline) : undefined,
        createdBy
      });

      // If status is ACTIVE, create snapshots and tasks immediately
      if (status === "ACTIVE") {
        // Create recipe snapshot
        const recipeSnapshot = await SnapshotService.getOrCreateRecipeSnapshot(
          recipeId
        );
        project.recipeSnapshot = recipeSnapshot._id;

        // Auto-set startDate
        if (!project.startDate) {
          project.startDate = new Date();
        }

        // Save project first (to get _id for tasks)
        await project.save();

        // Generate tasks
        const tasks = await generateTasksForProject(
          project,
          undefined,
          recipeSnapshot
        );
        taskCounts[(project._id as any).toString()] = tasks.length;
      } else {
        // For PLANNING status, leave snapshot undefined
        await project.save();
      }

      await project.populate("createdBy", "name email username");
      createdProjects.push(project);
    }

    const response: APIResponse = {
      success: true,
      message: `${createdProjects.length} project(s) created successfully`,
      data: {
        projects: createdProjects,
        taskCounts
      }
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error("Create projects batch error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Update project
 * PUT /api/projects/:id
 *
 * Rules:
 * - If status is PLANNING: ALL fields can be changed
 * - If status is ACTIVE/ON_HOLD: Only description, deadline, status can be changed
 * - If changing from ACTIVE/ON_HOLD → PLANNING: Delete tasks, clear snapshots, enable full editing
 * - If changing to ACTIVE: Create snapshots and tasks
 */
export const updateProject = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      productId, // For changing product in PLANNING
      recipeId, // For changing recipe in PLANNING
      targetQuantity,
      description,
      deadline,
      status,
      priority
    } = req.body;

    const project = await Project.findById(id);

    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    const oldStatus = project.status;
    const isPlanning = oldStatus === "PLANNING";
    const isActivating = status === "ACTIVE" && oldStatus !== "ACTIVE";
    const isDeactivating =
      status === "PLANNING" &&
      (oldStatus === "ACTIVE" || oldStatus === "ON_HOLD");

    // Fields that can ALWAYS be updated
    if (description !== undefined) project.description = description;
    if (deadline !== undefined)
      project.deadline = deadline ? new Date(deadline) : undefined;
    if (status !== undefined) project.status = status;

    // If product/recipe is not mentioned in body, retain existing
    // This is important for ACTIVE projects to know which snapshot to use
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

    // Handle deactivation: ACTIVE/ON_HOLD → PLANNING
    if (isDeactivating) {
      // Delete all tasks
      const deletedCount = await deleteProjectTasks(project._id as any);
      console.log(`Deleted ${deletedCount} tasks for project ${project._id}`);

      // Clear snapshots
      project.productSnapshot = undefined;
      project.recipeSnapshot = undefined;

      // Reset producedQuantity
      project.producedQuantity = 0;

      // Now all fields are editable again (will be handled below)
    }

    // Fields that can be updated ONLY in PLANNING status
    if ((isPlanning || isDeactivating) && !isActivating) {
      // Allow changing product/recipe
      if (!!productIdToUse) {
        const product = await Product.findById(productId);
        if (!product) {
          const response: APIResponse = {
            success: false,
            error: "NOT_FOUND",
            message: `Product not found: ${productIdToUse}`
          };
          res.status(404).json(response);
          return;
        }

        // Clear recipe if switching to product
        project.recipeSnapshot = undefined;
        project.productSnapshot = undefined;
        project.recipe = undefined;
        project.product = productIdToUse as any;

        // Regenerate project name
        project.name = generateProjectName(
          product.productName,
          undefined,
          targetQuantity || project.targetQuantity
        );
      }

      if (!!recipeIdToUse) {
        const recipe = await Recipe.findById(recipeIdToUse);
        if (!recipe) {
          const response: APIResponse = {
            success: false,
            error: "NOT_FOUND",
            message: `Recipe not found: ${recipeIdToUse}`
          };
          res.status(404).json(response);
          return;
        }

        // Clear product if switching to recipe
        project.productSnapshot = undefined;
        project.recipeSnapshot = undefined;
        project.product = undefined;
        project.recipe = recipeIdToUse as any;

        // Regenerate project name
        project.name = generateProjectName(
          undefined,
          recipe.name,
          targetQuantity || project.targetQuantity
        );
      }

      if (targetQuantity !== undefined) {
        if (targetQuantity < 1) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message: "Target quantity must be at least 1"
          };
          res.status(400).json(response);
          return;
        }
        project.targetQuantity = targetQuantity;

        // Regenerate project name with new quantity
        // Determine if it's a product or recipe project
        const isProduct = !!productIdToUse || !!project.productSnapshot;
        if (isProduct && productIdToUse) {
          const product = await Product.findById(productIdToUse);
          if (product) {
            project.name = generateProjectName(
              product.productName,
              undefined,
              targetQuantity
            );
          }
        } else if (!isProduct && recipeIdToUse) {
          const recipe = await Recipe.findById(recipeIdToUse);
          if (recipe) {
            project.name = generateProjectName(
              undefined,
              recipe.name,
              targetQuantity
            );
          }
        }
      }

      if (priority !== undefined) project.priority = priority;
    }

    // Handle activation: → ACTIVE
    let createdTasks: any[] = [];
    if (isActivating) {
      // Auto-set startDate
      if (!project.startDate) {
        project.startDate = new Date();
      }

      // Determine if product or recipe project
      // Need to fetch the actual product/recipe to create snapshots
      if (productIdToUse !== undefined) {
        // Create product snapshot
        const productSnapshot =
          await SnapshotService.getOrCreateProductSnapshot(
            productIdToUse as any
          );
        project.productSnapshot = productSnapshot._id;

        // Save first to get project._id
        await project.save();

        // Generate tasks
        createdTasks = await generateTasksForProject(
          project,
          productSnapshot,
          undefined
        );
      } else if (recipeIdToUse !== undefined) {
        // Create recipe snapshot
        const recipeSnapshot = await SnapshotService.getOrCreateRecipeSnapshot(
          recipeIdToUse as any
        );
        project.recipeSnapshot = recipeSnapshot._id;

        // Save first to get project._id
        await project.save();

        // Generate tasks
        createdTasks = await generateTasksForProject(
          project,
          undefined,
          recipeSnapshot
        );
      } else {
        // Project must have been created with productId or recipeId
        // This shouldn't happen, but handle it
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Cannot activate project without product or recipe"
        };
        res.status(400).json(response);
        return;
      }
    }

    await project.save();
    await project.populate("createdBy", "name email username");
    await project.populate("productSnapshot", "name version");
    await project.populate("recipeSnapshot", "name version");

    const response: APIResponse = {
      success: true,
      message: isActivating
        ? `Project activated successfully. ${createdTasks.length} initial task(s) created.`
        : isDeactivating
        ? "Project deactivated successfully. All tasks deleted."
        : "Project updated successfully",
      data: {
        project,
        ...(isActivating && { tasksCreated: createdTasks.length }),
        ...(isDeactivating && { tasksDeleted: true })
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error("Update project error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Delete project
 * DELETE /api/projects/:id
 * Also deletes all associated tasks
 */
export const deleteProject = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id);

    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    // Delete all associated tasks first
    const deletedTaskCount = await deleteProjectTasks(project._id as any);

    // Delete project
    await Project.findByIdAndDelete(id);

    const response: APIResponse = {
      success: true,
      message: `Project deleted successfully. ${deletedTaskCount} task(s) deleted.`
    };

    res.json(response);
  } catch (error) {
    console.error("Delete project error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
