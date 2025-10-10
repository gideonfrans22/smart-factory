import express from "express";
import {
  getStepMedia,
  uploadStepMedia,
  uploadMultipleStepMedia,
  downloadStepMedia,
  deleteStepMedia,
  updateStepMedia
} from "../controllers/recipeMediaController";
import { authenticateToken } from "../middleware/auth";
import upload from "../middleware/upload";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all media for a recipe step
router.get("/:recipeId/steps/:stepId/media", getStepMedia);

// Upload single media to a recipe step
router.post(
  "/:recipeId/steps/:stepId/media",
  upload.single("file"),
  uploadStepMedia
);

// Upload multiple media files to a recipe step
router.post(
  "/:recipeId/steps/:stepId/media/multiple",
  upload.array("files", 10),
  uploadMultipleStepMedia
);

// Download/view a specific media file
router.get(
  "/:recipeId/steps/:stepId/media/:mediaId/download",
  downloadStepMedia
);

// Update media metadata
router.put("/:recipeId/steps/:stepId/media/:mediaId", updateStepMedia);

// Delete a specific media file
router.delete("/:recipeId/steps/:stepId/media/:mediaId", deleteStepMedia);

export default router;
