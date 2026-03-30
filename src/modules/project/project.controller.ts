import { Request, Response } from "express";
import { APIResponse, AuthenticatedRequest } from "@shared/types";
import {
  projectService,
  ProjectServiceError
} from "./project.service";
import { DeviceConfigurationErrorCode } from "./project-device-configuration.types";
import {
  projectDeviceConfigurationService,
  ProjectDeviceConfigurationServiceError,
  serializeDeviceConfigurationByDeviceType
} from "./project-device-configuration.service";
import { Project } from "./project.model";
import { ProjectStatus } from "./project.types";

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

/**
 * GET /api/projects/:id/device-configuration
 */
export const getProjectDeviceConfiguration = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id).select("_id").lean();
    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    const [doc, requiredDeviceTypes] = await Promise.all([
      projectDeviceConfigurationService.getByProjectId(id),
      projectDeviceConfigurationService.getRequiredDeviceTypesWithNames(id)
    ]);

    const byDeviceType = doc
      ? serializeDeviceConfigurationByDeviceType(doc.byDeviceType)
      : {};

    const response: APIResponse = {
      success: true,
      message: "Device configuration retrieved successfully",
      data: { byDeviceType, requiredDeviceTypes }
    };
    res.json(response);
  } catch (error: any) {
    console.error("Get project device configuration error:", error);
    if (error instanceof ProjectDeviceConfigurationServiceError) {
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
 * PUT /api/projects/:id/device-configuration — full replace of byDeviceType
 */
export const putProjectDeviceConfiguration = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { byDeviceType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      const response: APIResponse = {
        success: false,
        error: "UNAUTHORIZED",
        message: "Authentication required"
      };
      res.status(401).json(response);
      return;
    }

    const { configuration, created } =
      await projectDeviceConfigurationService.upsertFull(
        id,
        byDeviceType,
        userId
      );

    const response: APIResponse = {
      success: true,
      message: created
        ? "Device configuration created successfully"
        : "Device configuration updated successfully",
      data: {
        byDeviceType: serializeDeviceConfigurationByDeviceType(
          configuration.byDeviceType
        )
      }
    };

    res.status(created ? 201 : 200).json(response);
  } catch (error: any) {
    console.error("Put project device configuration error:", error);
    if (error instanceof ProjectDeviceConfigurationServiceError) {
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
 * DELETE /api/projects/:id/device-configuration
 */
export const deleteProjectDeviceConfiguration = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const project = await Project.findById(id).select("status").lean();
    if (!project) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Project not found"
      };
      res.status(404).json(response);
      return;
    }

    if (project.status !== ProjectStatus.PLANNING) {
      const response: APIResponse = {
        success: false,
        error: DeviceConfigurationErrorCode.NOT_IN_PLANNING,
        message:
          "Device configuration can only be deleted while the project is in PLANNING."
      };
      res.status(400).json(response);
      return;
    }

    await projectDeviceConfigurationService.deleteByProjectId(id);

    const response: APIResponse = {
      success: true,
      message: "Device configuration removed successfully"
    };
    res.json(response);
  } catch (error: any) {
    console.error("Delete project device configuration error:", error);
    if (error instanceof ProjectDeviceConfigurationServiceError) {
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
