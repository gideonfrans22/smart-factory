import { Request, Response } from "express";
import { Device } from "../models/Device";
import { User } from "../models/User";
import {
  APIResponse,
  AuthenticatedRequest,
  JWTPayload,
  RegisterData
} from "../types";
import {
  comparePassword,
  generateToken,
  hashPassword,
  sanitizeInput,
  validateEmail
} from "../utils/helpers";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, name, email, password, role }: RegisterData = req.body;

    // Validation
    if (!name || !password || !role) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name, password, and role are required"
      };
      res.status(400).json(response);
      return;
    }

    if (role === "worker" && !username) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Employee number is required for workers"
      };
      res.status(400).json(response);
      return;
    }

    if (role === "admin" && !email) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Email is required for admin users"
      };
      res.status(400).json(response);
      return;
    }

    if (email && !validateEmail(email)) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid email format"
      };
      res.status(400).json(response);
      return;
    }

    if (password.length < 6) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Password must be at least 6 characters long"
      };
      res.status(400).json(response);
      return;
    }

    // Check if user already exists
    const orConditions = [];
    if (username) orConditions.push({ username });
    if (email) orConditions.push({ email });

    const existingUser =
      orConditions.length > 0
        ? await User.findOne({ $or: orConditions })
        : null;

    if (existingUser) {
      const response: APIResponse = {
        success: false,
        error: "CONFLICT",
        message: "Employee number or email already exists"
      };
      res.status(409).json(response);
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = new User({
      username: username ? sanitizeInput(username) : undefined,
      name: sanitizeInput(name),
      email: email ? email.toLowerCase() : undefined,
      password: hashedPassword,
      role
    });

    await user.save();

    const response: APIResponse = {
      success: true,
      message: "User registered successfully",
      data: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Registration error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "ID/Employee number and password are required"
      };
      res.status(400).json(response);
      return;
    }

    // Find user by email (admin) or employee number (worker)
    const user = await User.findOne({
      $or: [{ email: username }, { username: username }]
    });

    if (!user || !user.isActive) {
      const response: APIResponse = {
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Invalid credentials"
      };
      res.status(401).json(response);
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      const response: APIResponse = {
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Invalid credentials"
      };
      res.status(401).json(response);
      return;
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    // Access Token: { sub, role, username (workers only), iat, exp }
    const accessTokenPayload: JWTPayload = {
      sub: (user._id as any).toString(),
      role: user.role,
      ...(user.role === "worker" && user.username
        ? { username: user.username }
        : {})
    };

    const accessToken = generateToken(accessTokenPayload); // 24 hours

    const response: APIResponse = {
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          role: user.role,
          username: user.username,
          email: user.email,
          department: user.department,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        },
        accessToken
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Login error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const logout = async (
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    // In a production environment, you would:
    // 1. Add the access token to a blacklist with TTL
    // For now, we'll just return success

    const response: APIResponse = {
      success: true,
      message: "Logged out successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Logout error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const getProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "User not found"
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: "Profile retrieved successfully",
      data: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get profile error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const workerLogin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { workerId, deviceId } = req.body;

    // Validation
    if (!workerId || !deviceId) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Worker ID and Device ID are required"
      };
      res.status(400).json(response);
      return;
    }

    // Find worker
    const worker = await User.findById(workerId);

    if (!worker || worker.role !== "worker" || !worker.isActive) {
      const response: APIResponse = {
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Invalid worker ID or worker is inactive"
      };
      res.status(401).json(response);
      return;
    }

    // Find device
    const device = await Device.findById(deviceId).setOptions({
      includeDeleted: false
    });
    if (!device) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "Device not found"
      };
      res.status(404).json(response);
      return;
    }

    // Update device's currentUser
    device.currentUser = worker._id as any;
    device.lastHeartbeat = new Date();
    device.status = "ONLINE";
    await device.save();

    // Update worker's last login
    worker.lastLoginAt = new Date();
    await worker.save();

    // Generate JWT token
    const accessTokenPayload: JWTPayload = {
      sub: (worker._id as any).toString(),
      role: worker.role,
      username: worker.username || undefined
    };

    const accessToken = generateToken(accessTokenPayload); // 24 hours

    const response: APIResponse = {
      success: true,
      message: "Worker login successful",
      data: {
        user: {
          id: worker._id,
          name: worker.name,
          role: worker.role,
          username: worker.username,
          department: worker.department,
          createdAt: worker.createdAt.toISOString(),
          updatedAt: worker.updatedAt.toISOString()
        },
        device: {
          id: device._id,
          name: device.name,
          deviceTypeId: device.deviceTypeId,
          status: device.status
        },
        accessToken
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Worker login error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

export const monitorLogin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Username and password are required"
      };
      res.status(400).json(response);
      return;
    }

    // Only allow monitor user
    if (username !== "monitor") {
      const response: APIResponse = {
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Invalid credentials"
      };
      res.status(401).json(response);
      return;
    }

    // Find monitor user
    const user = await User.findOne({
      username: "monitor",
      role: "monitor"
    });

    if (!user || !user.isActive) {
      const response: APIResponse = {
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Invalid credentials"
      };
      res.status(401).json(response);
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      const response: APIResponse = {
        success: false,
        error: "INVALID_CREDENTIALS",
        message: "Invalid credentials"
      };
      res.status(401).json(response);
      return;
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token with 365 days expiration for monitor
    const accessTokenPayload: JWTPayload = {
      sub: (user._id as any).toString(),
      role: user.role
    };

    const accessToken = generateToken(accessTokenPayload, "365d"); // 365 days

    const response: APIResponse = {
      success: true,
      message: "Monitor authenticated successfully",
      data: {
        accessToken,
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Monitor login error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
