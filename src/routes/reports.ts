import { Router } from "express";
import {
  generateReport,
  getReports,
  downloadReport,
  deleteReport
} from "../controllers/reportController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * @route POST /api/reports/generate
 * @desc Generate a new report
 * @access Authenticated users
 */
router.post("/generate", authenticateToken, generateReport);

/**
 * @route GET /api/reports
 * @desc Get all reports with filtering
 * @access Authenticated users
 */
router.get("/", authenticateToken, getReports);

/**
 * @route GET /api/reports/download/:id
 * @desc Download report file
 * @access Authenticated users
 */
router.get("/download/:id", authenticateToken, downloadReport);

/**
 * @route DELETE /api/reports/:id
 * @desc Delete report
 * @access Admin only
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteReport);

export default router;
