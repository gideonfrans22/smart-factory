import { Router } from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} from "../controllers/userController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * @route   GET /api/users
 * @desc    Get all users with optional filtering
 * @access  Private (Admin only)
 */
router.get("/", getUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin only)
 */
router.get("/:id", authenticateToken, requireAdmin, getUserById);

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (Admin only)
 */
router.post("/", authenticateToken, requireAdmin, createUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin only)
 */
router.put("/:id", authenticateToken, requireAdmin, updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Admin only)
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteUser);

export default router;
