import { Router } from "express";
import * as reportController from "./report.controller";
import { authenticateToken, requireAdmin } from "@shared/middleware";
import { validate } from "@shared/middleware/validate";
import {
  reportGenerateBodySchema,
  reportListQuerySchema,
  reportIdParamSchema,
  reportDownloadParamSchema
} from "./report.validators";

const router = Router();

router.post(
  "/generate",
  authenticateToken,
  validate(reportGenerateBodySchema),
  reportController.generateReport
);

router.get(
  "/",
  authenticateToken,
  validate(reportListQuerySchema, "query"),
  reportController.getReports
);

router.get(
  "/download/:id",
  authenticateToken,
  validate(reportDownloadParamSchema, "params"),
  reportController.downloadReport
);

router.get(
  "/:id",
  authenticateToken,
  validate(reportIdParamSchema, "params"),
  reportController.getReportById
);

router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  validate(reportIdParamSchema, "params"),
  reportController.deleteReport
);

export default router;
