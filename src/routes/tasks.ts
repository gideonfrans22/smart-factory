import { Router } from "express";
import {
  getTasks,
  getTaskById,
  createTask,
  updateTaskStatus,
  deleteTask,
  completeTask
} from "../controllers/taskController";
import {
  uploadTaskMedia,
  uploadMultipleTaskMedia,
  getTaskMedia,
  deleteTaskMedia,
  downloadTaskMedia
} from "../controllers/taskMediaController";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { uploadSingle, uploadMultiple } from "../middleware/upload";

const router = Router();

/**
 * @route GET /api/tasks
 * @desc Get all tasks with filtering and pagination
 * @access Authenticated users
 */
router.get("/", authenticateToken, getTasks);

/**
 * @route GET /api/tasks/:id
 * @desc Get task by ID
 * @access Authenticated users
 */
router.get("/:id", authenticateToken, getTaskById);

/**
 * @route POST /api/tasks
 * @desc Create new task
 * @access Admin only
 */
router.post("/", authenticateToken, requireAdmin, createTask);

/**
 * @route POST /api/tasks/:id/status
 * @desc Update task status
 * @access Authenticated users
 */
router.post("/:id/status", authenticateToken, updateTaskStatus);

/**
 * @route POST /api/tasks/:id/complete
 * @desc Complete task and handle next step creation
 * @access Authenticated users
 */
router.post("/:id/complete", authenticateToken, completeTask);

/**
 * @route DELETE /api/tasks/:id
 * @desc Delete task
 * @access Admin only
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteTask);

// Task Media Routes
/**
 * @route GET /api/tasks/:taskId/media
 * @desc Get all media files for a task
 * @access Authenticated users
 */
router.get("/:taskId/media", authenticateToken, getTaskMedia);

/**
 * @route POST /api/tasks/:taskId/media
 * @desc Upload single file to task
 * @access Authenticated users
 */
router.post("/:taskId/media", authenticateToken, uploadSingle, uploadTaskMedia);

/**
 * @route POST /api/tasks/:taskId/media/multiple
 * @desc Upload multiple files to task
 * @access Authenticated users
 */
router.post(
  "/:taskId/media/multiple",
  authenticateToken,
  uploadMultiple,
  uploadMultipleTaskMedia
);

/**
 * @route GET /api/tasks/media/:id/download
 * @desc Download media file
 * @access Authenticated users
 */
router.get("/media/:id/download", authenticateToken, downloadTaskMedia);

/**
 * @route DELETE /api/tasks/media/:id
 * @desc Delete media file
 * @access Authenticated users
 */
router.delete("/media/:id", authenticateToken, deleteTaskMedia);

export default router;
