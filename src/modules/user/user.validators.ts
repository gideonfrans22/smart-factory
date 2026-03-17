import { z } from "zod";
import mongoose from "mongoose";
import { emptyStringToUndefined } from "@shared/helpers";

const userRoleSchema = z.enum(["admin", "worker", "monitor"]);

export const userCreateSchema = z
  .object({
    username: z
      .string()
      .max(20, "Username must not exceed 20 characters")
      .trim()
      .optional(),
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must not exceed 100 characters")
      .trim(),
    email: emptyStringToUndefined(
      z
        .email("Invalid email format")
        .min(1)
        .max(255, "Email must not exceed 255 characters")
        .toLowerCase()
        .nullable()
    ),
    password: emptyStringToUndefined(
      z.string().min(6, "Password must be at least 6 characters")
    ),
    role: userRoleSchema,
    department: z
      .string()
      .max(100, "Department must not exceed 100 characters")
      .trim()
      .optional(),
    isActive: z.boolean().optional().default(true)
  })
  .superRefine((data, ctx) => {
    if (data.role === "admin" && !data.email) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Email is required for admin users"
      });
    }
    if (data.role === "monitor" && !data.username && !data.email) {
      ctx.addIssue({
        code: "custom",
        path: ["username"],
        message: "Username or email is required for monitor users"
      });
    }
  });

export const userUpdateSchema = z
  .object({
    username: emptyStringToUndefined(
      z
        .string()
        .min(1, "Username must be at least 1 character")
        .max(20, "Username must not exceed 20 characters")
        .trim()
    ),
    name: emptyStringToUndefined(
      z
        .string()
        .min(1, "Name is required")
        .max(100, "Name must not exceed 100 characters")
        .trim()
    ),
    email: emptyStringToUndefined(
      z
        .email("Invalid email format")
        .min(1)
        .max(255, "Email must not exceed 255 characters")
        .toLowerCase()
        .nullable()
    ),
    department: emptyStringToUndefined(
      z
        .string()
        .max(100, "Department must not exceed 100 characters")
        .trim()
        .nullable()
    ),
    password: emptyStringToUndefined(
      z.string().min(6, "Password must be at least 6 characters")
    ),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    lastLoginAt: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .union([z.string().datetime("Invalid date format"), z.date()])
        .nullable()
        .optional()
    )
  })
  .partial();

export const userListQuerySchema = z.object({
  role: userRoleSchema.optional(),
  isActive: z
    .string()
    .transform((val) => val === "true")
    .optional(),
  search: z.string().optional(),
  department: z.string().optional(),
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

export const userIdParamSchema = z.object({
  id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid user ID format"
  })
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserListQueryInput = z.infer<typeof userListQuerySchema>;
export type UserIdParamInput = z.infer<typeof userIdParamSchema>;
