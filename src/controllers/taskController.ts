import { Request, Response } from "express";
import mongoose from "mongoose";
import { Task } from "../models/Task";
import { Project } from "../models/Project";
import { Recipe } from "../models/Recipe";
import { Product } from "../models/Product";
import { APIResponse, AuthenticatedRequest } from "../types";
import { Device, IRecipeSnapshot, ProductSnapshot } from "../models";
import { realtimeService } from "../services/realtimeService";
import { roundToTwoDecimals } from "../utils/helpers";

export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      status,
      deviceId,
      deviceTypeId,
      projectId,
      recipeId,
      productId,
      workerId,
      search,
      includePendingAndPartial, // ⭐ NEW: Support partial completion queries
      page = 1,
      limit = 10
    } = req.query;

    const query: any = {};

    // ⭐ Special query for partial completions
    if (includePendingAndPartial === "true") {
      // Return PENDING, ONGOING, PAUSED tasks + COMPLETED tasks with progress < 100
      query.$or = [
        { status: "PENDING" },
        { status: "ONGOING" },
        { status: "PAUSED" },
        { status: "COMPLETED", progress: { $lt: 100 } }
      ];
    } else if (status) {
      query.status = status;
    }

    if (deviceId) query.deviceId = deviceId;
    if (deviceTypeId) query.deviceTypeId = deviceTypeId;
    if (projectId) query.projectId = projectId;
    if (recipeId) query.recipeId = recipeId;
    if (productId) query.productId = productId;
    if (workerId) query.workerId = workerId;

    // Text search support for recipe/product names
    let recipeIds: any[] = [];
    let productIds: any[] = [];

    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i"); // Case-insensitive search

      // Find matching recipes
      const recipes = await Recipe.find({
        name: searchRegex
      }).select("_id");
      recipeIds = recipes.map((r) => r._id);

      // Find matching products
      const products = await Product.find({
        name: searchRegex
      }).select("_id");
      productIds = products.map((p) => p._id);

      // Add search conditions to query
      if (recipeIds.length > 0 || productIds.length > 0) {
        const searchConditions = [];

        if (recipeIds.length > 0) {
          searchConditions.push({ recipeId: { $in: recipeIds } });
        }

        if (productIds.length > 0) {
          searchConditions.push({ productId: { $in: productIds } });
        }

        // Also search in task title
        searchConditions.push({ title: searchRegex });

        // Merge with existing $or from includePendingAndPartial
        if (query.$or) {
          query.$and = [{ $or: query.$or }, { $or: searchConditions }];
          delete query.$or;
        } else {
          query.$or = searchConditions;
        }
      } else {
        // No matching recipes/products, but still search in task title
        if (query.$or) {
          query.$and = [{ $or: query.$or }, { title: searchRegex }];
          delete query.$or;
        } else {
          query.title = searchRegex;
        }
      }
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query)
      .populate("projectId", "name status priority deadline")
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
      .populate("productSnapshotId", "name version customerName personInCharge department")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Tasks retrieved successfully",
      data: {
        items: tasks,
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
    console.error("Get tasks error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const getTaskById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const task = await Task.findById(id)
      .populate("projectId")
      .populate("workerId", "name username")
      .populate({
        path: "recipeSnapshotId",
        select: "name version steps",
        populate: {
          path: "rawMaterials",
          select: "quantityRequired name rawMaterialNumber specification"
        }
      })
      .populate("productSnapshotId", "name version customerName personInCharge department")
      .populate("dependentTask", "title status");

    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Task retrieved successfully",
      data: task
    };

    res.json(response);
  } catch (error) {
    console.error("Get task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const createTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
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
    } = req.body;

    // Validation
    if (!title || (!recipeId && !productId)) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Title and either recipeId or productId are required"
      };
      res.status(400).json(response);
      return;
    }

    // Cannot provide both recipeId and productId
    if (recipeId && productId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message:
          "Cannot provide both recipeId and productId. Use one or the other."
      };
      res.status(400).json(response);
      return;
    }

    let recipeStep: any = null;
    let deviceTypeId: any = null;
    let taskEstimatedDuration: number | undefined = estimatedDuration;
    let recipeSnapshotId: any = null;
    let productSnapshotId: any = null;
    let stepOrder: number = 1;
    let isLastStepInRecipe: boolean = false;
    let totalExecutions: number = 1;
    let selectedRecipeId: any = recipeId;

    // Check if this is a project task or standalone task
    if (projectId) {
      // PROJECT TASK: Should already have tasks generated by updateProject
      // This path is for manual task creation within existing projects
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message:
          "Project tasks are auto-generated on project activation. Use standalone task creation instead."
      };
      res.status(400).json(response);
      return;
    } else {
      // STANDALONE TASK: Can be either recipe or product
      const { SnapshotService } = await import("../services/snapshotService");

      if (productId) {
        // STANDALONE PRODUCT TASK
        const product = await Product.findById(productId);

        if (!product) {
          const response: APIResponse = {
            success: false,
            error: "NOT_FOUND",
            message: "Product not found"
          };
          res.status(404).json(response);
          return;
        }

        // Get first recipe from product
        if (!product.recipes || product.recipes.length === 0) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message: "Product does not have any recipes"
          };
          res.status(400).json(response);
          return;
        }

        const firstProductRecipe = product.recipes[0];
        selectedRecipeId = firstProductRecipe.recipeId;

        // Fetch the recipe to validate
        const recipe = await Recipe.findById(selectedRecipeId);

        if (!recipe) {
          const response: APIResponse = {
            success: false,
            error: "NOT_FOUND",
            message: "First recipe in product not found"
          };
          res.status(404).json(response);
          return;
        }

        // Create product snapshot
        const productSnapshot =
          await SnapshotService.getOrCreateProductSnapshot(productId);
        productSnapshotId = productSnapshot._id;

        // Create recipe snapshot
        const recipeSnapshot = await SnapshotService.getOrCreateRecipeSnapshot(
          selectedRecipeId
        );
        recipeSnapshotId = recipeSnapshot._id;

        // For standalone product tasks, use fixed 1 execution
        // (Project tasks use product.targetQuantity * recipe.quantity)
        totalExecutions = 1;

        // Find recipe step in snapshot
        recipeStep = recipeSnapshot.steps[0]; // Default to first step

        deviceTypeId = recipeStep.deviceTypeId;
        taskEstimatedDuration =
          estimatedDuration || recipeStep.estimatedDuration;
        stepOrder = recipeStep.order;

        // Determine if this is the last step
        const maxStepOrder = Math.max(
          ...recipeSnapshot.steps.map((s: any) => s.order)
        );
        isLastStepInRecipe = stepOrder === maxStepOrder;
      } else {
        // STANDALONE RECIPE TASK
        const recipe = await Recipe.findById(recipeId);

        if (!recipe) {
          const response: APIResponse = {
            success: false,
            error: "NOT_FOUND",
            message: "Recipe not found"
          };
          res.status(404).json(response);
          return;
        }

        // Create recipe snapshot using SnapshotService
        const recipeSnapshot = await SnapshotService.getOrCreateRecipeSnapshot(
          recipeId
        );
        recipeSnapshotId = recipeSnapshot._id;

        // Find recipe step in snapshot
        recipeStep = recipeSnapshot.steps[0]; // Default to first step

        deviceTypeId = recipeStep.deviceTypeId;
        taskEstimatedDuration =
          estimatedDuration || recipeStep.estimatedDuration;
        stepOrder = recipeStep.order;

        // Determine if this is the last step
        const maxStepOrder = Math.max(
          ...recipeSnapshot.steps.map((s: any) => s.order)
        );
        isLastStepInRecipe = stepOrder === maxStepOrder;

        // Single execution for standalone recipe
        totalExecutions = 1;
      }
    }

    // Extract deviceTypeId from recipe step
    if (!deviceTypeId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Recipe step does not have a deviceTypeId"
      };
      res.status(400).json(response);
      return;
    }

    // Create standalone task with execution tracking
    const task = new Task({
      title,
      description,
      projectId: undefined, // Standalone tasks have no projectId
      recipeId: selectedRecipeId,
      productId: productId || undefined,
      recipeSnapshotId,
      productSnapshotId: productSnapshotId || undefined,
      recipeStepId: recipeStep ? recipeStep._id : undefined,
      recipeExecutionNumber: 1, // Standalone tasks start at execution 1
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
      { path: "productSnapshotId", select: "name version" },
      { path: "recipeSnapshotId", select: "name version" }
    ]);

    // 🆕 Broadcast task creation in real-time
    await realtimeService.broadcastTaskAssignment(task.toObject());

    const response: APIResponse = {
      success: true,
      message: `Standalone task created successfully (Execution 1/${totalExecutions})`,
      data: {
        task,
        executionInfo: {
          executionNumber: 1,
          totalExecutions: totalExecutions,
          isProduct: !!productId,
          isLastStep: isLastStepInRecipe
        }
      }
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error("Create task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const updateTaskStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes, startTime, endTime, progress, workerId, deviceId } =
      req.body;

    const task = await Task.findById(id);

    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    if (status === "ONGOING" && !workerId && !task.workerId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "workerId is required to set task status to ONGOING"
      };
      res.status(400).json(response);
      return;
    }
    if (status === "ONGOING" && !deviceId && !task.deviceId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "deviceId is required to set task status to ONGOING"
      };
      res.status(400).json(response);
      return;
    }

    if (status) task.status = status;
    if (notes) task.notes = notes;
    if (startTime) task.startedAt = new Date(startTime);
    if (endTime) task.completedAt = new Date(endTime);
    if (progress !== undefined) task.progress = progress;

    // Calculate actual duration if completed
    if (status === "COMPLETED" && task.startedAt && task.completedAt) {
      task.actualDuration = Math.floor(
        (task.completedAt.getTime() - task.startedAt.getTime()) / 60000
      );
    }

    await task.save();
    await task.populate("projectId workerId");

    if (status == "COMPLETED" || status == "FAILED") {
      // Update Device currentTask to null if assigned
      if (task.deviceId) {
        const device = await Device.findById(task.deviceId);
        if (device) {
          device.currentTask = undefined;
          device.currentUser = undefined;
          await device.save();
        }
      }
    }

    const response: APIResponse = {
      success: true,
      message: "Task status updated successfully",
      data: task
    };

    res.json(response);
  } catch (error) {
    console.error("Update task status error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Update task with partial fields
 * PATCH /api/tasks/:id
 *
 * Used to update progress during task execution without changing status.
 * Use dedicated endpoints (start, resume, pause, complete, fail) for status changes.
 */
export const updateTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      status,
      priority,
      notes,
      mediaFiles,
      deviceId,
      workerId,
      pausedDuration,
      startedAt,
      completedAt,
      progress // ⭐ Support progress updates
    } = req.body;

    const task = await Task.findById(id);

    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    if (status === "ONGOING" && !workerId && !task.workerId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "workerId is required to set task status to ONGOING"
      };
      res.status(400).json(response);
      return;
    }
    if (status === "ONGOING" && !deviceId && !task.deviceId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "deviceId is required to set task status to ONGOING"
      };
      res.status(400).json(response);
      return;
    }

    // Update allowed fields
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (notes !== undefined) task.notes = notes;
    if (mediaFiles !== undefined) task.mediaFiles = mediaFiles;
    if (deviceId !== undefined) task.deviceId = deviceId;
    if (workerId !== undefined) task.workerId = workerId;
    if (pausedDuration !== undefined) task.pausedDuration = pausedDuration;
    if (startedAt !== undefined)
      task.startedAt = startedAt ? new Date(startedAt) : undefined;
    if (completedAt !== undefined)
      task.completedAt = completedAt ? new Date(completedAt) : undefined;

    // ⭐ Support progress updates (e.g., worker updates from 30% to 50%)
    if (progress !== undefined) {
      task.progress = progress;
    }

    // Recalculate actual duration if both start and complete times are set
    if (task.startedAt && task.completedAt) {
      task.actualDuration = Math.floor(
        (task.completedAt.getTime() - task.startedAt.getTime()) / 60000
      );
    }

    await task.save();
    await task.populate([
      { path: "projectId", select: "name status" },
      { path: "workerId", select: "name username email" },
      { path: "deviceId", select: "name deviceName" },
      { path: "recipeSnapshotId", select: "name version" },
      { path: "productSnapshotId", select: "name version" }
    ]);

    // 🆕 Broadcast task status change in real-time
    if (status !== undefined) {
      await realtimeService.broadcastTaskStatusChange(task.toObject());
    }

    const response: APIResponse = {
      success: true,
      message: "Task updated successfully",
      data: task
    };

    res.json(response);
  } catch (error: any) {
    console.error("Update task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const deleteTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { cascadeDelete = "false" } = req.query; // Optional: cascade delete dependent tasks

    // Find the task first (don't delete yet)
    const task = await Task.findById(id);

    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    // Check for dependent tasks (tasks that depend on this task)
    const dependentTasks = await Task.find({
      dependentTask: task._id
    });

    // If there are dependent tasks and cascadeDelete is not enabled, prevent deletion
    if (dependentTasks.length > 0 && cascadeDelete !== "true") {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: `Cannot delete task: ${dependentTasks.length} task(s) depend on this task. Use cascadeDelete=true to delete dependent tasks as well.`,
        data: {
          dependentTasksCount: dependentTasks.length,
          dependentTasks: dependentTasks.map((t) => ({
            _id: t._id,
            title: t.title,
            status: t.status
          }))
        }
      };
      res.status(400).json(response);
      return;
    }

    const taskId = task._id as mongoose.Types.ObjectId;
    const projectId = task.projectId;
    const deviceId = task.deviceId;

    // Store task data for realtime broadcast before deletion
    const taskData = task.toObject();

    // If cascadeDelete is enabled, delete all dependent tasks recursively
    let deletedDependentTasks: any[] = [];
    if (cascadeDelete === "true" && dependentTasks.length > 0) {
      const deleteDependentTasksRecursively = async (
        taskIds: mongoose.Types.ObjectId[]
      ) => {
        const tasksToDelete = await Task.find({
          _id: { $in: taskIds }
        });

        for (const depTask of tasksToDelete) {
          const depTaskId = depTask._id as mongoose.Types.ObjectId;

          // Find tasks that depend on this dependent task
          const nextDependentTasks = await Task.find({
            dependentTask: depTaskId
          });

          if (nextDependentTasks.length > 0) {
            // Recursively delete nested dependent tasks
            await deleteDependentTasksRecursively(
              nextDependentTasks.map((t) => t._id as mongoose.Types.ObjectId)
            );
          }

          // Clean up device reference if assigned
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
      // If not cascading, update dependent tasks to remove the dependency
      // This allows them to become independent (first-step tasks)
      await Task.updateMany(
        { dependentTask: taskId },
        { $unset: { dependentTask: "" } }
      );
    }

    // Clean up device reference if task is assigned to a device
    if (deviceId) {
      const device = await Device.findById(deviceId);
      if (device && device.currentTask?.toString() === taskId.toString()) {
        device.currentTask = undefined;
        device.currentUser = undefined;
        await device.save();
      }
    }

    // Delete the task
    await Task.findByIdAndDelete(taskId);

    // Recalculate project metrics if task was part of a project
    let updatedProject = null;
    if (projectId) {
      const { recalculateProjectMetrics } = await import(
        "../services/taskService"
      );
      updatedProject = await recalculateProjectMetrics(projectId);

      // Broadcast project update
      if (updatedProject) {
        await realtimeService.broadcastProjectUpdate(updatedProject.toObject());
      }
    }

    // Broadcast task deletion
    await realtimeService.broadcastTaskStatusChange(taskData);

    const response: APIResponse = {
      success: true,
      message: `Task deleted successfully${
        deletedDependentTasks.length > 0
          ? `. ${deletedDependentTasks.length} dependent task(s) also deleted.`
          : dependentTasks.length > 0
          ? `. ${dependentTasks.length} dependent task(s) dependency removed.`
          : ""
      }`,
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

    res.json(response);
  } catch (error: any) {
    console.error("Delete task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Start a new task
 * POST /api/tasks/:id/start
 */
export const startTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { workerId, deviceId } = req.body;

    // Find task
    const task = await Task.findById(id);
    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate task is in PENDING status
    if (task.status !== "PENDING") {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: `Task is already ${task.status.toLowerCase()}. Only PENDING tasks can be started.`
      };
      res.status(400).json(response);
      return;
    }

    // Validate workerId
    if (!workerId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "workerId is required to start a task"
      };
      res.status(400).json(response);
      return;
    }

    // Update task to ONGOING
    task.status = "ONGOING";
    task.workerId = workerId;
    if (deviceId) {
      task.deviceId = deviceId;
      const device = await Device.findById(deviceId);
      if (device) {
        device.currentTask = task.id;
        device.currentUser = workerId;
        await device.save();
      }
    }
    task.startedAt = new Date();

    // Initialize progress to 0 only if not already set
    if (task.progress === undefined || task.progress === null) {
      task.progress = 0;
    }

    await task.save();
    await task.populate([
      { path: "projectId", select: "name status priority" },
      { path: "workerId", select: "name username email" },
      { path: "deviceId", select: "name deviceName ipAddress status" },
      { path: "recipeSnapshotId", select: "name version steps" },
      { path: "productSnapshotId", select: "name version" }
    ]);

    const response: APIResponse = {
      success: true,
      message: "Task started successfully",
      data: task
    };

    if (task) {
      await realtimeService.broadcastTaskStatusChange(task.toObject());
    }

    res.json(response);
  } catch (error: any) {
    console.error("Start task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Resume a paused or partially completed task
 * POST /api/tasks/:id/resume
 *
 * ⚠️ CRITICAL: This endpoint MUST preserve the existing progress value!
 */
export const resumeTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    // ✅ NO REQUEST BODY NEEDED - Resume preserves existing worker/device assignment

    // Find task
    const task = await Task.findById(id);
    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate task can be resumed (PAUSED or COMPLETED with progress < 100 or FAILED)
    if (!["PAUSED", "COMPLETED", "FAILED"].includes(task.status)) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: `Cannot resume task with status ${task.status}. Only PAUSED, COMPLETED (partial), or FAILED tasks can be resumed.`
      };
      res.status(400).json(response);
      return;
    }

    // For completed tasks, only allow resume if progress < 100
    if (task.status === "COMPLETED" && task.progress >= 100) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message:
          "Cannot resume a fully completed task (progress = 100%). Create a new task instead."
      };
      res.status(400).json(response);
      return;
    }

    // ⭐ CRITICAL: Only update status to ONGOING
    // DO NOT modify progress - keep existing value!
    // DO NOT modify workerId/deviceId - already assigned when task was started!
    task.status = "ONGOING";

    await task.save();
    await task.populate([
      { path: "projectId", select: "name status priority" },
      { path: "workerId", select: "name username email" },
      { path: "deviceId", select: "name deviceName ipAddress status" },
      { path: "recipeSnapshotId", select: "name version steps" },
      { path: "productSnapshotId", select: "name version" }
    ]);

    const response: APIResponse = {
      success: true,
      message: `Task resumed successfully. Progress preserved at ${task.progress}%.`,
      data: task
    };

    if (task) {
      await realtimeService.broadcastTaskStatusChange(task.toObject());
    }

    res.json(response);
  } catch (error: any) {
    console.error("Resume task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Pause an ongoing task
 * POST /api/tasks/:id/pause
 */
export const pauseTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Find task
    const task = await Task.findById(id);
    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate task is ONGOING
    if (task.status !== "ONGOING") {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: `Cannot pause task with status ${task.status}. Only ONGOING tasks can be paused.`
      };
      res.status(400).json(response);
      return;
    }

    // Update task to PAUSED
    task.status = "PAUSED";

    // Optionally track pause duration for accurate time tracking
    // (Implementation can be enhanced later with pauseStartTime tracking)

    await task.save();
    await task.populate([
      { path: "projectId", select: "name status priority" },
      { path: "workerId", select: "name username email" },
      { path: "deviceId", select: "name deviceName ipAddress status" },
      { path: "recipeSnapshotId", select: "name version steps" },
      { path: "productSnapshotId", select: "name version" }
    ]);

    const response: APIResponse = {
      success: true,
      message: `Task paused successfully at ${task.progress}% progress.`,
      data: task
    };

    if (task) {
      await realtimeService.broadcastTaskStatusChange(task.toObject());
    }

    res.json(response);
  } catch (error: any) {
    console.error("Pause task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Mark task as failed
 * POST /api/tasks/:id/fail
 */
export const failTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    // Find task
    const task = await Task.findById(id);
    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    // Update task to FAILED
    task.status = "FAILED";

    // Save failure reason in notes
    if (notes) {
      task.notes = notes;
    }

    // Preserve existing progress value (worker may have made partial progress before failure)

    await task.save();
    await task.populate([
      { path: "projectId", select: "name status priority" },
      { path: "workerId", select: "name username email" },
      { path: "deviceId", select: "name deviceName ipAddress status" },
      { path: "recipeSnapshotId", select: "name version steps" },
      { path: "productSnapshotId", select: "name version" }
    ]);

    // Cascade failure to all dependent tasks in the chain
    // Example: task1 -> task2 -> task3. If task1 fails, mark task2 and task3 as failed
    let failedTaskIds: string[] = [];
    let project = null;
    if (task._id) {
      failedTaskIds = [task._id.toString()];

      // Recursive function to find and fail all dependent tasks
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
            // Recursively fail tasks that depend on this task
            await failDependentTasksRecursively(depTask._id.toString());
          }
        }
      };

      await failDependentTasksRecursively(task._id.toString());

      // Check if project should be marked as COMPLETED
      const projectId = task.projectId;

      if (projectId) {
        project = await Project.findById(projectId);

        if (project && project.status !== "COMPLETED") {
          // Get all tasks for this project
          const projectTasks = await Task.find({ projectId });

          // Check if all tasks are either COMPLETED or FAILED
          const allTasksFinished = projectTasks.every(
            (t) => t.status === "COMPLETED" || t.status === "FAILED"
          );

          if (allTasksFinished) {
            project.status = "COMPLETED";
            project.endDate = new Date();
            await project.save(); // Progress auto-calculated by pre-save hook
            await realtimeService.broadcastProjectUpdate(project.toObject());
          }
        }
      }
    }

    const response: APIResponse = {
      success: true,
      message: `Task marked as failed. ${
        failedTaskIds.length - 1
      } dependent task(s) also marked as failed.`,
      data: {
        failedTask: task,
        totalFailedTasks: failedTaskIds.length,
        project: project
          ? {
              _id: project._id,
              status: project.status,
              progress: project.progress
            }
          : null
      }
    };

    if (task) {
      await realtimeService.broadcastTaskStatusChange(task.toObject());
    }

    res.json(response);
  } catch (error: any) {
    console.error("Fail task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Complete a task and handle next step logic
 * POST /api/tasks/:id/complete
 */
export const completeTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { workerId, notes, qualityData, actualDuration } = req.body;

    // Find the task and populate snapshot
    const task = await Task.findById(id).populate("recipeSnapshotId");
    if (!task) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Task not found"
      };
      res.status(404).json(response);
      return;
    }

    // Validate workerId
    if (!workerId && !task.workerId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "workerId is required to complete a task"
      };
      res.status(400).json(response);
      return;
    }

    // Validate that snapshot exists
    if (!task.recipeSnapshotId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Task does not have a recipe snapshot reference"
      };
      res.status(400).json(response);
      return;
    }

    // ⭐ CRITICAL: Support partial completion!
    // Use progress from qualityData if provided, otherwise default to 100
    const completionProgress = qualityData?.progress ?? 100;

    // Update task to COMPLETED
    task.status = "COMPLETED";
    task.workerId = workerId || task.workerId;
    task.completedAt = new Date();
    task.progress = completionProgress; // ⭐ Can be 50, 75, or 100!
    if (notes) task.notes = notes;
    if (qualityData) task.qualityData = qualityData;
    if (actualDuration) task.actualDuration = actualDuration;

    // Calculate actual duration if not provided
    if (!actualDuration && task.startedAt) {
      task.actualDuration = Math.floor(
        (task.completedAt.getTime() - task.startedAt.getTime()) / 60000
      );
    }

    await task.save();

    // Update Device currentTask to null if assigned
    if (task.deviceId) {
      const device = await Device.findById(task.deviceId);
      if (device) {
        device.currentTask = undefined;
        device.currentUser = undefined;
        await device.save();
      }
    }

    let nextTask = null;
    let project = null;

    // if every tasks in the project are either COMPLETED or FAILED, mark project as COMPLETED
    if (task.projectId) {
      const projectTasks = await Task.find({ projectId: task.projectId });
      const allTasksFinished = projectTasks.every(
        (t) => t.status === "COMPLETED" || t.status === "FAILED"
      );
      if (allTasksFinished) {
        project = await Project.findById(task.projectId);
        if (project && project.status !== "COMPLETED") {
          project.status = "COMPLETED";
          await project.save(); // Progress auto-calculated by pre-save hook
          await realtimeService.broadcastProjectUpdate(project.toObject());
        }
      }
    }

    // Find next pre-generated task if it exists (linked via dependentTask)
    nextTask = await Task.findOne({ dependentTask: task._id });

    // Calculate project progress and producedQuantity
    if (task.projectId) {
      project = await Project.findById(task.projectId);

      if (project) {
        // Get all tasks for this project
        const allProjectTasks = await Task.find({ projectId: task.projectId });
        const totalTasks = allProjectTasks.length;
        const completedTasks = allProjectTasks.filter(
          (t) => t.status === "COMPLETED"
        ).length;

        // ✅ Calculate progress: (completed tasks / total tasks) × 100
        project.progress = roundToTwoDecimals(
          totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        );

        // ✅ Update producedQuantity ONLY when last step of recipe execution completes
        if (task.isLastStepInRecipe) {
          if (task.productId) {
            // Product project: Check if ONE complete set of all recipes is done
            const productSnapshot = await ProductSnapshot.findById(
              project.productSnapshot
            );

            if (productSnapshot) {
              // For each recipe in the product, count completed executions
              let minCompletedSets = Infinity;

              for (const recipeRef of productSnapshot.recipes) {
                const recipeSnapshotId = recipeRef.recipeSnapshotId.toString();
                const requiredQuantity = recipeRef.quantity;

                // Count completed last-step tasks for this recipe
                const completedExecutions = await Task.countDocuments({
                  projectId: task.projectId,
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
          } else {
            // Standalone recipe project: Direct increment per execution
            project.producedQuantity += 1;
          }
        }

        // Check if project is complete
        const allTasksFinished = allProjectTasks.every(
          (t) => t.status === "COMPLETED" || t.status === "FAILED"
        );

        if (allTasksFinished) {
          project.status = "COMPLETED";
          project.endDate = new Date();
        } else if (project.producedQuantity >= project.targetQuantity) {
          // All required quantity produced
          project.status = "COMPLETED";
          project.progress = 100;
        }

        await project.save();
        await realtimeService.broadcastProjectUpdate(project.toObject());
      }
    }

    await task.populate("projectId workerId");

    // 🆕 Broadcast task completion in real-time
    await realtimeService.broadcastTaskCompletion(
      task.toObject(),
      nextTask?.toObject() || null,
      project?.progress
    );

    const responseData: any = {
      completedTask: task,
      nextTask: nextTask || null,
      isLastStep: task.isLastStepInRecipe,
      executionInfo: {
        executionNumber: task.recipeExecutionNumber,
        totalExecutions: task.totalRecipeExecutions,
        isLastStepInRecipe: task.isLastStepInRecipe
      }
    };

    // Include project progress if available
    if (task.projectId && project) {
      responseData.project = {
        _id: project._id,
        progress: project.progress
      };
      await realtimeService.broadcastProjectUpdate(project.toObject());
    }

    const response: APIResponse = {
      success: true,
      message: nextTask
        ? `Task completed. Next step ready for execution ${task.recipeExecutionNumber}.`
        : task.isLastStepInRecipe
        ? `Recipe execution ${task.recipeExecutionNumber}/${task.totalRecipeExecutions} completed!`
        : "Task completed",
      data: responseData
    };

    if (task) {
      await realtimeService.broadcastTaskStatusChange(task.toObject());
    }

    res.json(response);
  } catch (error: any) {
    console.error("Complete task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get task statistics
 * GET /api/tasks/statistics
 */
export const getTaskStatistics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { projectId, deviceTypeId, workerId, startDate, endDate } = req.query;

    // Build base query for filtering
    const baseQuery: any = {};
    if (projectId) baseQuery.projectId = projectId;
    if (deviceTypeId) baseQuery.deviceTypeId = deviceTypeId;
    if (workerId) baseQuery.workerId = workerId;

    // Date range filter
    if (startDate || endDate) {
      baseQuery.createdAt = {};
      if (startDate) baseQuery.createdAt.$gte = new Date(startDate as string);
      if (endDate) baseQuery.createdAt.$lte = new Date(endDate as string);
    }

    // Run aggregations in parallel for better performance
    const [
      statusCounts,
      priorityCounts,
      totalTasks,
      completedTasks,
      overdueTasks,
      avgCompletionTime,
      tasksByDeviceType,
      tasksByProject,
      executionProgress
    ] = await Promise.all([
      // Task count per status
      Task.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ]),

      // Task count per priority
      Task.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 }
          }
        }
      ]),

      // Total tasks
      Task.countDocuments(baseQuery),

      // Completed tasks count
      Task.countDocuments({ ...baseQuery, status: "COMPLETED" }),

      // Overdue tasks (estimated vs actual)
      Task.countDocuments({
        ...baseQuery,
        status: { $in: ["PENDING", "ONGOING", "PAUSED"] },
        estimatedDuration: { $exists: true },
        $expr: {
          $gt: [
            { $subtract: [new Date(), "$createdAt"] },
            { $multiply: ["$estimatedDuration", 60000] } // Convert minutes to ms
          ]
        }
      }),

      // Average completion time (in minutes)
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

      // Tasks by device type
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
        { $limit: 10 } // Top 10 device types
      ]),

      // Tasks by project
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
        { $limit: 10 } // Top 10 projects
      ]),

      // Recipe execution progress
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

    // Format status counts
    const statusStats: Record<string, number> = {
      PENDING: 0,
      ONGOING: 0,
      PAUSED: 0,
      COMPLETED: 0,
      FAILED: 0
    };
    statusCounts.forEach((item: any) => {
      if (item._id) statusStats[item._id] = item.count;
    });

    // Format priority counts
    const priorityStats: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0
    };
    priorityCounts.forEach((item: any) => {
      if (item._id) priorityStats[item._id] = item.count;
    });

    // Calculate completion rate
    const completionRate =
      totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : "0";

    // Format average completion time
    const completionTimeStats = avgCompletionTime[0] || {
      avgDuration: 0,
      minDuration: 0,
      maxDuration: 0
    };

    // Format execution progress
    const executionStats = executionProgress[0] || {
      totalExecutions: 0,
      completedExecutions: 0
    };
    const executionCompletionRate =
      executionStats.totalExecutions > 0
        ? (
            (executionStats.completedExecutions /
              executionStats.totalExecutions) *
            100
          ).toFixed(2)
        : "0";

    const response: APIResponse = {
      success: true,
      message: "Task statistics retrieved successfully",
      data: {
        overview: {
          totalTasks,
          completedTasks,
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
        byDeviceType: tasksByDeviceType.map((item: any) => ({
          deviceTypeId: item._id,
          total: item.count,
          completed: item.completed,
          completionRate:
            item.count > 0
              ? parseFloat(((item.completed / item.count) * 100).toFixed(2))
              : 0
        })),
        byProject: tasksByProject.map((item: any) => ({
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
        executionProgress: {
          totalExecutions: executionStats.totalExecutions,
          completedExecutions: executionStats.completedExecutions,
          completionRate: parseFloat(executionCompletionRate)
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get task statistics error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get tasks grouped by project > product > recipe > recipe step hierarchy
 * GET /api/tasks/grouped
 */
export const getGroupedTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      projectStatus,
      taskStatus,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10
    } = req.query;

    // Build task query
    const taskQuery: any = {
      projectId: { $exists: true, $ne: null }
    };

    if (taskStatus) taskQuery.status = taskStatus;

    // Date range filter
    if (startDate || endDate) {
      taskQuery.createdAt = {};
      if (startDate) taskQuery.createdAt.$gte = new Date(startDate as string);
      if (endDate) taskQuery.createdAt.$lte = new Date(endDate as string);
    }

    // Text search support for project/recipe/product names
    let projectIds: any[] = [];
    let recipeIds: any[] = [];
    let productIds: any[] = [];

    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i");

      // Find matching projects
      const projects = await Project.find({
        name: searchRegex
      }).select("_id");
      projectIds = projects.map((p) => p._id);

      // Find matching recipes
      const recipes = await Recipe.find({
        name: searchRegex
      }).select("_id");
      recipeIds = recipes.map((r) => r._id);

      // Find matching products
      const products = await Product.find({
        name: searchRegex
      }).select("_id");
      productIds = products.map((p) => p._id);

      // Add search conditions to task query
      if (
        projectIds.length > 0 ||
        recipeIds.length > 0 ||
        productIds.length > 0
      ) {
        taskQuery.$or = [];

        if (projectIds.length > 0) {
          taskQuery.$or.push({ projectId: { $in: projectIds } });
        }

        if (recipeIds.length > 0) {
          taskQuery.$or.push({ recipeId: { $in: recipeIds } });
        }

        if (productIds.length > 0) {
          taskQuery.$or.push({ productId: { $in: productIds } });
        }
      }
    }

    // Get distinct project IDs from tasks matching the query
    const distinctProjectIds = await Task.distinct("projectId", taskQuery);

    // Build project query
    const projectQuery: any = {
      _id: { $in: distinctProjectIds }
    };

    if (projectStatus) projectQuery.status = projectStatus;

    // Pagination on project level
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get total count of projects
    const totalProjects = await Project.countDocuments(projectQuery);

    // Get paginated projects
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

    // Build grouped data structure
    // Since Project model now has ONLY ONE product OR ONE recipe:
    // - Projects with product: group tasks by recipe within that product
    // - Projects with recipe: group tasks directly by execution
    const groupedData: Record<string, any> = {};

    for (const project of projects) {
      const projectId = (project._id as any).toString();

      // Get all tasks for this project matching the task query
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
        .populate("productSnapshotId", "name version customerName personInCharge department")
        .sort({ createdAt: 1 });

      // Initialize project structure
      groupedData[projectId] = {
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
        recipes: {}, // Group by recipe (only used if project has a product)
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

      // Group tasks by recipe (for product projects or standalone recipe projects)
      for (const task of tasks) {
        // Update summary counts
        groupedData[projectId].summary.byStatus[task.status]++;
        groupedData[projectId].summary.byPriority[task.priority]++;

        // Group by recipe snapshot
        const recipeSnapshot = task.recipeSnapshotId as any as IRecipeSnapshot;
        const recipeSnapshotId = recipeSnapshot._id.toString();

        if (!groupedData[projectId].recipes[recipeSnapshotId]) {
          groupedData[projectId].recipes[recipeSnapshotId] = {
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

        // Group by step
        const stepOrder = task.stepOrder.toString();
        if (
          !groupedData[projectId].recipes[recipeSnapshotId].steps[stepOrder]
        ) {
          // Find step info from snapshot
          const step = (recipeSnapshot as any).steps.find(
            (s: any) => s.order === task.stepOrder
          );

          groupedData[projectId].recipes[recipeSnapshotId].steps[stepOrder] = {
            stepInfo: {
              _id: step?._id || task.recipeStepId,
              name: step?.name || "Unknown Step",
              description: step?.description,
              order: task.stepOrder,
              deviceTypeId: task.deviceTypeId,
              estimatedDuration: task.estimatedDuration
            },
            tasks: [],
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

        // Add task to step group
        groupedData[projectId].recipes[recipeSnapshotId].steps[
          stepOrder
        ].tasks.push(task);
        groupedData[projectId].recipes[recipeSnapshotId].steps[stepOrder]
          .summary.totalTasks++;
        groupedData[projectId].recipes[recipeSnapshotId].steps[stepOrder]
          .summary.byStatus[task.status]++;

        // Update recipe summary
        groupedData[projectId].recipes[recipeSnapshotId].summary.totalTasks++;
        groupedData[projectId].recipes[recipeSnapshotId].summary.byStatus[
          task.status
        ]++;

        // Count completed executions (last step completed)
        if (task.isLastStepInRecipe && task.status === "COMPLETED") {
          groupedData[projectId].recipes[recipeSnapshotId].summary
            .completedExecutions++;
        }
      }
    }

    const response: APIResponse = {
      success: true,
      message: "Grouped tasks retrieved successfully",
      data: {
        items: groupedData,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalProjects,
          totalPages: Math.ceil(totalProjects / limitNum),
          hasNext: pageNum * limitNum < totalProjects,
          hasPrev: pageNum > 1
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get grouped tasks error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get standalone tasks (tasks not associated with any project)
 * GET /api/tasks/standalone
 */
export const getStandaloneTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      status,
      deviceId,
      deviceTypeId,
      recipeId,
      workerId,
      search,
      page = 1,
      limit = 10
    } = req.query;

    // Build query for tasks without projectId
    const query: any = {
      projectId: { $exists: false }
    };

    // Apply filters
    if (status) query.status = status;
    if (deviceId) query.deviceId = deviceId;
    if (deviceTypeId) query.deviceTypeId = deviceTypeId;
    if (recipeId) query.recipeId = recipeId;
    if (workerId) query.workerId = workerId;

    // Text search support for recipe names
    if (search && typeof search === "string") {
      const searchRegex = new RegExp(search, "i"); // Case-insensitive search

      // Find matching recipes
      const recipes = await Recipe.find({
        name: searchRegex
      }).select("_id");
      const recipeIds = recipes.map((r) => r._id);

      // Add search conditions to query
      if (recipeIds.length > 0) {
        query.$or = [{ recipeId: { $in: recipeIds } }, { title: searchRegex }];
      } else {
        // No matching recipes, but still search in task title
        query.title = searchRegex;
      }
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query)
      .populate("recipeId", "name recipeNumber version")
      .populate("recipeSnapshotId", "name version steps")
      .populate("workerId", "name username")
      .populate("deviceTypeId", "name")
      .populate("deviceId", "name")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Standalone tasks retrieved successfully",
      data: {
        items: tasks,
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
    console.error("Get standalone tasks error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const getDeviceTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "deviceId parameter is required"
      };
      res.status(400).json(response);
      return;
    }
    const { status, workerId, start, end, page = 1, limit = 10 } = req.query;

    // Fetch device and build query in parallel for better performance
    const device = await Device.findById(deviceId)
      .select("deviceTypeId")
      .lean();
    if (!device) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device not found"
      };
      res.status(404).json(response);
      return;
    }

    // Build optimized query - prioritize assigned tasks for better index usage
    const deviceObjectId = new mongoose.Types.ObjectId(deviceId);
    const query: any = {
      deviceTypeId: device.deviceTypeId
    };

    // Optimize deviceId query - check assigned first, then unassigned
    // This allows MongoDB to use the deviceId index more efficiently
    query.$or = [
      { deviceId: deviceObjectId }, // Assigned to this device
      { deviceId: null }, // Unassigned
      { deviceId: { $exists: false } } // Field doesn't exist
    ];

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Add worker filter if provided
    if (workerId) {
      const workerObjectId = new mongoose.Types.ObjectId(workerId as string);
      if (!query.$and) query.$and = [];
      query.$and.push({
        $or: [
          { workerId: workerObjectId },
          { workerId: null },
          { workerId: { $exists: false } }
        ]
      });
    }

    // Optimize date range queries - use $or only when necessary, prefer direct field queries
    if (start || end) {
      const startDate = start ? new Date(start as string) : null;
      const endDate = end ? new Date(end as string) : null;

      // For date ranges, check both createdAt and completedAt
      // If task is completed, use completedAt; otherwise use createdAt
      const dateConditions: any[] = [];

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
        query.$and = query.$and || [];
        query.$and.push(...dateConditions);
      }
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Execute count and find queries in parallel for better performance
    // Use select to limit fields returned for better performance
    const [total, tasks] = await Promise.all([
      Task.countDocuments(query),
      Task.find(query)
        .select(
          "title description projectId recipeId recipeSnapshotId productSnapshotId workerId deviceId deviceTypeId status priority progress notes createdAt updatedAt startedAt completedAt dependentTask mediaFiles recipeExecutionNumber stepOrder"
        )
        .populate("projectId", "name status priority deadline")
        .populate("recipeId", "name recipeNumber version")
        .populate("workerId", "name username email")
        .populate("recipeSnapshotId", "name version steps")
        .populate(
          "productSnapshotId",
          "name productNumber customerName personInCharge version"
        )
        .populate("mediaFiles", "url type filename")
        .populate("dependentTask", "title status")
        .skip(skip)
        .limit(limitNum)
        .sort({ completedAt: -1, createdAt: -1 })
        .lean() // Use lean() for better performance - returns plain JS objects
    ]);

    const response: APIResponse = {
      success: true,
      message: "Device tasks retrieved successfully",
      data: {
        items: tasks,
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
    console.error("Get device tasks error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get tasks assigned to a specific worker
 * GET /api/tasks/workers/:workerId
 */

export const getWorkerTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { workerId } = req.params;

    if (!workerId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "workerId parameter is required"
      };
      res.status(400).json(response);
      return;
    }

    const { status, start, end, page = 1, limit = 10 } = req.query;

    // Build query for tasks assigned to the worker
    const query: any = {
      workerId
    };

    if (status) query.status = status;

    if (start || end) {
      query.$and = [];
      if (start) {
        query.$and.push({
          $or: [
            { createdAt: { $gte: new Date(start as string) } },
            { completedAt: { $gte: new Date(start as string) } }
          ]
        });
      }
      if (end) {
        query.$and.push({
          $or: [
            { createdAt: { $lte: new Date(end as string) } },
            { completedAt: { $lte: new Date(end as string) } }
          ]
        });
      }
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(query);

    const tasks = await Task.find(query)
      .populate("projectId", "name status priority deadline")
      .populate("recipeId", "name recipeNumber version")
      .populate("deviceId", "name deviceName")
      .populate("recipeSnapshotId", "name version steps")
      .populate(
        "productSnapshotId",
        "name productNumber customerName personInCharge version"
      )
      .skip(skip)
      .limit(limitNum)
      .sort({ completedAt: -1, createdAt: -1 });

    const [PENDING, ONGOING, PAUSED, COMPLETED, FAILED] = await Promise.all([
      Task.countDocuments({ ...query, status: "PENDING" }),
      Task.countDocuments({ ...query, status: "ONGOING" }),
      Task.countDocuments({ ...query, status: "PAUSED" }),
      Task.countDocuments({ ...query, status: "COMPLETED" }),
      Task.countDocuments({ ...query, status: "FAILED" })
    ]);
    const statistics = {
      totalTasks: total,
      byStatus: {
        PENDING,
        ONGOING,
        PAUSED,
        COMPLETED,
        FAILED
      }
    };

    const response: APIResponse = {
      success: true,
      message: "Worker tasks retrieved successfully",
      data: {
        items: tasks,
        statistics,
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
    console.error("Get worker tasks error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Batch update multiple tasks
 * PATCH /api/tasks/batch
 *
 * Updates multiple tasks with the same set of fields.
 * Returns results showing which tasks were updated successfully and which failed.
 */
export const batchUpdateTasks = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { taskIds, updates } = req.body;

    // Validation
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "taskIds must be a non-empty array"
      };
      res.status(400).json(response);
      return;
    }

    if (!updates || typeof updates !== "object") {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "updates must be an object"
      };
      res.status(400).json(response);
      return;
    }

    const {
      status,
      priority,
      notes,
      mediaFiles,
      deviceId,
      workerId,
      pausedDuration,
      startedAt,
      completedAt,
      progress
    } = updates;

    // Validate status change requirements
    if (status === "ONGOING") {
      // Check if workerId is provided or exists on all tasks
      if (!workerId) {
        const tasksWithoutWorker = await Task.find({
          _id: { $in: taskIds },
          $or: [{ workerId: { $exists: false } }, { workerId: null }]
        });
        if (tasksWithoutWorker.length > 0) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message:
              "workerId is required to set task status to ONGOING. Some tasks do not have a workerId assigned."
          };
          res.status(400).json(response);
          return;
        }
      }

      // Check if deviceId is provided or exists on all tasks
      if (!deviceId) {
        const tasksWithoutDevice = await Task.find({
          _id: { $in: taskIds },
          $or: [{ deviceId: { $exists: false } }, { deviceId: null }]
        });
        if (tasksWithoutDevice.length > 0) {
          const response: APIResponse = {
            success: false,
            error: "VALIDATION_ERROR",
            message:
              "deviceId is required to set task status to ONGOING. Some tasks do not have a deviceId assigned."
          };
          res.status(400).json(response);
          return;
        }
      }
    }

    // Build update object with only provided fields
    const updateFields: any = {};
    if (status !== undefined) updateFields.status = status;
    if (priority !== undefined) updateFields.priority = priority;
    if (notes !== undefined) updateFields.notes = notes;
    if (mediaFiles !== undefined) updateFields.mediaFiles = mediaFiles;
    if (deviceId !== undefined) updateFields.deviceId = deviceId;
    if (workerId !== undefined) updateFields.workerId = workerId;
    if (pausedDuration !== undefined)
      updateFields.pausedDuration = pausedDuration;
    if (startedAt !== undefined)
      updateFields.startedAt = startedAt ? new Date(startedAt) : undefined;
    if (completedAt !== undefined)
      updateFields.completedAt = completedAt
        ? new Date(completedAt)
        : undefined;
    if (progress !== undefined) updateFields.progress = progress;

    // Recalculate actual duration if both start and complete times are provided
    if (startedAt && completedAt) {
      updateFields.actualDuration = Math.floor(
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) /
          60000
      );
    }

    // Find all tasks first to validate they exist
    const tasks = await Task.find({ _id: { $in: taskIds } });
    const foundIds = tasks.map((t) => String(t._id));
    const notFoundIds = (taskIds as string[]).filter(
      (id: string) => !foundIds.includes(id)
    );

    // Update all found tasks
    const updateResult = await Task.updateMany(
      { _id: { $in: foundIds } },
      { $set: updateFields }
    );

    // Fetch updated tasks with populated references
    const updatedTasks = await Task.find({ _id: { $in: foundIds } })
      .populate([
        { path: "projectId", select: "name status" },
        { path: "workerId", select: "name username email" },
        { path: "deviceId", select: "name deviceName" },
        { path: "recipeSnapshotId", select: "name version" },
        { path: "productSnapshotId", select: "name version" }
      ])
      .sort({ createdAt: -1 });

    // Broadcast status changes if status was updated
    if (status !== undefined) {
      for (const task of updatedTasks) {
        await realtimeService.broadcastTaskStatusChange(task.toObject());
      }
    }

    // Handle device updates - clear currentTask from devices if status changed to COMPLETED or FAILED
    if (status === "COMPLETED" || status === "FAILED") {
      const tasksToClear = await Task.find({
        _id: { $in: foundIds },
        deviceId: { $exists: true, $ne: null }
      });
      for (const task of tasksToClear) {
        if (task.deviceId) {
          const device = await Device.findById(task.deviceId);
          if (device) {
            device.currentTask = undefined;
            device.currentUser = undefined;
            await device.save();
          }
        }
      }
    }

    const response: APIResponse = {
      success: true,
      message: `Batch update completed. ${updateResult.modifiedCount} task(s) updated successfully.`,
      data: {
        updated: updatedTasks,
        summary: {
          totalRequested: taskIds.length,
          found: foundIds.length,
          updated: updateResult.modifiedCount,
          notFound: notFoundIds
        }
      }
    };

    // Include warnings if some tasks were not found
    if (notFoundIds.length > 0) {
      response.message += ` ${notFoundIds.length} task(s) not found.`;
    }

    res.json(response);
  } catch (error: any) {
    console.error("Batch update tasks error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};
