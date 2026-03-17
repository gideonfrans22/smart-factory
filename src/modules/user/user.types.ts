import { IUser } from "./user.model";

export type UserDocument = IUser;

export interface UserCreateData {
  username?: string;
  name: string;
  email?: string;
  password?: string;
  role: "admin" | "worker" | "monitor";
  department?: string;
  isActive?: boolean;
}

export interface UserUpdateData {
  username?: string;
  name?: string;
  email?: string;
  password?: string;
  role?: "admin" | "worker" | "monitor";
  department?: string | null;
  isActive?: boolean;
  lastLoginAt?: Date | null;
}

export interface UserFilters {
  role?: "admin" | "worker" | "monitor";
  isActive?: boolean;
  search?: string;
  department?: string;
  page?: number;
  limit?: number;
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface UserListResult {
  items: UserDocument[];
  pagination: PaginationData;
}

export interface UserStatisticsData {
  admin: {
    total: number;
    online: number;
  };
  monitor: {
    total: number;
    online: number;
  };
  worker: {
    total: number;
    online: number;
  };
  summary: {
    totalUsers: number;
    totalOnline: number;
  };
}

export interface DeleteValidationResult {
  canDelete: boolean;
  reason?: string;
}

export interface OnlineUser {
  userId: string;
  role: string;
  name: string;
  socketId: string;
  connectedAt: string;
}
  