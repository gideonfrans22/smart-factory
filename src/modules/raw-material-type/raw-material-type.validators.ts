import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

export const rawMaterialTypeListQuerySchema = z.object({
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

export const rawMaterialTypeCreateSchema = z.object({
  code: z.string().min(1).max(100).trim(),
  name: z.string().min(1).max(200).trim()
});

export const rawMaterialTypeUpdateSchema = rawMaterialTypeCreateSchema.partial();

export const rawMaterialTypeIdParamSchema = z.object({
  id: objectIdSchema
});

export type RawMaterialTypeListQueryInput = z.infer<
  typeof rawMaterialTypeListQuerySchema
>;
export type RawMaterialTypeCreateInput = z.infer<
  typeof rawMaterialTypeCreateSchema
>;
export type RawMaterialTypeUpdateInput = z.infer<
  typeof rawMaterialTypeUpdateSchema
>;
export type RawMaterialTypeIdParamInput = z.infer<
  typeof rawMaterialTypeIdParamSchema
>;
