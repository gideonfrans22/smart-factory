import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

const devicePositionSchema = z.object({
  deviceId: objectIdSchema,
  row: z.number().int().min(0, "Row must be >= 0"),
  column: z.number().int().min(0, "Column must be >= 0"),
  rowSpan: z.number().int().min(1, "Row span must be >= 1").default(1),
  colSpan: z.number().int().min(1, "Column span must be >= 1").default(1)
});

export const gridLayoutListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default("20")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100)),
  isMonitorDisplay: z
    .string()
    .optional()
    .transform((val) => val === "true")
});

export const gridLayoutCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  columns: z.number().int().min(1).default(12).optional(),
  rows: z.number().int().min(1).default(10).optional(),
  devices: z.array(devicePositionSchema).optional().default([]),
  isDefault: z.boolean().optional().default(false),
  isMonitorDisplay: z.boolean().optional().default(false)
});

export const gridLayoutUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  columns: z.number().int().min(1).optional(),
  rows: z.number().int().min(1).optional(),
  devices: z.array(devicePositionSchema).optional(),
  isDefault: z.boolean().optional(),
  isMonitorDisplay: z.boolean().optional()
});

export const gridLayoutIdParamSchema = z.object({
  id: objectIdSchema
});

export const deviceIdParamSchema = z.object({
  id: objectIdSchema,
  deviceId: objectIdSchema
});

export const bulkDeviceUpdateSchema = z.object({
  devices: z.array(
    z.object({
      deviceId: objectIdSchema,
      row: z.number().int().min(0),
      column: z.number().int().min(0),
      rowSpan: z.number().int().min(1),
      colSpan: z.number().int().min(1)
    })
  )
});

export const devicePositionUpdateSchema = z.object({
  row: z.number().int().min(0).optional(),
  column: z.number().int().min(0).optional(),
  rowSpan: z.number().int().min(1).optional(),
  colSpan: z.number().int().min(1).optional()
});

export type GridLayoutListQueryInput = z.infer<typeof gridLayoutListQuerySchema>;
export type GridLayoutCreateInput = z.infer<typeof gridLayoutCreateSchema>;
export type GridLayoutUpdateInput = z.infer<typeof gridLayoutUpdateSchema>;
export type GridLayoutIdParamInput = z.infer<typeof gridLayoutIdParamSchema>;
export type DeviceIdParamInput = z.infer<typeof deviceIdParamSchema>;
export type BulkDeviceUpdateInput = z.infer<typeof bulkDeviceUpdateSchema>;
export type DevicePositionUpdateInput = z.infer<typeof devicePositionUpdateSchema>;
