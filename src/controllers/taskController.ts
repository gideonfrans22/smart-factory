import { Request, Response } from "express";
import { Task } from "../models/Task";
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
      .populate("assignedTo", "name empNo")
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
      .populate("assignedTo", "name empNo");

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
      deviceId,
      assignedTo,
      status,
      priority,
      estimatedDuration
    } = req.body;

    if (!title || !projectId || !deviceId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Title, project ID, and device ID are required"
      };
      res.status(400).json(response);
      return;
    }

    const task = new Task({
      title,
      description,
      projectId,
      deviceId,
      assignedTo,
      status: status || "PENDING",
      priority: priority || "MEDIUM",
      estimatedDuration,
      progress: 0
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
