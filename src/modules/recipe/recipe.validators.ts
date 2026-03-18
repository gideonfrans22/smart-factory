import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

export const recipeIdParamSchema = z.object({
  id: objectIdSchema
});

export const recipeNumberParamSchema = z.object({
  recipeNumber: z.string().min(1).max(100).trim()
});

export const recipeListQuerySchema = z.object({
  recipeNumber: z.string().trim().optional(),
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

export const recipeByNumberQuerySchema = z.object({
  version: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), {
      message: "version must be a positive integer"
    })
    .optional()
});

const recipeRawMaterialSchema = z.object({
  materialId: objectIdSchema,
  quantityRequired: z.number().min(0, "quantityRequired must be >= 0"),
  specification: z.any().optional()
});

const recipeStepSchema = z.object({
  order: z.number().int().min(1).optional(),
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).optional(),
  estimatedDuration: z.number().min(0, "estimatedDuration must be >= 0"),
  deviceTypeId: objectIdSchema,
  qualityChecks: z.array(z.string()).optional(),
  dependsOn: z.array(objectIdSchema).optional(),
  mediaIds: z.array(objectIdSchema).optional()
});

export const recipeCreateSchema = z.object({
  recipeNumber: z.string().trim().optional(),
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(5000).trim().optional(),
  rawMaterials: z.array(recipeRawMaterialSchema).optional().default([]),
  product: objectIdSchema,
  steps: z.array(recipeStepSchema).min(1, "At least one step is required"),
  dwgNo: z.string().max(100).trim().optional(),
  unit: z.string().max(20).trim().optional(),
  outsourcing: z.string().max(255).trim().optional(),
  remarks: z.string().max(5000).trim().optional(),
  mediaIds: z.array(objectIdSchema).optional().default([])
});

export const recipeUpdateSchema = recipeCreateSchema
  .omit({ product: true })
  .partial();

export const recipeCreateVersionSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  description: z.string().max(5000).trim().optional(),
  steps: z.array(recipeStepSchema).min(1).optional()
});

export type RecipeIdParamInput = z.infer<typeof recipeIdParamSchema>;
export type RecipeNumberParamInput = z.infer<typeof recipeNumberParamSchema>;
export type RecipeListQueryInput = z.infer<typeof recipeListQuerySchema>;
export type RecipeByNumberQueryInput = z.infer<typeof recipeByNumberQuerySchema>;
export type RecipeCreateInput = z.infer<typeof recipeCreateSchema>;
export type RecipeUpdateInput = z.infer<typeof recipeUpdateSchema>;
export type RecipeCreateVersionInput = z.infer<typeof recipeCreateVersionSchema>;

