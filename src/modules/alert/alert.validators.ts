import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

export const alertListQuerySchema = z.object({
  type: z
    .enum(["EQUIPMENT_DEFECT", "TOOL_CHANGE", "MATERIAL_DEFECT", "PROCESSING_DEFECT", "OTHER"])
    .optional(),
  level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["UNREAD", "READ", "ACKNOWLEDGED", "RESOLVED", "PENDING"]).optional(),
  source: z.string().trim().optional(),
  reportedBy: objectIdSchema.optional(),
  deviceId: objectIdSchema.optional(),
  taskId: objectIdSchema.optional(),
  projectId: objectIdSchema.optional(),
  relatedEntityType: z.string().trim().optional(),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
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

export const alertCreateSchema = z.object({
  type: z.enum(["EQUIPMENT_DEFECT", "TOOL_CHANGE", "MATERIAL_DEFECT", "PROCESSING_DEFECT", "OTHER"]),
  level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  title: z.string().min(1).max(255).trim(),
  message: z.string().min(1).trim(),
  source: z.string().max(100).trim().optional(),
  relatedEntityType: z.string().max(50).trim().optional(),
  relatedEntityId: z.string().max(255).trim().optional(),
  deviceId: objectIdSchema.optional(),
  taskId: objectIdSchema.optional(),
  projectId: objectIdSchema.optional(),
  reportedBy: objectIdSchema.optional(),
  status: z
    .enum(["UNREAD", "READ", "ACKNOWLEDGED", "RESOLVED", "PENDING"])
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const alertUpdateSchema = alertCreateSchema.partial();

export const alertIdParamSchema = z.object({
  id: objectIdSchema
});

export const alertBulkIdsSchema = z.object({
  alertIds: z.array(objectIdSchema).min(1)
});

export const alertResolveEmergencyBodySchema = z.object({
  resolvedBy: z.string().max(255).trim().optional(),
  resolutionNotes: z.string().max(2000).trim().optional()
});

export type AlertListQueryInput = z.infer<typeof alertListQuerySchema>;
export type AlertCreateInput = z.infer<typeof alertCreateSchema>;
export type AlertUpdateInput = z.infer<typeof alertUpdateSchema>;
export type AlertIdParamInput = z.infer<typeof alertIdParamSchema>;
export type AlertBulkIdsInput = z.infer<typeof alertBulkIdsSchema>;
export type AlertResolveEmergencyBodyInput = z.infer<
  typeof alertResolveEmergencyBodySchema
>;

