import { Router } from "express";
import * as projectController from "./project.controller";
import { authenticateToken, requireAdmin, validate } from "@shared/middleware";
import {
  projectDeviceConfigurationPutBodySchema,
  projectIdParamSchema
} from "./project.validators";

const router = Router();

/**
 * @route   GET /api/projects
 * @desc    Get all projects with optional filtering
 * @access  Private
 */
router.get("/", authenticateToken, projectController.getProjects);

/**
 * @route   POST /api/projects
 * @desc    Create multiple projects in batch (products and/or recipes)
 * @access  Private (Admin only)
 */
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  projectController.createProjectsBatch
);

/**
 * @route   GET /api/projects/monitor/active
 * @desc    Get active project monitor data
 * @access  Private
 */
router.get(
  "/monitor/active",
  authenticateToken,
  projectController.getActiveProjectMonitorData
);

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID
 * @access  Private
 */
router.get("/:id", authenticateToken, projectController.getProjectById);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Private (Admin only)
 */
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  projectController.updateProject
);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project
 * @access  Private (Admin only)
 */
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  projectController.deleteProject
);

/**
 * @route   GET /api/projects/:id/device-configuration
 * @desc    Get per-project device configuration (empty object if none)
 * @access  Private
 */
router.get(
  "/:id/device-configuration",
  authenticateToken,
  validate(projectIdParamSchema, "params"),
  projectController.getProjectDeviceConfiguration
);

/**
 * @route   PUT /api/projects/:id/device-configuration
 * @desc    Full replace of device configuration (PLANNING only; admin)
 * @access  Private (Admin only)
 */
router.put(
  "/:id/device-configuration",
  authenticateToken,
  requireAdmin,
  validate(projectIdParamSchema, "params"),
  validate(projectDeviceConfigurationPutBodySchema),
  projectController.putProjectDeviceConfiguration
);

/**
 * @route   DELETE /api/projects/:id/device-configuration
 * @desc    Remove device configuration document (PLANNING only; admin)
 * @access  Private (Admin only)
 */
router.delete(
  "/:id/device-configuration",
  authenticateToken,
  requireAdmin,
  validate(projectIdParamSchema, "params"),
  projectController.deleteProjectDeviceConfiguration
);

export default router;
