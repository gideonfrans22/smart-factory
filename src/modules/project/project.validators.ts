import { z } from "zod";
import mongoose from "mongoose";

// --- Reusable Schemas ---

// Validate MongoDB ObjectId strings
const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

// --- Status and Priority Enums ---

const projectStatusSchema = z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]);
const projectPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

// --- Batch Create Project Schema ---

const projectProductItemSchema = z.object({
  productId: objectIdSchema,
  targetQuantity: z.number().int().min(1).default(1),
  priority: projectPrioritySchema.default("MEDIUM"),
  status: projectStatusSchema.default("PLANNING"),
  deadline: z.string().datetime().optional()
});

const projectRecipeItemSchema = z.object({
  recipeId: objectIdSchema,
  targetQuantity: z.number().int().min(1).default(1),
  priority: projectPrioritySchema.default("MEDIUM"),
  status: projectStatusSchema.default("PLANNING"),
  deadline: z.string().datetime().optional()
});

export const projectCreateBatchSchema = z.object({
  products: z.array(projectProductItemSchema).default([]),
  recipes: z.array(projectRecipeItemSchema).default([]),
  createdBy: objectIdSchema
});

// --- Update Project Schema ---

export const projectUpdateSchema = z.object({
  productId: objectIdSchema.optional(),
  recipeId: objectIdSchema.optional(),
  targetQuantity: z.number().int().min(1).optional(),
  description: z.string().trim().optional(),
  deadline: z.string().datetime().nullable().optional(),
  status: projectStatusSchema.optional(),
  priority: projectPrioritySchema.optional()
});

// --- Query Params Schema ---

export const projectListQuerySchema = z.object({
  status: projectStatusSchema.optional(),
  priority: projectPrioritySchema.optional(),
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

// --- Route Param Schema ---

export const projectIdParamSchema = z.object({
  id: objectIdSchema
});

// --- Infer TypeScript Types ---

export type ProjectCreateBatchInput = z.infer<typeof projectCreateBatchSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type ProjectListQueryInput = z.infer<typeof projectListQuerySchema>;
export type ProjectIdParamInput = z.infer<typeof projectIdParamSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectPriority = z.infer<typeof projectPrioritySchema>;
