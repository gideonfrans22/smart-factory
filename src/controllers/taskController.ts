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
      assignedTo,
      page = 1,
      limit = 10
    } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (deviceId) query.deviceId = deviceId;
    if (projectId) query.projectId = projectId;
    if (assignedTo) query.assignedTo = assignedTo;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query)
      .populate("projectId", "name status priority")
      .populate("assignedTo", "name username")
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
      .populate("assignedTo", "name username");

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
      recipeStepId,
      deviceId,
      assignedTo,
      status,
      priority,
      estimatedDuration,
      notes,
      qualityData
    } = req.body;

    // Validation
    if (!title || !projectId || !deviceId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Title, project ID, and device ID are required"
      };
      res.status(400).json(response);
      return;
    }

    if (!recipeStepId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Recipe step ID is required"
      };
      res.status(400).json(response);
      return;
    }

    // Validate project exists and has a recipe
    const project = await Project.findById(projectId).populate("recipeId");
    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    if (!project.recipeId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Project does not have an associated recipe"
      };
      res.status(400).json(response);
      return;
    }

    // Validate recipe step exists in the recipe
    const recipe = project.recipeId as any;
    const recipeStep = recipe.steps.find(
      (step: any) => step.stepId === recipeStepId
    );

    if (!recipeStep) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: `Recipe step '${recipeStepId}' not found in project's recipe`
      };
      res.status(404).json(response);
      return;
    }

    // Create task with recipe step information
    const task = new Task({
      title,
      description,
      projectId,
      recipeStepId,
      deviceId,
      assignedTo,
      status: status || "PENDING",
      priority: priority || "MEDIUM",
      estimatedDuration: estimatedDuration || recipeStep.estimatedDuration,
      progress: 0,
      notes,
      qualityData,
      pausedDuration: 0
    });

    await task.save();
    await task.populate("projectId assignedTo");

    const response: APIResponse = {
      success: true,
      message: "Task created successfully",
      data: task
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Create task error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
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
    await task.populate("projectId assignedTo");

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
