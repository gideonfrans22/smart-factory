import { Request } from "express";
import { IUser } from "@modules/user";

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username?: string;
  name: string;
  email?: string;
  password?: string;
  role: "admin" | "worker" | "monitor";
}

export interface JWTPayload {
  sub: string; // User ID (was userId)
  role: "admin" | "worker" | "monitor";
  username?: string; // Employee number for workers only
  iat?: number; // Issued at timestamp
  exp?: number; // Expiration timestamp
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

export type ImportErrorSeverity = "error" | "warning";

export interface ImportRowError {
  sheet: string;
  row: number;
  column?: string;
  message: string;
  severity: ImportErrorSeverity;
}

export interface ImportResult {
  success: boolean;
  summary: {
    created: number;
    updated: number;
    skipped: number;
    errors: ImportRowError[];
  };
}

export interface VerifyResult {
  valid: boolean;
  summary: {
    productsFound?: number;
    recipesFound?: number;
    stepsFound?: number;
    rawMaterialsFound?: number;
    specificationsFound?: number;
    errors: ImportRowError[];
  };
}
