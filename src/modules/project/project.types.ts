import mongoose from "mongoose";

/**
 * Project Status Enum
 * - PLANNING: Project is being planned, ready for modifications
 * - ACTIVE: Project is actively running with tasks
 * - ON_HOLD: Project is paused
 * - COMPLETED: All tasks completed
 * - CANCELLED: Project was cancelled
 */
export enum ProjectStatus {
  PLANNING = "PLANNING",
  ACTIVE = "ACTIVE",
  ON_HOLD = "ON_HOLD",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

/**
 * Project Priority Enum
 * Used to indicate importance and urgency
 */
export enum ProjectPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT"
}

/**
 * Task status summary for monitoring
 */
export interface TaskStatusSummary {
  total: number;
  byStatus: {
    PENDING: number;
    ONGOING: number;
    COMPLETED: number;
    PAUSED: number;
    FAILED: number;
  };
}

/**
 * Project task information for monitoring
 */
export interface ProjectTaskInfo {
  recipeInfo: any;
  tasks: any[];
}

/**
 * Project monitoring data structure
 */
export interface ProjectMonitoringData {
  projectInfo: any;
  recipeTasks: ProjectTaskInfo[];
  taskSummary: TaskStatusSummary;
}

/**
 * Data Transfer Object for creating projects
 */
export interface CreateProjectDTO {
  name: string;
  description?: string;
  targetQuantity: number;
  product?: mongoose.Types.ObjectId;
  recipe?: mongoose.Types.ObjectId;
  status: ProjectStatus;
  priority: ProjectPriority;
  deadline?: Date;
  createdBy: mongoose.Types.ObjectId;
}

/**
 * Data Transfer Object for updating projects
 */
export interface UpdateProjectDTO {
  name?: string;
  description?: string;
  targetQuantity?: number;
  product?: mongoose.Types.ObjectId;
  recipe?: mongoose.Types.ObjectId;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  deadline?: Date;
  modifiedBy?: mongoose.Types.ObjectId;
}

/**
 * Project filter options for queries
 */
export interface ProjectFilters {
  status?: ProjectStatus;
  priority?: ProjectPriority;
  createdBy?: mongoose.Types.ObjectId;
}
