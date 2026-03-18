import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

export const rawMaterialListQuerySchema = z.object({
  supplier: z.string().trim().optional(),
  search: z.string().trim().optional(),
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

export const rawMaterialCreateSchema = z.object({
  materialCode: z.string().min(1).max(50).trim(),
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional(),
  supplier: z.string().max(200).trim().optional(),
  unit: z.string().max(50).trim().optional(),
  currentStock: z
    .number()
    .int("currentStock must be an integer")
    .min(0, "currentStock must be a non-negative number")
    .optional()
});

export const rawMaterialUpdateSchema = rawMaterialCreateSchema.partial();

export const rawMaterialIdParamSchema = z.object({
  id: objectIdSchema
});

export type RawMaterialListQueryInput = z.infer<
  typeof rawMaterialListQuerySchema
>;
export type RawMaterialCreateInput = z.infer<typeof rawMaterialCreateSchema>;
export type RawMaterialUpdateInput = z.infer<typeof rawMaterialUpdateSchema>;
export type RawMaterialIdParamInput = z.infer<typeof rawMaterialIdParamSchema>;

