import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

export const customerListQuerySchema = z.object({
  search: z.string().trim().optional(),
  department: z.string().trim().optional(),
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

export const customerCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Customer name is required")
    .max(200, "Customer name cannot exceed 200 characters")
    .trim(),
  personInCharge: z
    .string()
    .min(1, "Person in charge is required")
    .max(200, "Person in charge cannot exceed 200 characters")
    .trim(),
  department: z
    .string()
    .max(100, "Department cannot exceed 100 characters")
    .trim()
    .optional(),
  notes: z
    .string()
    .max(1000, "Notes cannot exceed 1000 characters")
    .trim()
    .optional()
});

export const customerUpdateSchema = customerCreateSchema.partial();

export const customerIdParamSchema = z.object({
  id: objectIdSchema
});

export type CustomerListQueryInput = z.infer<typeof customerListQuerySchema>;
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type CustomerIdParamInput = z.infer<typeof customerIdParamSchema>;

