import { Router } from "express";
import {
  getAlerts,
  getAlertById,
  createAlert,
  acknowledgeAlert,
  readAlert,
  resolveAlert,
  bulkReadAlerts,
  bulkAcknowledgeAlerts,
  bulkResolveAlerts,
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
 * @route POST /api/alerts/bulk-read
 * @desc Bulk mark alerts as read
 * @access Authenticated users
 */
router.post("/bulk-read", authenticateToken, bulkReadAlerts);

/**
 * @route POST /api/alerts/bulk-acknowledge
 * @desc Bulk acknowledge alerts
 * @access Authenticated users
 */
router.post("/bulk-acknowledge", authenticateToken, bulkAcknowledgeAlerts);

/**
 * @route POST /api/alerts/bulk-resolve
 * @desc Bulk resolve alerts
 * @access Authenticated users
 */
router.post("/bulk-resolve", authenticateToken, bulkResolveAlerts);

/**
 * @route PATCH /api/alerts/:id/read
 * @desc Mark alert as read
 * @access Authenticated users
 */
router.patch("/:id/read", authenticateToken, readAlert);

/**
 * @route PATCH /api/alerts/:id/acknowledge
 * @desc Acknowledge alert
 * @access Authenticated users
 */
router.patch("/:id/acknowledge", authenticateToken, acknowledgeAlert);

/**
 * @route PATCH /api/alerts/:id/resolve
 * @desc Resolve alert
 * @access Authenticated users
 */
router.patch("/:id/resolve", authenticateToken, resolveAlert);

/**
 * @route DELETE /api/alerts/:id
 * @desc Delete alert
 * @access Admin only
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteAlert);

export default router;
