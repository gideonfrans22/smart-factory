import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

export const kpiCreateSchema = z.object({
  metricName: z.string().min(1).max(100).trim(),
  metricValue: z.number(),
  unit: z.string().max(20).trim().optional(),
  deviceId: z.string().trim().optional(),
  projectId: objectIdSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({})
});

export type KpiCreateInput = z.infer<typeof kpiCreateSchema>;
