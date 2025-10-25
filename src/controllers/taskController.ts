import { Request, Response } from "express";
import { Task } from "../models/Task";
import { Project } from "../models/Project";
import { APIResponse, AuthenticatedRequest } from "../types";

export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      status,
      deviceId,
      projectId,
      recipeId,
      productId,
      workerId,
      page = 1,
      limit = 10
    } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (deviceId) query.deviceId = deviceId;
    if (projectId) query.projectId = projectId;
    if (recipeId) query.recipeId = recipeId;
    if (productId) query.productId = productId;
    if (workerId) query.workerId = workerId;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query)
      .populate("projectId", "name status priority")
      .populate("workerId", "name username")
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
      .populate("workerId", "name username");

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
      recipeStepId,
      deviceId,
      workerId,
      status,
      priority,
      estimatedDuration,
      notes,
      qualityData
    } = req.body;

    // Validation
    if (!title || !projectId || !recipeId || !recipeStepId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Title, projectId, recipeId, and recipeStepId are required"
      };
      res.status(400).json(response);
      return;
    }

    // Validate project exists
    const project = await Project.findById(projectId);
    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    // Find recipe in project (either in recipes[] or products[].snapshot.recipes[])
    let recipeSnapshot: any = null;
    let recipeStep: any = null;

    // Check in project.recipes[]
    const projectRecipe = project.recipes.find(
      (r) => r.recipeId.toString() === recipeId
    );
    if (projectRecipe) {
      recipeSnapshot = projectRecipe.snapshot;
    } else if (productId) {
      // Check in project.products[].snapshot
      const projectProduct = project.products.find(
        (p) => p.productId.toString() === productId
      );
      if (projectProduct) {
        // Note: Product snapshot contains recipe references, not full recipes
        // For product tasks, we still need recipeId from project.recipes[]
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message:
            "Product-specific recipe lookup not yet implemented. Use project.recipes[] for now."
        };
        res.status(400).json(response);
        return;
      }
    }

    if (!recipeSnapshot) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: `Recipe '${recipeId}' not found in project`
      };
      res.status(404).json(response);
      return;
    }

    // Validate recipe step exists
    recipeStep = recipeSnapshot.steps.find(
      (step: any) => step._id.toString() === recipeStepId
    );

    if (!recipeStep) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: `Recipe step '${recipeStepId}' not found in recipe`
      };
      res.status(404).json(response);
      return;
    }

    // Extract deviceTypeId from recipe step
    const deviceTypeId = recipeStep.deviceTypeId;
    if (!deviceTypeId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Recipe step does not have a deviceTypeId"
      };
      res.status(400).json(response);
      return;
    }

    // Create task
    const task = new Task({
      title,
      description,
      projectId,
      recipeId,
      productId,
      recipeStepId,
      deviceTypeId, // Automatically extracted from recipe step
      deviceId,
      workerId,
      status: status || "PENDING",
      priority: priority || "MEDIUM",
      estimatedDuration: estimatedDuration || recipeStep.estimatedDuration,
      progress: 0,
      notes,
      qualityData,
      pausedDuration: 0
    });

    await task.save();
    await task.populate("projectId workerId");

    const response: APIResponse = {
      success: true,
      message: "Task created successfully",
      data: task
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
    const { status, notes, startTime, endTime, progress } = req.body;

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

export const deleteTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const task = await Task.findByIdAndDelete(id);

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
      message: "Task deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
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

    // Find the task
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

    // Get project with full snapshot data
    const project = await Project.findById(task.projectId);
    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    // Find the recipe snapshot
    const projectRecipe = project.recipes.find(
      (r) => r.recipeId.toString() === task.recipeId.toString()
    );

    if (!projectRecipe) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe not found in project"
      };
      res.status(404).json(response);
      return;
    }

    const recipeSnapshot = projectRecipe.snapshot;
    const currentStep = recipeSnapshot.steps.find(
      (step: any) => step._id.toString() === task.recipeStepId.toString()
    );

    if (!currentStep) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Recipe step not found in recipe snapshot"
      };
      res.status(404).json(response);
      return;
    }

    // Update task to COMPLETED
    task.status = "COMPLETED";
    task.workerId = workerId || task.workerId;
    task.completedAt = new Date();
    task.progress = 100;
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

    // Determine next step by order
    const nextStep = recipeSnapshot.steps.find(
      (step: any) => step.order === currentStep.order + 1
    );

    let nextTask = null;

    if (nextStep) {
      // Extract deviceTypeId from next step
      const nextDeviceTypeId = nextStep.deviceTypeId;
      if (!nextDeviceTypeId) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Next recipe step does not have a deviceTypeId"
        };
        res.status(400).json(response);
        return;
      }

      // Create next task
      nextTask = new Task({
        title: `${nextStep.name} - ${project.name}`,
        description: nextStep.description,
        projectId: project._id,
        recipeId: task.recipeId,
        productId: task.productId,
        recipeStepId: nextStep._id,
        deviceTypeId: nextDeviceTypeId, // Copied from next step
        status: "PENDING",
        priority: task.priority,
        estimatedDuration: nextStep.estimatedDuration,
        progress: 0,
        pausedDuration: 0
      });

      await nextTask.save();
    } else {
      // This was the last step - increment producedQuantity
      const recipeIndex = project.recipes.findIndex(
        (r) => r.recipeId.toString() === task.recipeId.toString()
      );

      if (recipeIndex !== -1) {
        project.recipes[recipeIndex].producedQuantity += 1;
        await project.save(); // Progress will be recalculated by pre-save hook
      }
    }

    await task.populate("projectId workerId");

    const response: APIResponse = {
      success: true,
      message: nextStep
        ? "Task completed and next task created"
        : "Task completed and recipe execution finished",
      data: {
        completedTask: task,
        nextTask: nextTask || null,
        isLastStep: !nextStep,
        project: {
          _id: project._id,
          progress: project.progress
        }
      }
    };

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
