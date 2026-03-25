import { Request, Response } from "express";
import { APIResponse, AuthenticatedRequest } from "@shared/types";
import {
  projectService,
  ProjectServiceError
} from "./project.service";

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
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const data = await projectService.listProjects({
      status: status as string | undefined,
      priority: priority as string | undefined,
      page: pageNum,
      limit: limitNum
    });

    const response: APIResponse = {
      success: true,
      message: "Projects retrieved successfully",
      data
    };

    res.json(response);
  } catch (error: any) {
    console.error("Get projects error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
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

    const project = await projectService.getProjectById(id);

    const response: APIResponse = {
      success: true,
      message: "Project retrieved successfully",
      data: project
    };

    res.json(response);
  } catch (error: any) {
    console.error("Get project error:", error);
    if (error instanceof ProjectServiceError) {
      const response: APIResponse = {
        success: false,
        error: error.errorCode,
        message: error.message,
        ...(error.data !== undefined && { data: error.data })
      };
      res.status(error.statusCode).json(response);
      return;
    }

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
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

    const { projects, taskCounts } = await projectService.createProjectsBatch({
      products,
      recipes,
      createdBy,
      modifiedBy: req.user?.id
    });

    const response: APIResponse = {
      success: true,
      message: `${projects.length} project(s) created successfully`,
      data: {
        projects,
        taskCounts
      }
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error("Create projects batch error:", error);
    if (error instanceof ProjectServiceError) {
      const response: APIResponse = {
        success: false,
        error: error.errorCode,
        message: error.message,
        ...(error.data !== undefined && { data: error.data })
      };
      res.status(error.statusCode).json(response);
      return;
    }

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

    const result = await projectService.updateProject({
      id,
      body: req.body,
      userId: req.user?.id
    });

    const response: APIResponse = {
      success: true,
      message: result.isActivating
        ? `Project activated successfully. ${result.createdTasksCount} initial task(s) created.`
        : result.isDeactivating
        ? "Project deactivated successfully. All tasks deleted."
        : "Project updated successfully",
      data: {
        project: result.project,
        ...(result.isActivating && {
          tasksCreated: result.createdTasksCount
        }),
        ...(result.isDeactivating && { tasksDeleted: true })
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error("Update project error:", error);
    if (error instanceof ProjectServiceError) {
      const response: APIResponse = {
        success: false,
        error: error.errorCode,
        message: error.message,
        ...(error.data !== undefined && { data: error.data })
      };
      res.status(error.statusCode).json(response);
      return;
    }

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

    const { deletedTaskCount } = await projectService.deleteProject({
      id,
      userId: req.user?.id
    });

    const response: APIResponse = {
      success: true,
      message: `Project deleted successfully. ${deletedTaskCount} task(s) deleted.`
    };

    res.json(response);
  } catch (error: any) {
    console.error("Delete project error:", error);
    if (error instanceof ProjectServiceError) {
      const response: APIResponse = {
        success: false,
        error: error.errorCode,
        message: error.message,
        ...(error.data !== undefined && { data: error.data })
      };
      res.status(error.statusCode).json(response);
      return;
    }

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get real-time monitoring data for all active projects
 * This endpoint provides a dashboard view of currently running projects with their tasks
 * GET /api/projects/monitor/active
 */
export const getActiveProjectMonitorData = async (
  _: Request,
  res: Response
): Promise<void> => {
  try {
    const projectTasks = await projectService.getActiveProjectMonitorData();

    const response: APIResponse = {
      success: true,
      message: "Active project monitor data retrieved successfully",
      data: {
        items: projectTasks // Array of project monitoring data
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error("Get active project monitor data error:", error);
    if (error instanceof ProjectServiceError) {
      const response: APIResponse = {
        success: false,
        error: error.errorCode,
        message: error.message,
        ...(error.data !== undefined && { data: error.data })
      };
      res.status(error.statusCode).json(response);
      return;
    }

    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: error.message || "Internal server error"
    };
    res.status(500).json(response);
  }
};
