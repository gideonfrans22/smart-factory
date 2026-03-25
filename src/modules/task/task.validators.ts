import { z } from "zod";
import mongoose from "mongoose";
import {
  TaskCreateDTO,
  TaskUpdateDTO,
  TaskBatchUpdateDTO,
  TaskListQuery,
  TaskStatisticsQuery,
  TaskGroupedQuery,
  TaskStandaloneQuery,
  DeviceTaskQuery,
  WorkerTaskQuery
} from "./task.types";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

export const taskCreateSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  description: z.string().optional(),
  projectId: objectIdSchema.optional(),
  recipeId: objectIdSchema.optional(),
  productId: objectIdSchema.optional(),
  deviceId: objectIdSchema.optional(),
  workerId: objectIdSchema.optional(),
  status: z
    .enum(["PENDING", "ONGOING", "PAUSED", "PAUSED_EMERGENCY", "COMPLETED", "FAILED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  estimatedDuration: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  qualityData: z.any().optional()
}) satisfies z.ZodType<TaskCreateDTO>;

export const taskUpdateSchema = z
  .object({
    status: z
      .enum(["PENDING", "ONGOING", "PAUSED", "PAUSED_EMERGENCY", "COMPLETED", "FAILED"])
      .optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    notes: z.string().optional(),
    mediaFiles: z.array(z.string()).optional(),
    deviceId: objectIdSchema.optional(),
    workerId: objectIdSchema.optional(),
    pausedDuration: z.number().int().min(0).optional(),
    startedAt: z.string().datetime().nullable().optional(),
    completedAt: z.string().datetime().nullable().optional(),
    progress: z.number().min(0).max(100).optional()
  })
  .partial() satisfies z.ZodType<TaskUpdateDTO>;

export const taskBatchUpdateSchema = z.object({
  taskIds: z.array(objectIdSchema).min(1),
  updates: taskUpdateSchema
}) satisfies z.ZodType<TaskBatchUpdateDTO>;

export const taskIdParamSchema = z.object({
  id: objectIdSchema
});

export const deviceTaskParamsSchema = z.object({
  deviceId: objectIdSchema
});

export const workerTaskParamsSchema = z.object({
  workerId: objectIdSchema
});

export const taskListQuerySchema = z
  .object({
    status: z
      .enum(["PENDING", "ONGOING", "PAUSED", "PAUSED_EMERGENCY", "COMPLETED", "FAILED"])
      .optional(),
    deviceId: objectIdSchema.optional(),
    deviceTypeId: objectIdSchema.optional(),
    projectId: objectIdSchema.optional(),
    recipeId: objectIdSchema.optional(),
    productId: objectIdSchema.optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    workerId: objectIdSchema.optional(),
    search: z.string().optional(),
    includePendingAndPartial: z.string().optional()
  })
  .partial() satisfies z.ZodType<TaskListQuery>;

export const taskStatisticsQuerySchema = z
  .object({
    projectId: objectIdSchema.optional(),
    deviceTypeId: objectIdSchema.optional(),
    workerId: objectIdSchema.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  })
  .partial() satisfies z.ZodType<TaskStatisticsQuery>;

export const taskGroupedQuerySchema = z
  .object({
    projectStatus: z.string().optional(),
    taskStatus: z
      .enum(["PENDING", "ONGOING", "PAUSED", "PAUSED_EMERGENCY", "COMPLETED", "FAILED"])
      .optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    search: z.string().optional()
  })
  .partial() satisfies z.ZodType<TaskGroupedQuery>;

export const taskStandaloneQuerySchema = z
  .object({
    status: z
      .enum(["PENDING", "ONGOING", "PAUSED", "PAUSED_EMERGENCY", "COMPLETED", "FAILED"])
      .optional(),
    deviceId: objectIdSchema.optional(),
    deviceTypeId: objectIdSchema.optional(),
    recipeId: objectIdSchema.optional(),
    workerId: objectIdSchema.optional(),
    search: z.string().optional()
  })
  .partial() satisfies z.ZodType<TaskStandaloneQuery>;

export const deviceTaskQuerySchema = z
  .object({
    status: z
      .enum(["PENDING", "ONGOING", "PAUSED", "PAUSED_EMERGENCY", "COMPLETED", "FAILED"])
      .optional(),
    workerId: objectIdSchema.optional(),
    start: z.string().optional(),
    end: z.string().optional()
  })
  .partial() satisfies z.ZodType<DeviceTaskQuery>;

export const workerTaskQuerySchema = z
  .object({
    status: z
      .enum(["PENDING", "ONGOING", "PAUSED", "PAUSED_EMERGENCY", "COMPLETED", "FAILED"])
      .optional(),
    start: z.string().optional(),
    end: z.string().optional()
  })
  .partial() satisfies z.ZodType<WorkerTaskQuery>;

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskBatchUpdateInput = z.infer<typeof taskBatchUpdateSchema>;
export type TaskListQueryInput = z.infer<typeof taskListQuerySchema>;
export type TaskStatisticsQueryInput = z.infer<typeof taskStatisticsQuerySchema>;
export type TaskGroupedQueryInput = z.infer<typeof taskGroupedQuerySchema>;
export type TaskStandaloneQueryInput = z.infer<typeof taskStandaloneQuerySchema>;
export type DeviceTaskQueryInput = z.infer<typeof deviceTaskQuerySchema>;
export type WorkerTaskQueryInput = z.infer<typeof workerTaskQuerySchema>;

