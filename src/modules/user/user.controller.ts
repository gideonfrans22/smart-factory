import { Device } from "@/models";
import { getOnlineCountByRole, realtimeService } from "@shared/services";
import { Response } from "express";
import { getIO } from "@infra/config";
import { APIResponse, AuthenticatedRequest } from "@shared/types";
import { User } from "./user.model";
import { userService } from "./user.service";

export class UserController {
  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const result = await userService.list(req.query as any);

      const response: APIResponse = {
        success: true,
        message: "Users retrieved successfully",
        data: result
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
  }

  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const user = await userService.getById(id);

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
          deletedAt: user.deletedAt ?? null,
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
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const loggedInUser = req.user;

      const user = await userService.create(
        req.body,
        loggedInUser?._id?.toString()
      );

      try {
        const io = getIO();
        const onlineCounts = await getOnlineCountByRole();

        const [adminTotal, monitorTotal, workerTotal] = await Promise.all([
          User.countDocuments({ role: "admin", deletedAt: null }),
          User.countDocuments({ role: "monitor", deletedAt: null }),
          User.countDocuments({ role: "worker", deletedAt: null })
        ]);

        const totalData = {
          admin: { total: adminTotal, online: onlineCounts.admin || 0 },
          monitor: { total: monitorTotal, online: onlineCounts.monitor || 0 },
          worker: { total: workerTotal, online: onlineCounts.worker || 0 },
          summary: {
            totalUsers: adminTotal + monitorTotal + workerTotal,
            totalOnline:
              (onlineCounts.admin || 0) +
              (onlineCounts.monitor || 0) +
              (onlineCounts.worker || 0)
          },
          action: "created",
          timestamp: new Date().toISOString()
        };

        io.to("global").emit("users:total:updated", totalData);
        console.log(
          "📡 Broadcasted users:total:updated (user created):",
          totalData
        );
      } catch (wsError) {
        console.error("Failed to broadcast users:total:updated:", wsError);
      }

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

      let errorMessage = "Internal server error";
      let errorCode = "INTERNAL_SERVER_ERROR";

      if (error instanceof Error) {
        if (
          error.message.includes("duplicate") ||
          error.message.includes("unique") ||
          error.message.includes("already exists")
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
      res.status(errorCode === "DUPLICATE_ERROR" ? 409 : 500).json(response);
    }
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const loggedInUser = req.user;
      const { id } = req.params;

      const user = await userService.update(
        id,
        req.body,
        loggedInUser?._id ? String(loggedInUser._id) : undefined
      );

      if (!user) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "User not found"
        };
        res.status(404).json(response);
        return;
      }

      if (user.role === "worker") {
        const devices = await Device.find({ currentUser: user._id });

        if (!user.isActive && devices.length > 0) {
          await userService.clearDeviceAssignments(String(user._id));
        }

        for (const device of devices) {
          await realtimeService.broadcastDeviceUpdate(device as any);
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
  }

  async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const validation = await userService.canDeleteUser(id);

      if (!validation.canDelete) {
        const statusCode = validation.reason?.includes("last admin")
          ? 403
          : 409;
        const errorCode = validation.reason?.includes("last admin")
          ? "FORBIDDEN"
          : "CONFLICT";

        const response: APIResponse = {
          success: false,
          error: errorCode,
          message: validation.reason || "Cannot delete user"
        };
        res.status(statusCode).json(response);
        return;
      }

      const user = await userService.softDelete(id);

      if (!user) {
        const response: APIResponse = {
          success: false,
          error: "NOT_FOUND",
          message: "User not found"
        };
        res.status(404).json(response);
        return;
      }

      const remainingAdmins = await userService.getRemainingAdminCount();

      try {
        const io = getIO();
        const onlineCounts = await getOnlineCountByRole();

        const [adminTotal, monitorTotal, workerTotal] = await Promise.all([
          User.countDocuments({ role: "admin", deletedAt: null }),
          User.countDocuments({ role: "monitor", deletedAt: null }),
          User.countDocuments({ role: "worker", deletedAt: null })
        ]);

        const totalData = {
          admin: { total: adminTotal, online: onlineCounts.admin || 0 },
          monitor: { total: monitorTotal, online: onlineCounts.monitor || 0 },
          worker: { total: workerTotal, online: onlineCounts.worker || 0 },
          summary: {
            totalUsers: adminTotal + monitorTotal + workerTotal,
            totalOnline:
              (onlineCounts.admin || 0) +
              (onlineCounts.monitor || 0) +
              (onlineCounts.worker || 0)
          },
          action: "deleted",
          timestamp: new Date().toISOString()
        };

        io.to("global").emit("users:total:updated", totalData);
        console.log(
          "📡 Broadcasted users:total:updated (user deleted):",
          totalData
        );
      } catch (wsError) {
        console.error("Failed to broadcast users:total:updated:", wsError);
      }

      const response: APIResponse = {
        success: true,
        message: "User deleted successfully",
        data: {
          remainingAdmins
        }
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
  }

  async getStatistics(
    _req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const statistics = await userService.getUserStatistics();

      const response: APIResponse = {
        success: true,
        message: "User statistics retrieved successfully",
        data: statistics
      };

      res.json(response);
    } catch (error) {
      console.error("Get user statistics error:", error);
      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }
}

export const userController = new UserController();
