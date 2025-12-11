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
  getGroupedTasks,
  getWorkerTasks,
  getDeviceTasks,
  batchUpdateTasks
} from "../controllers/taskController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

// ========================================
// QUERY ENDPOINTS (GET)
// ========================================

/**
 * @route GET /api/tasks
 * @desc Get all tasks with filtering and pagination
 * @query status - Filter by task status (PENDING, ONGOING, PAUSED, COMPLETED, FAILED)
 * @query workerId - Filter by worker ID
 * @query deviceId - Filter by device ID
 * @query deviceTypeId - Filter by device type ID
 * @query projectId - Filter by project ID
 * @query recipeId - Filter by recipe ID
 * @query productId - Filter by product ID
 * @query search - Search in task title, recipe name, or product name
 * @query includePendingAndPartial - "true" to include PENDING + ONGOING + PAUSED + COMPLETED (progress < 100)
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 10)
 * @access Authenticated users
 */
router.get("/", authenticateToken, getTasks);

/**
 * @route GET /api/tasks/statistics
 * @desc Get task statistics and metrics
 * @query projectId - Filter by project (optional)
 * @query deviceTypeId - Filter by device type (optional)
 * @query workerId - Filter by worker (optional)
 * @query startDate - Filter by start date (optional)
 * @query endDate - Filter by end date (optional)
 * @access Authenticated users
 */
router.get("/statistics", authenticateToken, getTaskStatistics);

/**
 * @route GET /api/tasks/grouped
 * @desc Get tasks grouped by project > product > recipe hierarchy
 * @query projectStatus - Filter by project status (optional)
 * @query taskStatus - Filter by task status (optional)
 * @query startDate - Filter by start date (optional)
 * @query endDate - Filter by end date (optional)
 * @query search - Search in project/recipe/product names (optional)
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 10)
 * @access Authenticated users
 */
router.get("/grouped", authenticateToken, getGroupedTasks);

/**
 * @route GET /api/tasks/standalone
 * @desc Get standalone tasks (not associated with any project)
 * @query status - Filter by status (optional)
 * @query deviceId - Filter by device (optional)
 * @query deviceTypeId - Filter by device type (optional)
 * @query recipeId - Filter by recipe (optional)
 * @query workerId - Filter by worker (optional)
 * @query search - Search in task title or recipe name (optional)
 * @query page - Page number (default: 1)
 * @query limit - Items per page (default: 10)
 * @access Authenticated users
 */
router.get("/standalone", authenticateToken, getStandaloneTasks);

/**
 * @route GET /api/tasks/:id
 * @desc Get task by ID with populated references
 * @access Authenticated users
 */
router.get("/:id", authenticateToken, getTaskById);

// ========================================
// TASK CREATION (POST)
// ========================================

/**
 * @route POST /api/tasks
 * @desc Create new standalone task (not part of a project)
 * @body title - Task title (required)
 * @body description - Task description (optional)
 * @body recipeId - Recipe ID (required if no productId)
 * @body productId - Product ID (required if no recipeId)
 * @body deviceId - Device ID (optional)
 * @body workerId - Worker ID (optional)
 * @body status - Initial status (default: PENDING)
 * @body priority - Priority level (default: MEDIUM)
 * @body estimatedDuration - Estimated duration in milliseconds (optional)
 * @body notes - Additional notes (optional)
 * @body qualityData - Quality data object (optional)
 * @access Admin only
 */
router.post("/", authenticateToken, requireAdmin, createTask);

// ========================================
// TASK LIFECYCLE (POST - State Changes)
// ========================================

/**
 * @route POST /api/tasks/:id/start
 * @desc Start a new PENDING task
 * @body workerId - Worker ID (required)
 * @body deviceId - Device ID (optional)
 * @response Sets status to ONGOING, startedAt timestamp, initializes progress to 0
 * @access Authenticated users
 */
router.post("/:id/start", authenticateToken, startTask);

/**
 * @route POST /api/tasks/:id/resume
 * @desc Resume a PAUSED or partially COMPLETED task
 * @body NONE - Empty body (workerId and deviceId already assigned)
 * @response Sets status to ONGOING, PRESERVES existing progress value
 * @access Authenticated users
 * @critical Progress is NEVER reset when resuming!
 */
router.post("/:id/resume", authenticateToken, resumeTask);

/**
 * @route POST /api/tasks/:id/pause
 * @desc Pause an ONGOING task
 * @body NONE - Empty body
 * @response Sets status to PAUSED, preserves progress
 * @access Authenticated users
 */
router.post("/:id/pause", authenticateToken, pauseTask);

