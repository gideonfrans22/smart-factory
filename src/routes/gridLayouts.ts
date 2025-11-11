import express from "express";
import {
  getGridLayouts,
  getGridLayoutById,
  createGridLayout,
  updateGridLayout,
  updateDevicePosition,
  bulkUpdateDevicePositions,
  deleteGridLayout
} from "../controllers/gridLayoutController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Get all grid layouts
router.get("/", authenticateToken, getGridLayouts);

// Get grid layout by ID
router.get("/:id", authenticateToken, getGridLayoutById);

// Create grid layout
router.post("/", authenticateToken, createGridLayout);

// Update grid layout (general update: name, description, columns, rows)
router.patch("/:id", authenticateToken, updateGridLayout);

// Bulk update device positions in grid layout
router.patch("/:id/devices", authenticateToken, bulkUpdateDevicePositions);

// Update single device position in grid layout
router.patch("/:id/devices/:deviceId", authenticateToken, updateDevicePosition);

// Delete grid layout
router.delete("/:id", authenticateToken, deleteGridLayout);

export default router;
