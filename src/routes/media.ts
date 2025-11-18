import { Router } from "express";
import {
  uploadMedia,
  uploadMultipleMedia,
  getMediaById,
  viewMedia,
  downloadMedia,
  deleteMedia
} from "../controllers/mediaController";
import { authenticateToken } from "../middleware/auth";
import { uploadSingle, uploadMultiple } from "../middleware/upload";

const router = Router();

/**
 * @route POST /api/media/upload
 * @desc Upload single media file
 * @access Authenticated users
 */
router.post("/upload", authenticateToken, uploadSingle, uploadMedia);

/**
 * @route POST /api/media/upload/multiple
 * @desc Upload multiple media files
 * @access Authenticated users
 */
router.post(
  "/upload/multiple",
  authenticateToken,
  uploadMultiple,
  uploadMultipleMedia
);

/**
 * @route GET /api/media/:id/view
 * @desc View/Preview media file inline (no download dialog)
 * @access Public (no authentication required)
 * @example
 * // Use in HTML:
 * <img src="/api/media/507f1f77bcf86cd799439011/view" alt="Profile" />
 * <iframe src="/api/media/507f1f77bcf86cd799439011/view"></iframe>
 */
router.get("/:id/view", viewMedia);

/**
 * @route GET /api/media/:id
 * @desc Get media metadata by ID
 * @access Authenticated users
 */
router.get("/:id", authenticateToken, getMediaById);

/**
 * @route GET /api/media/:id/download
 * @desc Download media file
 * @access Authenticated users
 */
router.get("/:id/download", authenticateToken, downloadMedia);

/**
 * @route DELETE /api/media/:id
 * @desc Delete media file
 * @access Authenticated users
 */
router.delete("/:id", authenticateToken, deleteMedia);

export default router;
