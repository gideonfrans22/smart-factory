import { Request, Response } from "express";
import { User } from "../models/User";
import { APIResponse, AuthenticatedRequest } from "../types";
import { hashPassword, sanitizeInput, validateEmail } from "../utils/helpers";

/**
 * Get all users with optional filtering and pagination
 * GET /api/users?role=worker&page=1&limit=10
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, page = 1, limit = 10 } = req.query;

    // Build query
    const query: any = {};
    if (role) {
      query.role = role;
    }

    // Calculate pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await User.countDocuments(query);

    // Get users
    const users = await User.find(query)
      .select("-password")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Users retrieved successfully",
      data: {
        items: users.map((user) => ({
          id: user._id,
          empNo: user.empNo,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get users error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
export const getUserById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password");

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
      message: "User retrieved successfully",
      data: {
        id: user._id,
        empNo: user.empNo,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get user error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Create new user
 * POST /api/users
 */
export const createUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { empNo, name, email, password, role } = req.body;

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

    if (role === "worker" && !empNo) {
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

    // Check if user already exists
    const orConditions = [];
    if (empNo) orConditions.push({ empNo });
    if (email) orConditions.push({ email });

    const existingUser =
      orConditions.length > 0
        ? await User.findOne({ $or: orConditions })
        : null;

    if (existingUser) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_ENTRY",
        message: "Employee number or email already exists"
      };
      res.status(409).json(response);
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = new User({
      empNo: empNo ? sanitizeInput(empNo) : undefined,
      name: sanitizeInput(name),
      email: email ? email.toLowerCase() : undefined,
      password: hashedPassword,
      role
    });

    await user.save();

    const response: APIResponse = {
      success: true,
      message: "User created successfully",
      data: {
        id: user._id,
        empNo: user.empNo,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Create user error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Update user
 * PUT /api/users/:id
 */
export const updateUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, isActive } = req.body;

    const user = await User.findById(id);

    if (!user) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "User not found"
      };
      res.status(404).json(response);
      return;
    }

    // Update fields
    if (name) user.name = sanitizeInput(name);
    if (email !== undefined) {
      if (email && !validateEmail(email)) {
        const response: APIResponse = {
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid email format"
        };
        res.status(400).json(response);
        return;
      }
      user.email = email ? email.toLowerCase() : undefined;
    }
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    const response: APIResponse = {
      success: true,
      message: "User updated successfully",
      data: {
        id: user._id,
        empNo: user.empNo,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Update user error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};

/**
 * Delete user
 * DELETE /api/users/:id
 */
export const deleteUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      const response: APIResponse = {
        success: false,
        error: "NOT_FOUND",
        message: "User not found"
      };
      res.status(404).json(response);
      return;
    }

    await User.findByIdAndDelete(id);

    const response: APIResponse = {
      success: true,
      message: "User deleted successfully"
    };

    res.json(response);
  } catch (error) {
    console.error("Delete user error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
