import { Request, Response } from "express";
import { APIResponse, AuthenticatedRequest } from "@shared/types";
import {
  taskService,
  TaskServiceError
} from "./task.service";
import type {
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
  DeviceTaskQuery,
  WorkerTaskQuery
} from "./task.types";

function handleTaskError(
  res: Response,
  error: unknown,
  logLabel: string
): void {
  console.error(`${logLabel}:`, error);
  if (error instanceof TaskServiceError) {
    const response: APIResponse = {
      success: false,
      error: error.errorCode,
      message: error.message,
      ...(error.data !== undefined && { data: error.data as unknown })
    };
    res.status(error.statusCode).json(response);
    return;
  }
  const response: APIResponse = {
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message:
      error instanceof Error ? error.message : "Internal server error"
  };
  res.status(500).json(response);
}

export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await taskService.listTasks(req.query as unknown as TaskListQuery);
    const response: APIResponse = {
      success: true,
      message: "Tasks retrieved successfully",
      data
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Get tasks error");
  }
};

export const getTaskById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    const response: APIResponse = {
      success: true,
      message: "Task retrieved successfully",
      data: task
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Get task error");
  }
};

export const createTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await taskService.createStandaloneTask(
      req.body as TaskCreateDTO
    );
    const response: APIResponse = {
      success: true,
      message: result.message,
      data: {
        task: result.task,
        executionInfo: result.executionInfo
      }
    };
    res.status(201).json(response);
  } catch (error) {
    handleTaskError(res, error, "Create task error");
  }
};

export const updateTaskStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const task = await taskService.updateTaskStatus(
      req.params.id,
      req.body as TaskStatusUpdateBody,
      { userName: req.user?.name }
    );
    const response: APIResponse = {
      success: true,
      message: "Task status updated successfully",
      data: task
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Update task status error");
  }
};

export const updateTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const task = await taskService.patchTask(
      req.params.id,
      req.body as TaskUpdateDTO,
      { userName: req.user?.name }
    );
    const response: APIResponse = {
      success: true,
      message: "Task updated successfully",
      data: task
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Update task error");
  }
};

export const deleteTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const cascadeDelete = req.query.cascadeDelete === "true";
    const result = await taskService.deleteTask(req.params.id, {
      cascadeDelete
    });
    const response: APIResponse = {
      success: true,
      message: result.message,
      data: result.data
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Delete task error");
  }
};

export const startTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const task = await taskService.startTask(
      req.params.id,
      req.body as TaskStartBody
    );
    const response: APIResponse = {
      success: true,
      message: "Task started successfully",
      data: task
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Start task error");
  }
};

export const resumeTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const task = await taskService.resumeTask(
      req.params.id,
      (req.body || {}) as TaskResumeBody,
      { userName: req.user?.name }
    );
    const response: APIResponse = {
      success: true,
      message: `Task resumed successfully. Progress preserved at ${task.progress}%.`,
      data: task
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Resume task error");
  }
};

export const pauseTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const task = await taskService.pauseTask(
      req.params.id,
      req.body as TaskPauseBody,
      { userName: req.user?.name }
    );
    const response: APIResponse = {
      success: true,
      message: `Task paused successfully at ${task.progress}% progress.`,
      data: task
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Pause task error");
  }
};

export const failTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { notes } = req.body;
    const result = await taskService.failTask(req.params.id, notes);
    const response: APIResponse = {
      success: true,
      message: result.message,
      data: {
        failedTask: result.failedTask,
        totalFailedTasks: result.totalFailedTasks,
        project: result.project
      }
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Fail task error");
  }
};

export const completeTask = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await taskService.completeTask(
      req.params.id,
      req.body as TaskCompleteBody,
      { userName: req.user?.name }
    );
    const response: APIResponse = {
      success: true,
      message: result.message,
      data: result.data
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Complete task error");
  }
};

export const getTaskStatistics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = await taskService.getTaskStatistics(
      req.query as unknown as TaskStatisticsQuery
    );
    const response: APIResponse = {
      success: true,
      message: "Task statistics retrieved successfully",
      data
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Get task statistics error");
  }
};

export const getGroupedTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await taskService.getGroupedTasks(
      req.query as unknown as TaskGroupedQuery
    );
    const response: APIResponse = {
      success: true,
      message: "Grouped tasks retrieved successfully",
      data: {
        items: result.items,
        pagination: result.pagination
      }
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Get grouped tasks error");
  }
};

export const getStandaloneTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = await taskService.listStandaloneTasks(
      req.query as unknown as TaskStandaloneQuery
    );
    const response: APIResponse = {
      success: true,
      message: "Standalone tasks retrieved successfully",
      data
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Get standalone tasks error");
  }
};

export const getDeviceTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = await taskService.listDeviceTasks(
      req.params.deviceId,
      req.query as unknown as DeviceTaskQuery
    );
    const response: APIResponse = {
      success: true,
      message: "Device tasks retrieved successfully",
      data
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Get device tasks error");
  }
};

export const getWorkerTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = await taskService.listWorkerTasks(
      req.params.workerId,
      req.query as unknown as WorkerTaskQuery
    );
    const response: APIResponse = {
      success: true,
      message: "Worker tasks retrieved successfully",
      data
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Get worker tasks error");
  }
};

export const batchUpdateTasks = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await taskService.batchUpdateTasks(
      req.body as TaskBatchUpdateDTO
    );
    const response: APIResponse = {
      success: true,
      message: result.message,
      data: {
        updated: result.updated,
        summary: result.summary
      }
    };
    res.json(response);
  } catch (error) {
    handleTaskError(res, error, "Batch update tasks error");
  }
};
