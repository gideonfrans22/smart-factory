import { Router } from "express";
import {
  uploadTaskMedia,
  uploadMultipleTaskMedia,
  getTaskMedia,
  deleteTaskMedia,
  downloadTaskMedia
} from "../controllers/taskMediaController";
import { authenticateToken } from "../middleware/auth";
import { uploadSingle, uploadMultiple } from "../middleware/upload";

const router = Router();

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
