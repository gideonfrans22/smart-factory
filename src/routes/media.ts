import { Router } from "express";
import {
  uploadMedia,
  uploadMultipleMedia,
  getMediaById,
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
 * @route GET /api/media/:id
 * @desc Get media by ID
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
