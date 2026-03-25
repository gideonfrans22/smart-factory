import mongoose, { FilterQuery } from "mongoose";
import { User, IUser } from "./user.model";
import {
  UserDocument,
  UserCreateData,
  UserUpdateData,
  UserFilters,
  UserListResult,
  UserStatisticsData,
  DeleteValidationResult
} from "./user.types";
import { hashPassword, sanitizeInput, validateEmail } from "@shared/helpers";
import { getOnlineCountByRole } from "@shared/services/userOnlineService";
import { Device, Task } from "@/models";

export class UserService {
  async list(filters: UserFilters = {}): Promise<UserListResult> {
    const { page = 1, limit = 10, ...queryFilters } = filters;

    const query = this.buildListQuery(queryFilters);

    const skip = (page - 1) * limit;
    const total = await User.countDocuments(query);

    const items = await User.find(query)
      .populate("modifiedBy", "name email username")
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async listWorkers(filters: UserFilters = {}): Promise<UserListResult> {
    const { page = 1, limit = 10, ...queryFilters } = filters;

    const query = this.buildListQuery({ ...queryFilters, role: "worker" });

    const skip = (page - 1) * limit;
    const total = await User.countDocuments(query);

    const items = await User.find(query)
      .populate("modifiedBy", "name email username")
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };
  }

  async getById(id: string): Promise<UserDocument | null> {
    return User.findById(id)
      .populate("modifiedBy", "name email username")
      .select("-password")
      .exec();
  }

  async create(
    data: UserCreateData,
    modifiedBy?: string
  ): Promise<UserDocument> {
    const { username, name, email, password, role, department, isActive } =
      data;

    const orConditions = [];
    if (username) orConditions.push({ username });
    if (email) orConditions.push({ email });

    if (orConditions.length > 0) {
      const existingUser = await User.findOne({ $or: orConditions });
      if (existingUser) {
        throw new Error("Username or email already exists");
      }
    }

    let hashedPassword = "";
    if (password) {
      hashedPassword = await hashPassword(password);
    }

    const user = new User({
      username: username ? sanitizeInput(username) : undefined,
      name: sanitizeInput(name),
      email: email ? email.toLowerCase() : undefined,
      password: hashedPassword,
      role,
      department: department ? sanitizeInput(department) : undefined,
      isActive: isActive !== undefined ? isActive : true,
      modifiedBy: modifiedBy
        ? new mongoose.Types.ObjectId(modifiedBy)
        : undefined
    });

    return user.save();
  }

  async update(
    id: string,
    data: UserUpdateData,
    modifiedBy?: string
  ): Promise<UserDocument | null> {
    const user = await User.findById(id);

    if (!user) {
      return null;
    }

    if (data.name) user.name = sanitizeInput(data.name);
    if (data.email !== undefined) {
      if (data.email && !validateEmail(data.email)) {
        throw new Error("Invalid email format");
      }
      user.email = data.email ? data.email.toLowerCase() : undefined;
    }
    if (data.isActive !== undefined) user.isActive = data.isActive;
    if (data.role) user.role = data.role;
    if (data.lastLoginAt !== undefined) {
      user.lastLoginAt = data.lastLoginAt
        ? new Date(data.lastLoginAt)
        : undefined;
    }
    if (data.department !== undefined) {
      user.department = data.department
        ? sanitizeInput(data.department)
        : undefined;
    }
    if (data.password) {
      user.password = await hashPassword(data.password);
    }

    if (modifiedBy) {
      user.modifiedBy = new mongoose.Types.ObjectId(modifiedBy);
    }

    return user.save();
  }

  async softDelete(id: string): Promise<UserDocument | null> {
    const user = await User.findById(id);

    if (!user) {
      return null;
    }

    user.isActive = false;
    (user as any).deletedAt = new Date();

    return user.save();
  }

  async canDeleteUser(userId: string): Promise<DeleteValidationResult> {
    const user = await User.findById(userId);

    if (!user) {
      return { canDelete: false, reason: "User not found" };
    }

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({
        role: "admin",
        deletedAt: null
      });

      if (adminCount <= 1) {
        return {
          canDelete: false,
          reason:
            "Cannot delete last admin. At least one admin must remain in the system."
        };
      }
    }

    const activeTasksCount = await this.getActiveTasksCount(userId);
    if (activeTasksCount > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete user: ${activeTasksCount} active task(s) are currently assigned to this user`
      };
    }

    const activeDevicesCount = await this.getActiveDevicesCount(userId);
    if (activeDevicesCount > 0) {
      return {
        canDelete: false,
        reason: `Cannot delete user: Currently operating ${activeDevicesCount} device(s)`
      };
    }

    return { canDelete: true };
  }

  async getRemainingAdminCount(): Promise<number> {
    return User.countDocuments({
      role: "admin",
      deletedAt: null
    });
  }

  async getActiveTasksCount(userId: string): Promise<number> {
    return Task.countDocuments({
      workerId: userId,
      status: { $in: ["ONGOING", "PAUSED", "PAUSED_EMERGENCY"] }
    });
  }

  async getActiveDevicesCount(userId: string): Promise<number> {
    return Device.countDocuments({ currentUser: userId });
  }

  async getUserStatistics(): Promise<UserStatisticsData> {
    const [adminTotal, monitorTotal, workerTotal] = await Promise.all([
      User.countDocuments({ role: "admin", deletedAt: null }),
      User.countDocuments({ role: "monitor", deletedAt: null }),
      User.countDocuments({ role: "worker", deletedAt: null })
    ]);

    const onlineCounts = await getOnlineCountByRole();

    return {
      admin: {
        total: adminTotal,
        online: onlineCounts.admin
      },
      monitor: {
        total: monitorTotal,
        online: onlineCounts.monitor
      },
      worker: {
        total: workerTotal,
        online: onlineCounts.worker
      },
      summary: {
        totalUsers: adminTotal + monitorTotal + workerTotal,
        totalOnline:
          onlineCounts.admin + onlineCounts.monitor + onlineCounts.worker
      }
    };
  }

  async clearDeviceAssignments(userId: string): Promise<void> {
    await Device.updateMany(
      { currentUser: userId },
      { $set: { currentUser: null } }
    );
  }

  private buildListQuery(
    filters: Omit<UserFilters, "page" | "limit">
  ): FilterQuery<IUser> {
    const query: FilterQuery<IUser> = {};

    if (filters.role) {
      query.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.department) {
      query.department = filters.department;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { username: { $regex: filters.search, $options: "i" } },
        { email: { $regex: filters.search, $options: "i" } }
      ];
    }

    return query;
  }
}

export const userService = new UserService();
