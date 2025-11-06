import { Router } from "express";
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  startTask,
  resumeTask,
  pauseTask,
  failTask,
  completeTask,
  getStandaloneTasks,
  getTaskStatistics,
  getGroupedTasks
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
 * @route GET /api/tasks/statistics
 * @desc Get task statistics and metrics
 * @access Authenticated users
 */
router.get("/statistics", authenticateToken, getTaskStatistics);

/**
 * @route GET /api/tasks/grouped
 * @desc Get tasks grouped by project > product > recipe hierarchy
 * @access Authenticated users
 */
router.get("/grouped", authenticateToken, getGroupedTasks);

/**
 * @route GET /api/tasks/standalone
 * @desc Get standalone tasks (not associated with any project)
 * @access Authenticated users
 */
router.get("/standalone", authenticateToken, getStandaloneTasks);

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
 * @route POST /api/tasks/:id/start
 * @desc Start a new task (set status to ONGOING)
 * @access Authenticated users
 */
router.post("/:id/start", authenticateToken, startTask);

/**
 * @route POST /api/tasks/:id/resume
 * @desc Resume a paused or partially completed task (preserves progress!)
 * @access Authenticated users
 */
router.post("/:id/resume", authenticateToken, resumeTask);

/**
 * @route POST /api/tasks/:id/pause
 * @desc Pause an ongoing task
 * @access Authenticated users
 */
router.post("/:id/pause", authenticateToken, pauseTask);

/**
 * @route POST /api/tasks/:id/complete
 * @desc Complete task and handle next step creation (supports partial completion)
 * @access Authenticated users
 */
router.post("/:id/complete", authenticateToken, completeTask);

/**
 * @route POST /api/tasks/:id/fail
 * @desc Mark task as failed
 * @access Authenticated users
 */
router.post("/:id/fail", authenticateToken, failTask);

/**
 * @route POST /api/tasks/:id/status
 * @desc Update task status
 * @access Authenticated users
 */
router.post("/:id/status", authenticateToken, updateTaskStatus);

/**
 * @route PATCH /api/tasks/:id
 * @desc Partial update task (status, priority, notes, mediaFiles, deviceId, workerId, progress, etc.)
 * @access Authenticated users
 */
router.patch("/:id", authenticateToken, updateTask);

/**
 * @route DELETE /api/tasks/:id
 * @desc Delete task
 * @access Admin only
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteTask);

export default router;
