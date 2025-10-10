import { Router } from "express";
import {
  getAlerts,
  getAlertById,
  createAlert,
  acknowledgeAlert,
  deleteAlert
} from "../controllers/alertController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * @route GET /api/alerts
 * @desc Get all alerts with filtering
 * @access Authenticated users
 */
router.get("/", authenticateToken, getAlerts);

/**
 * @route GET /api/alerts/:id
 * @desc Get alert by ID
 * @access Authenticated users
 */
router.get("/:id", authenticateToken, getAlertById);

/**
 * @route POST /api/alerts
 * @desc Create new alert
 * @access Authenticated users
 */
router.post("/", authenticateToken, createAlert);

/**
 * @route PUT /api/alerts/:id/acknowledge
 * @desc Acknowledge alert
 * @access Authenticated users
 */
router.put("/:id/acknowledge", authenticateToken, acknowledgeAlert);

/**
 * @route DELETE /api/alerts/:id
 * @desc Delete alert
 * @access Admin only
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteAlert);

export default router;
