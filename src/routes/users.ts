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

// ========================================
// USER QUERY ENDPOINTS (GET)
// ========================================

/**
 * @route   GET /api/users
 * @desc    Get all users with optional filtering and pagination
 * @query   role - Filter by role: "admin" | "worker" (optional)
 * @query   isActive - Filter by active status: "true" | "false" (optional)
 * @query   search - Search in name, username, email (optional)
 * @query   department - Filter by department (optional)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10)
 * @response Returns paginated list with: id, username, name, email, role, department, isActive, lastLoginAt, createdAt, updatedAt
 * @access  Private (Admin only)
 */
router.get("/", getUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Get user details by ID
 * @response Returns full user object including: id, username, name, email, role, department, isActive, lastLoginAt, createdAt, updatedAt
 * @access  Private (Admin only)
 */
router.get("/:id", authenticateToken, requireAdmin, getUserById);

// ========================================
// USER MANAGEMENT (POST, PUT, DELETE)
// ========================================

/**
 * @route   POST /api/users
 * @desc    Create new user (admin or worker)
 * @body    username - Username (optional, auto-generated for workers if not provided)
 * @body    name - Full name (required)
 * @body    email - Email address (optional, required for admins)
 * @body    password - Password (required)
 * @body    role - User role: "admin" | "worker" (required)
 * @body    department - Department name (optional, supports Korean/English, max 100 chars)
 * @body    isActive - Active status (default: true)
 * @response Returns created user with id, username, name, email, role, department, isActive, createdAt, updatedAt
 * @access  Private (Admin only)
 * @note    Workers get auto-generated username (W001, W002, etc.) if not provided
 */
router.post("/", authenticateToken, requireAdmin, createUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update existing user
 * @body    username - Username (optional)
 * @body    name - Full name (optional)
 * @body    email - Email address (optional)
 * @body    password - New password (optional)
 * @body    role - User role: "admin" | "worker" (optional)
 * @body    department - Department name (optional, can be null to clear)
 * @body    isActive - Active status (optional)
 * @body    lastLoginAt - Last login timestamp ISO string (optional, for tablet worker login tracking)
 * @response Returns updated user with id, username, name, email, role, department, isActive, lastLoginAt, createdAt, updatedAt
 * @access  Private (Admin only)
 * @note    Use lastLoginAt field to manually update worker login time from tablet
 * @note    Department field accepts Korean/English text, max 100 characters
 */
router.put("/:id", authenticateToken, requireAdmin, updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user permanently
 * @access  Private (Admin only)
 * @warning This is a hard delete - user data will be permanently removed
 */
router.delete("/:id", authenticateToken, requireAdmin, deleteUser);

export default router;
