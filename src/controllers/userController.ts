import { Request, Response } from "express";
import { User } from "../models/User";
import { Task } from "../models/Task";
import { Device } from "../models/Device";
import { APIResponse, AuthenticatedRequest } from "../types";
import { hashPassword, sanitizeInput, validateEmail } from "../utils/helpers";
import { realtimeService } from "../services/realtimeService";
import mongoose from "mongoose";

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
      .populate("modifiedBy", "name email username")
      .select("-password")
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    const response: APIResponse = {
      success: true,
      message: "Users retrieved successfully",
      data: {
        items: users,
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

    const user = await User.findById(id)
      .populate("modifiedBy", "name email username")
      .select("-password");

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
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
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
    const loggedInUser = req.user;
    const { username, name, email, password, role, department } = req.body;

    // Validation
    if (!name || !role) {
      const response: APIResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Name, and role are required"
      };
      res.status(400).json(response);
      return;
    }

    // if (role === "worker" && !username) {
    //   const response: APIResponse = {
    //     success: false,
    //     error: "VALIDATION_ERROR",
    //     message: "Employee number is required for workers"
    //   };
    //   res.status(400).json(response);
    //   return;
    // }

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
    if (username) orConditions.push({ username });
    if (email) orConditions.push({ email });

    const existingUser =
      orConditions.length > 0
        ? await User.findOne({ $or: orConditions })
        : null;

    if (existingUser) {
      const response: APIResponse = {
        success: false,
        error: "DUPLICATE_ERROR",
        message: "Employee number or email already exists"
      };
      res.status(409).json(response);
      return;
    }

    let hashedPassword = "";
    if (password) {
      // Hash password
      hashedPassword = await hashPassword(password);
    }

    // Create user
    const user = new User({
      username: username ? sanitizeInput(username) : undefined,
      name: sanitizeInput(name),
      email: email ? email.toLowerCase() : undefined,
      password: hashedPassword,
      role,
      department: department ? sanitizeInput(department) : undefined,
      modifiedBy: loggedInUser?._id as mongoose.Types.ObjectId
    });

    await user.save();

    const response: APIResponse = {
      success: true,
      message: "User created successfully",
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
    console.error("Create user error:", error);

    // Better error messages for debugging
    let errorMessage = "Internal server error";
    let errorCode = "INTERNAL_SERVER_ERROR";

    if (error instanceof Error) {
      // Check for specific MongoDB/validation errors
      if (
        error.message.includes("duplicate") ||
        error.message.includes("unique")
      ) {
        errorMessage = "Email or username already exists";
        errorCode = "DUPLICATE_ERROR";
      } else if (error.message.includes("validation")) {
        errorMessage = error.message;
        errorCode = "VALIDATION_ERROR";
      } else {
        errorMessage = error.message;
      }
      console.error("Error details:", error.message);
    }

    const response: APIResponse = {
      success: false,
      error: errorCode,
      message: errorMessage
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
    const loggedInUser = req.user;

    const { id } = req.params;
    const { name, email, isActive, role, lastLoginAt, department, password } =
      req.body;

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
    if (role) user.role = role;
    if (lastLoginAt !== undefined) {
      user.lastLoginAt = lastLoginAt ? new Date(lastLoginAt) : undefined;
    }
    if (department !== undefined) {
      user.department = department ? sanitizeInput(department) : undefined;
    }
    if (password) {
      user.password = await hashPassword(password);
    }

    // Track who modified the user
    user.modifiedBy = loggedInUser?._id as mongoose.Types.ObjectId;

    await user.save();

    // If worker updated, emit WebSocket event to all devices using this worker
    if (user.role === "worker") {
      const devices = await Device.find({ currentUser: user._id });

      // Emit device status update for each device to refresh currentUser info
      for (const device of devices) {
        await realtimeService.broadcastDeviceUpdate(device);
      }
    }

    const response: APIResponse = {
      success: true,
      message: "User updated successfully",
      data: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
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

/**
 * Get worker statistics with performance metrics
 * @route GET /api/workers/statistics
 * @query timeRange: daily | weekly | monthly (default: daily)
 * @query status: ACTIVE | ON_LEAVE | OFFLINE (optional)
 * @query department: string (optional)
 * @query limit: number (default: 100)
 */
export const getWorkerStatistics = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      timeRange = "daily",
      department: departmentFilter,
      limit = 100
    } = req.query;

    // Calculate time range
    const now = new Date();
    let startDate = new Date();

    if (timeRange === "weekly") {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === "monthly") {
      startDate.setMonth(now.getMonth() - 1);
    } else {
      // daily
      startDate.setDate(now.getDate() - 1);
    }

    // Build worker query
    const workerQuery: any = { role: "worker" };
    if (departmentFilter) workerQuery.department = departmentFilter;

    // Fetch all workers
    const workers = await User.find(workerQuery)
      .limit(parseInt(limit as string))
      .select("-password");

    // Calculate statistics for each worker
    const workerStats = await Promise.all(
      workers.map(async (worker) => {
        // Get all tasks for this worker in the time range
        const allTasks = await Task.find({
          workerId: worker._id,
          createdAt: { $gte: startDate, $lte: now }
        })
          .populate("recipeSnapshotId", "name")
          .populate("productSnapshotId", "customerName");

        const assignedTasks = allTasks.length;
        const completedTasks = allTasks.filter(
          (t) => t.status === "COMPLETED"
        ).length;
        const inProgressTasks = allTasks.filter(
          (t) => t.status === "ONGOING"
        ).length;
        const failedTasks = allTasks.filter(
          (t) => t.status === "FAILED"
        ).length;

        // Calculate completion rate
        const completionRate =
          assignedTasks > 0 ? (completedTasks / assignedTasks) * 100 : 0;

        // Calculate average duration
        const completedTasksWithDuration = allTasks
          .filter((t) => t.status === "COMPLETED" && t.actualDuration)
          .map((t) => t.actualDuration || 0);
        const avgDuration =
          completedTasksWithDuration.length > 0
            ? completedTasksWithDuration.reduce((a, b) => a + b, 0) /
              completedTasksWithDuration.length
            : 0;

        // Calculate quality score (error-free tasks / completed tasks)
        const errorFreeTasks = completedTasks - failedTasks;
        const qualityScore =
          completedTasks > 0
            ? (Math.max(0, errorFreeTasks) / completedTasks) * 100
            : 0;

        // Get current task
        const currentTask = allTasks.find((t) => t.status === "ONGOING");

        // Calculate productivity (on-time completed / total assigned)
        // Assuming on-time means completed before estimated duration
        const onTimeCompleted = allTasks.filter((t) => {
          if (t.status !== "COMPLETED") return false;
          if (t.actualDuration && t.estimatedDuration) {
            return t.actualDuration <= t.estimatedDuration;
          }
          return true;
        }).length;
        const productivity =
          assignedTasks > 0 ? (onTimeCompleted / assignedTasks) * 100 : 0;

        // Calculate total hours worked (sum of actualDuration)
        const totalMinutesWorked = allTasks
          .filter((t) => t.actualDuration)
          .reduce((sum, t) => sum + (t.actualDuration || 0), 0);
        const totalHoursWorked = totalMinutesWorked / 60;

        // Tasks per hour
        const tasksPerHour =
          totalHoursWorked > 0
            ? completedTasks / totalHoursWorked
            : completedTasks;

        // Performance rating based on metrics
        const avgMetric = (completionRate + qualityScore + productivity) / 3;
        let performanceRating = "AVERAGE";
        if (avgMetric >= 85) {
          performanceRating = "EXCELLENT";
        } else if (avgMetric >= 70) {
          performanceRating = "GOOD";
        } else if (avgMetric >= 50) {
          performanceRating = "AVERAGE";
        } else {
          performanceRating = "POOR";
        }

        return {
          workerId: worker._id,
          workerName: worker.name,
          department: worker.department || "N/A",
          status: worker.isActive ? "ACTIVE" : "OFFLINE",
          completionRate: Math.round(completionRate),
          avgDuration: Math.round(avgDuration),
          qualityScore: Math.round(qualityScore),
          taskCount: {
            assigned: assignedTasks,
            completed: completedTasks,
            inProgress: inProgressTasks,
            failed: failedTasks
          },
          currentTask: currentTask
            ? {
                taskId: currentTask._id,
                taskName: currentTask.title,
                device: currentTask.deviceId
                  ? currentTask.deviceId.toString()
                  : "N/A",
                progress: currentTask.progress,
                startTime: currentTask.startedAt,
                // Add recipe/part name from snapshot
                partName:
                  (currentTask as any).recipeSnapshotId?.name || undefined,
                // Add customer name from product snapshot
                customerName:
                  (currentTask as any).productSnapshotId?.customerName ||
                  undefined,
                // Include full snapshot references
                recipeSnapshotId: (currentTask as any).recipeSnapshotId
                  ? {
                      _id: (currentTask as any).recipeSnapshotId._id.toString(),
                      name: (currentTask as any).recipeSnapshotId.name
                    }
                  : undefined,
                productSnapshotId: (currentTask as any).productSnapshotId
                  ? {
                      _id: (
                        currentTask as any
                      ).productSnapshotId._id.toString(),
                      customerName: (currentTask as any).productSnapshotId
                        .customerName
                    }
                  : undefined
              }
            : null,
          productivity: Math.round(productivity),
          totalHoursWorked: Math.round(totalHoursWorked),
          tasksPerHour: Math.round(tasksPerHour * 10) / 10,
          lastActivityTime:
            allTasks.length > 0
              ? new Date(
                  Math.max(
                    ...allTasks.map((t) => new Date(t.updatedAt).getTime())
                  )
                )
              : null,
          performanceRating
        };
      })
    );

    // Calculate summary
    const totalWorkers = workerStats.length;
    const activeWorkers = workerStats.filter(
      (w) => w.status === "ACTIVE"
    ).length;
    const avgCompletionRate =
      totalWorkers > 0
        ? workerStats.reduce((sum, w) => sum + w.completionRate, 0) /
          totalWorkers
        : 0;
    const avgQualityScore =
      totalWorkers > 0
        ? workerStats.reduce((sum, w) => sum + w.qualityScore, 0) / totalWorkers
        : 0;
    const avgProductivity =
      totalWorkers > 0
        ? workerStats.reduce((sum, w) => sum + w.productivity, 0) / totalWorkers
        : 0;

    const response: APIResponse = {
      success: true,
      message: "Worker statistics retrieved successfully",
      data: {
        items: workerStats,
        summary: {
          totalWorkers,
          activeWorkers,
          avgCompletionRate: Math.round(avgCompletionRate),
          avgQualityScore: Math.round(avgQualityScore),
          avgProductivity: Math.round(avgProductivity)
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Get worker statistics error:", error);
    const response: APIResponse = {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    };
    res.status(500).json(response);
  }
};
