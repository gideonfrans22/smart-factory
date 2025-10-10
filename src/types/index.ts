import { Request } from "express";
import { IUser } from "../models/User";

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  empNo?: string;
  name: string;
  email?: string;
  password: string;
  role: "admin" | "worker";
}

export interface JWTPayload {
  sub: string; // User ID (was userId)
  role: "admin" | "worker";
  empNo?: string; // Employee number for workers only
  iat?: number; // Issued at timestamp
  exp?: number; // Expiration timestamp
  type?: "refresh"; // For refresh tokens
}

export interface ProcessLineStatus {
  lineNumber: number;
  status: "operational" | "maintenance" | "offline";
  currentCapacity: number;
  maxCapacity: number;
  partsInQueue: number;
  averageProcessingTime: number;
}

export interface PartProgress {
  partId: string;
  currentProcessLine?: number;
  completedProcessLines: number[];
  remainingProcessLines: number[];
  status: "pending" | "in_progress" | "completed" | "on_hold";
  progressPercentage: number;
}

export interface WorkerAction {
  workerId: string;
  processLineNumber: number;
  partId: string;
  action: "start" | "complete" | "pause" | "resume" | "fail";
  timestamp: Date;
  notes?: string;
}

export interface ProductionMetrics {
  totalPartsProduced: number;
  totalPartsInProgress: number;
  averageCompletionTime: number;
  processLineEfficiency: { [lineNumber: number]: number };
  workerPerformance: { [workerId: string]: number };
  dailyProduction: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface FilterParams {
  status?: string;
  processLine?: number;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
}
