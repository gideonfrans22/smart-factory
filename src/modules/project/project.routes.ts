import { Router } from "express";
import * as projectController from "./project.controller";
import { authenticateToken, requireAdmin } from "@shared/middleware";

const router = Router();

/**
 * @route   GET /api/projects
 * @desc    Get all projects with optional filtering
 * @access  Private
 */
router.get("/", authenticateToken, projectController.getProjects);

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID
 * @access  Private
 */
router.get("/:id", authenticateToken, projectController.getProjectById);

/**
 * @route   POST /api/projects
 * @desc    Create multiple projects in batch (products and/or recipes)
 * @access  Private (Admin only)
 */
router.post("/", authenticateToken, requireAdmin, projectController.createProjectsBatch);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Private (Admin only)
 */
router.put("/:id", authenticateToken, requireAdmin, projectController.updateProject);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project
 * @access  Private (Admin only)
 */
router.delete("/:id", authenticateToken, requireAdmin, projectController.deleteProject);

/**
 * @route   GET /api/projects/monitor/active
 * @desc    Get active project monitor data
 * @access  Private
 */
router.get("/monitor/active", authenticateToken, projectController.getActiveProjectMonitorData);

export default router;
