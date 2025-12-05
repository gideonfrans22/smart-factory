import { Router } from "express";
import {
  getDevices,
  getDeviceById,
  registerDevice,
  updateDevice,
  deleteDevice,
  getDeviceStatistics,
  getDevicesByTask,
  getDevicesMonitorData
} from "../controllers/deviceController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * @route GET /api/devices
 * @desc Get all devices with filtering
 */
router.get("/", getDevices);

/**
 * @route GET /api/devices/statistics
 * @desc Get device health and performance metrics
 * @access Admin only
 */
router.get("/statistics", authenticateToken, requireAdmin, getDeviceStatistics);

/**
 * @route GET /api/devices/by-task
 * @desc Get devices grouped by tasks (device-centric view)
 * @access Admin only
 */
router.get("/by-task", authenticateToken, requireAdmin, getDevicesByTask);

/**
 * @route GET /api/devices/:id
 * @desc Get device by ID
 * @access Authenticated users
 */
router.get("/:id", authenticateToken, getDeviceById);

/**
 * @route POST /api/devices/register
 * @desc Register new device
 * @access Public
 */
router.post("/register", authenticateToken, requireAdmin, registerDevice);

/**
 * @route PUT /api/devices/:id
 * @desc Update device
 * @access Admin only
 */
router.put("/:id", authenticateToken, updateDevice);

/**
 * @route DELETE /api/devices/:id
 * @desc Delete device
 * @access Admin only
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteDevice);

/**
 * @route GET /api/devices/monitor-layout/:id
 * @desc Get devices in a grid layout for monitoring
 * @access Authenticated users
 */
router.get("/monitor-layout/:id", authenticateToken, getDevicesMonitorData);

export default router;
