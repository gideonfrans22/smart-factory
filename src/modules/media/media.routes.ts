import { Router } from "express";
import {
  authenticateToken,
  uploadMultiple,
  uploadSingle
} from "@shared/middleware";
import * as mediaController from "./media.controller";
import { validate } from "@shared/middleware/validate";
import { mediaIdParamSchema } from "./media.validators";

const router = Router();

router.post("/upload", authenticateToken, uploadSingle, mediaController.uploadMedia);

router.post(
  "/upload/multiple",
  authenticateToken,
  uploadMultiple,
  mediaController.uploadMultipleMedia
);

// public (used for previews)
router.get("/:id/view", validate(mediaIdParamSchema, "params"), mediaController.viewMedia);

router.get(
  "/:id",
  authenticateToken,
  validate(mediaIdParamSchema, "params"),
  mediaController.getMediaById
);

router.get(
  "/:id/download",
  authenticateToken,
  validate(mediaIdParamSchema, "params"),
  mediaController.downloadMedia
);

router.delete(
  "/:id",
  authenticateToken,
  validate(mediaIdParamSchema, "params"),
  mediaController.deleteMedia
);

export default router;

