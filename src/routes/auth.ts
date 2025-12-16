import { Router } from "express";
import {
  register,
  login,
  logout,
  getProfile,
  workerLogin
} from "../controllers/authController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// ========================================
// PUBLIC AUTH ENDPOINTS
// ========================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (admin or worker)
 * @body    username - Username (optional, auto-generated for workers)
 * @body    name - Full name (required)
 * @body    email - Email address (optional, required for admins)
 * @body    password - Password (required, min 6 characters)
 * @body    role - User role: "admin" | "worker" (required)
 * @body    department - Department name (optional, supports Korean/English)
 * @response Returns user object with id, username, name, email, role, department, createdAt, updatedAt
 * @access  Public
 * @note    Workers get auto-generated username (W001, W002, etc.) if not provided
 * @note    Email required for admins, optional for workers
 */
router.post("/register", register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get JWT token
 * @body    username - Username (required for workers)
 * @body    email - Email (required for admins)
 * @body    password - Password (required for admins, optional for workers)
 * @response Returns user object and accessToken (24 hours validity)
 * @response User object includes: id, name, username, email, role, department, lastLoginAt, createdAt, updatedAt
 * @access  Public
 * @note    Admin login: Requires email + password
 * @note    Worker login: Username only (no password) for tablet quick login
 * @note    Automatically updates lastLoginAt timestamp on successful login
 */
router.post("/login", login);

/**
 * @route   POST /api/auth/worker-login
 * @desc    Worker login without password (device-based authentication)
 * @body    workerId - Worker user ID (required)
 * @body    deviceId - Device ID where worker is logging in (required)
 * @response Returns user object, device info, and accessToken (24 hours validity)
 * @access  Public
 * @note    No password verification - simplified login for workers at device stations
 * @note    Updates device's currentUser field automatically
 * @note    Only works for users with role="worker"
 */
router.post("/worker-login", workerLogin);

// ========================================
// PROTECTED AUTH ENDPOINTS
// ========================================

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate tokens
 * @body    NONE - Uses Authorization header token
 * @response Returns success message
 * @access  Private (requires valid access token)
 * @note    Invalidates the current session tokens
 */
router.post("/logout", authenticateToken, logout);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current authenticated user profile
 * @response Returns user object: id, name, username, email, role, department, lastLoginAt, createdAt, updatedAt
 * @access  Private (requires valid access token)
 * @note    Use this to verify token validity and get current user info
 */
router.get("/profile", authenticateToken, getProfile);

export default router;
