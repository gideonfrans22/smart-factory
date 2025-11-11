import { Router } from "express";
import {
  getProjects,
  getProjectById,
  createProjectsBatch,
  updateProject,
  deleteProject
} from "../controllers/projectController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * @route   GET /api/projects
 * @desc    Get all projects with optional filtering
 * @access  Private
 */
router.get("/", authenticateToken, getProjects);

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID
 * @access  Private
 */
router.get("/:id", authenticateToken, getProjectById);

/**
 * @route   POST /api/projects
 * @desc    Create multiple projects in batch (products and/or recipes)
 * @access  Private (Admin only)
 */
router.post("/", authenticateToken, requireAdmin, createProjectsBatch);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Private (Admin only)
 */
router.put("/:id", authenticateToken, requireAdmin, updateProject);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project
 * @access  Private (Admin only)
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteProject);

export default router;
