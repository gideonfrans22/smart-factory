import express from "express";
import {
  getAllRawMaterials,
  getRawMaterialById,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial
} from "../controllers/rawMaterialController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/raw-materials - Get all raw materials
router.get("/", getAllRawMaterials);

// GET /api/raw-materials/:id - Get raw material by ID
router.get("/:id", getRawMaterialById);

// POST /api/raw-materials - Create new raw material
router.post("/", createRawMaterial);

// PUT /api/raw-materials/:id - Update raw material
router.put("/:id", updateRawMaterial);

// DELETE /api/raw-materials/:id - Delete raw material
router.delete("/:id", deleteRawMaterial);

export default router;
