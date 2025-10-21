import { Request, Response } from "express";
import { Project } from "../models/Project";
import { Recipe } from "../models/Recipe";
import { APIResponse, AuthenticatedRequest } from "../types";

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

    // Get projects
    const projects = await Project.find(query)
      .populate("createdBy", "name email username")
      .populate("recipeId")
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
      .populate("recipeId");

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
 * Create new project
 * POST /api/projects
 */
export const createProject = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      description,
      recipeId,
      status,
      priority,
      startDate,
      endDate,
      deadline,
      assignedDevices,
      progress
    } = req.body;

    // Validation
    if (!name) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Project name is required"
      };
      res.status(400).json(response);
      return;
    }

    if (!recipeId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Recipe ID is required"
      };
      res.status(400).json(response);
      return;
    }

    if (!startDate || !endDate) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Start date and end date are required"
      };
      res.status(400).json(response);
      return;
    }

    // Validate recipe exists
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

    // Create project
    const project = new Project({
      name,
      description,
      recipeId,
      status: status || "PLANNING",
      priority: priority || "MEDIUM",
      startDate,
      endDate,
      deadline,
      assignedDevices: assignedDevices || [],
      progress: progress || 0,
      createdBy: req.user!._id
    });

    await project.save();
    await project.populate([
      { path: "createdBy", select: "name email username" },
      { path: "recipeId" }
    ]);

    const response: APIResponse = {
      success: true,
      message: "Project created successfully",
      data: project
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Create project error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Update project
 * PUT /api/projects/:id
 */
export const updateProject = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      status,
      priority,
      startDate,
      endDate,
      progress
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

    // Update fields
    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (status !== undefined) project.status = status;
    if (priority !== undefined) project.priority = priority;
    if (startDate !== undefined) project.startDate = new Date(startDate);
    if (endDate !== undefined) project.endDate = new Date(endDate);
    if (progress !== undefined) project.progress = progress;

    await project.save();
    await project.populate("createdBy", "name email username");

    const response: APIResponse = {
      success: true,
      message: "Project updated successfully",
      data: project
    };

    res.json(response);
  } catch (error) {
    console.error("Update project error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Delete project
 * DELETE /api/projects/:id
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

    await Project.findByIdAndDelete(id);

    const response: APIResponse = {
      success: true,
      message: "Project deleted successfully"
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
