import { Router } from "express";
import {
  getDevices,
  getDeviceById,
  registerDevice,
  updateDevice,
  deleteDevice
} from "../controllers/deviceController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * @route GET /api/devices
 * @desc Get all devices with filtering
 */
router.get("/", getDevices);

/**
 * @route GET /api/devices/:id
 * @desc Get device by ID
 * @access Authenticated users
 */
router.get("/:id", authenticateToken, getDeviceById);

/**
 * @route POST /api/devices/register
 * @desc Register new device (no auth required)
 * @access Public
 */
router.post("/register", registerDevice);

/**
 * @route PUT /api/devices/:id
 * @desc Update device
 * @access Admin only
 */
router.put("/:id", authenticateToken, requireAdmin, updateDevice);

/**
 * @route DELETE /api/devices/:id
 * @desc Delete device
 * @access Admin only
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteDevice);

export default router;
