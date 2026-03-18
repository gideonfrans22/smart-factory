import { z } from "zod";
import mongoose from "mongoose";

// --- Reusable Schemas ---

// Validate MongoDB ObjectId strings
const objectIdSchema = z
  .string()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format"
  });

// Design number regex: 00000-00-000-00 (5 chars - 2 digits - 3 digits - 2 digits)
const DESIGN_NUMBER_REGEX = /^[A-Z0-9]{5}-[0-9]{2}-[0-9]{3}-[0-9]{2}$/;

// --- Create/Update Schema ---

const productRecipeSchema = z.object({
  recipeId: objectIdSchema,
  quantity: z.number().min(0).default(1)
});

export const productCreateSchema = z.object({
  designNumber: z
    .string()
    .regex(
      DESIGN_NUMBER_REGEX,
      "설계번호 형식이 올바르지 않습니다. 00000-00-000-00 형식으로 입력해주세요"
    )
    .trim(),
  productName: z.string().min(1, "Product name is required").max(200).trim(),
  customerName: z.string().max(200).optional(),
  personInCharge: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  quantityUnit: z.string().max(50).optional(),
  recipes: z.array(productRecipeSchema).optional()
});

export const productUpdateSchema = z.object({
  designNumber: z
    .string()
    .regex(
      DESIGN_NUMBER_REGEX,
      "설계번호 형식이 올바르지 않습니다. 00000-00-000-00 형식으로 입력해주세요"
    )
    .optional(),
  productName: z.string().min(1).max(200).optional(),
  customerName: z.string().max(200).optional(),
  personInCharge: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  quantityUnit: z.string().max(50).optional(),
  recipes: z.array(productRecipeSchema).optional()
});

// --- Duplicate Schema ---

export const productDuplicateSchema = z.object({
  newDesignNumber: z
    .string()
    .regex(
      DESIGN_NUMBER_REGEX,
      "설계번호 형식이 올바르지 않습니다. 00000-00-000-00 형식으로 입력해주세요"
    ),
  newProductName: z.string().max(200).optional()
});

// --- Query Params Schema ---

export const productListQuerySchema = z.object({
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
    .pipe(z.number().int().positive().max(100)),
  search: z.string().optional(),
  customerName: z.string().optional(),
  personInCharge: z.string().optional(),
  department: z.string().optional()
});

// --- Route Param Schema ---

export const productIdParamSchema = z.object({
  id: objectIdSchema
});

export const productRestoreParamSchema = z.object({
  id: objectIdSchema,
  versionId: objectIdSchema
});

// --- Infer TypeScript Types ---

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductDuplicateInput = z.infer<typeof productDuplicateSchema>;
export type ProductListQueryInput = z.infer<typeof productListQuerySchema>;
export type ProductIdParamInput = z.infer<typeof productIdParamSchema>;
export type ProductRestoreParamInput = z.infer<
  typeof productRestoreParamSchema
>;
