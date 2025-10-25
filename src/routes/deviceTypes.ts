import express from "express";
import {
  getAllDeviceTypes,
  getDeviceTypeById,
  getDevicesByType,
  getAvailableDevicesByType,
  createDeviceType,
  updateDeviceType,
  deleteDeviceType
} from "../controllers/deviceTypeController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all device types
router.get("/", getAllDeviceTypes);

// Get a single device type by ID
router.get("/:id", getDeviceTypeById);

// Get all devices of a specific type
router.get("/:id/devices", getDevicesByType);

// Get available (ONLINE) devices of a specific type
router.get("/:id/devices/available", getAvailableDevicesByType);

// Create a new device type
router.post("/", createDeviceType);

// Update a device type
router.put("/:id", updateDeviceType);

// Delete a device type
router.delete("/:id", deleteDeviceType);

export default router;
