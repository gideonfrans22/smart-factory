"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var authController_1 = require("../controllers/authController");
var auth_1 = require("../middleware/auth");
var router = (0, express_1.Router)();
/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (manager or worker)
 * @access  Public
 */
router.post('/register', authController_1.register);
/**
 * @route   POST /api/auth/login
 * @desc    Login user and get JWT token
 * @access  Public
 */
router.post('/login', authController_1.login);
/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', auth_1.authenticateToken, authController_1.getProfile);
exports.default = router;
