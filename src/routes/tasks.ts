import { Router } from "express";
import {
  getTasks,
  getTaskById,
  createTask,
  updateTaskStatus,
  deleteTask
} from "../controllers/taskController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

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
 * @route DELETE /api/tasks/:id
 * @desc Delete task
 * @access Admin only
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteTask);

export default router;
