import { Router } from "express";
import {
  register,
  login,
  refreshToken,
  logout,
  getProfile
} from "../controllers/authController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (manager or worker)
 * @access  Public
 */
router.post("/register", register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get JWT tokens
 * @access  Public
 */
router.post("/login", login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post("/refresh", refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 */
router.post("/logout", authenticateToken, logout);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/profile", authenticateToken, getProfile);

export default router;
