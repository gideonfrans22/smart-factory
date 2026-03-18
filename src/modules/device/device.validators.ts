import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

export const deviceListQuerySchema = z.object({
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE", "ERROR"]).optional(),
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100))
});

export const deviceCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  deviceTypeId: objectIdSchema,
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE", "ERROR"]).optional(),
  ipAddress: z.string().trim().optional(),
  macAddress: z.string().trim().toUpperCase().optional(),
  config: z.record(z.string(), z.any()).optional()
});

export const deviceUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  deviceTypeId: objectIdSchema.optional(),
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE", "ERROR"]).optional(),
  currentUser: z.union([objectIdSchema, z.null()]).optional(),
  ipAddress: z.string().trim().optional(),
  config: z.record(z.string(), z.any()).optional(),
  errorReason: z.string().trim().optional(),
  statusChangeReason: z.string().trim().optional()
});

export const deviceIdParamSchema = z.object({
  id: objectIdSchema
});

export const deviceStatisticsQuerySchema = z.object({
  timeRange: z.enum(["daily", "weekly", "monthly"]).optional().default("daily"),
  status: z.enum(["ONLINE", "OFFLINE", "MAINTENANCE", "ERROR"]).optional(),
  limit: z
    .string()
    .optional()
    .default("100")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(1000))
});

export const devicesByTaskQuerySchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
  limit: z
    .string()
    .optional()
    .default("50")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(200)),
  sortBy: z.enum(["workload", "status", "name"]).optional().default("workload")
});

export type DeviceListQueryInput = z.infer<typeof deviceListQuerySchema>;
export type DeviceCreateInput = z.infer<typeof deviceCreateSchema>;
export type DeviceUpdateInput = z.infer<typeof deviceUpdateSchema>;
export type DeviceIdParamInput = z.infer<typeof deviceIdParamSchema>;
export type DeviceStatisticsQueryInput = z.infer<typeof deviceStatisticsQuerySchema>;
export type DevicesByTaskQueryInput = z.infer<typeof devicesByTaskQuerySchema>;
