import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

export const deviceTypeIdParamSchema = z.object({
  id: objectIdSchema
});

export const deviceTypeCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  specifications: z
    .record(z.string(), z.any())
    .optional(),
  validRecipeStepNames: z
    .array(z.string().min(1).max(200).trim())
    .optional()
});

export const deviceTypeUpdateSchema = deviceTypeCreateSchema.partial();

export type DeviceTypeIdParamInput = z.infer<typeof deviceTypeIdParamSchema>;
export type DeviceTypeCreateInput = z.infer<typeof deviceTypeCreateSchema>;
export type DeviceTypeUpdateInput = z.infer<typeof deviceTypeUpdateSchema>;