/**
 * @route POST /api/tasks/:id/complete
 * @desc Complete a task (supports partial completion)
 * @body workerId - Worker ID (optional if already assigned)
 * @body qualityData.progress - Progress percentage 0-100 (optional, defaults to 100)
 * @body qualityData - Additional quality data (optional)
 * @body notes - Completion notes (optional)
 * @body actualDuration - Actual duration in minutes (optional, auto-calculated if not provided)
 * @response Sets status to COMPLETED, progress from qualityData or 100, creates next step task if applicable
 * @access Authenticated users
 * @critical Supports partial completion: qualityData.progress can be < 100!
 */
router.post("/:id/complete", authenticateToken, completeTask);

/**
 * @route POST /api/tasks/:id/fail
 * @desc Mark a task as FAILED
 * @body notes - Failure reason (optional)
 * @response Sets status to FAILED, preserves progress
 * @access Authenticated users
 */
router.post("/:id/fail", authenticateToken, failTask);

/**
 * @route POST /api/tasks/:id/status
 * @desc Update task status (legacy endpoint, prefer using dedicated endpoints above)
 * @body status - New status (PENDING, ONGOING, PAUSED, COMPLETED, FAILED)
 * @body notes - Notes (optional)
 * @body startTime - Start time (optional)
 * @body endTime - End time (optional)
 * @body progress - Progress percentage (optional)
 * @body workerId - Worker ID (optional)
 * @body deviceId - Device ID (optional)
 * @access Authenticated users
 * @deprecated Use dedicated endpoints (start, resume, pause, complete, fail) instead
 */
router.post("/:id/status", authenticateToken, updateTaskStatus);

// ========================================
// TASK UPDATE (PATCH - Field Updates)
// ========================================

/**
 * @route PATCH /api/tasks/batch
 * @desc Batch update multiple tasks with the same set of fields
 * @body taskIds - Array of task IDs to update (required)
 * @body updates - Object containing fields to update (required)
 * @body updates.status - Status (optional)
 * @body updates.priority - Priority (LOW, MEDIUM, HIGH, URGENT) (optional)
 * @body updates.notes - Notes text (optional)
 * @body updates.mediaFiles - Array of media file paths (optional)
 * @body updates.deviceId - Device ID (optional)
 * @body updates.workerId - Worker ID (optional)
 * @body updates.pausedDuration - Paused duration in milliseconds (optional)
 * @body updates.startedAt - Started timestamp (optional)
 * @body updates.completedAt - Completed timestamp (optional)
 * @body updates.progress - Progress percentage 0-100 (optional)
 * @response Returns updated tasks and summary of results
 * @access Authenticated users
 */
router.patch("/batch", authenticateToken, batchUpdateTasks);

/**
 * @route PATCH /api/tasks/:id
 * @desc Partial update of task fields (does NOT change status - use POST endpoints for that)
 * @body status - Status (optional, but prefer using POST endpoints)
 * @body priority - Priority (LOW, MEDIUM, HIGH, URGENT)
 * @body notes - Notes text
 * @body mediaFiles - Array of media file paths
 * @body deviceId - Device ID
 * @body workerId - Worker ID
 * @body pausedDuration - Paused duration in milliseconds
 * @body startedAt - Started timestamp
 * @body completedAt - Completed timestamp
 * @body progress - Progress percentage 0-100 (use this to update progress during work)
 * @response Returns updated task with all populated references
 * @access Authenticated users
 * @note Use this endpoint to update progress incrementally (e.g., from 30% to 50%)
 */
router.patch("/:id", authenticateToken, updateTask);

// ========================================
// TASK DELETION (DELETE)
// ========================================

/**
 * @route DELETE /api/tasks/:id
 * @desc Delete a task permanently with comprehensive handling of dependencies
 * @query cascadeDelete - "true" to delete dependent tasks recursively (default: "false")
 * @response Handles:
 *   - Dependent tasks (prevents deletion or cascades based on cascadeDelete)
 *   - Project progress recalculation
 *   - Project producedQuantity recalculation
 *   - Device cleanup (clears currentTask reference)
 *   - Project completion status update
 *   - Realtime broadcasts
 * @access Admin only
 * @note If task has dependent tasks and cascadeDelete=false, deletion is prevented
 * @note If cascadeDelete=true, all dependent tasks are deleted recursively
 * @note If cascadeDelete=false but dependent tasks exist, their dependency is removed
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteTask);

/**
 * @route GET /api/tasks/device/:deviceId
 * @desc Get tasks assigned to a specific device
 * @access All users
 */
router.get("/device/:deviceId", getDeviceTasks);

/**
 * @route GET /api/tasks/worker/:workerId
 * @desc Get tasks assigned to a specific worker
 * @access All users
 */
router.get("/worker/:workerId", getWorkerTasks);

export default router;
