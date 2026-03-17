import { z } from "zod";
import { UserRole } from "../../../api_spec/types/common";

// Shared primitives
const userRoleSchema = z.custom<UserRole>((val) =>
  val === "admin" || val === "worker" || val === "monitor"
);

// Register
export const registerSchema = z
  .object({
    username: z.string().min(1).max(20).optional(),
    name: z.string().min(1).max(100),
    email: z
      .string()
      .min(1)
      .max(255)
      .email()
      .optional(),
    password: z.string().min(6),
    role: userRoleSchema
  })
  .superRefine((data, ctx) => {
    if (data.role === "worker" && !data.username) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["username"],
        message: "Employee number is required for workers"
      });
    }
    if (data.role === "admin" && !data.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Email is required for admin users"
      });
    }
  });

// Login
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

// Worker login
export const workerLoginSchema = z.object({
  workerId: z.string().min(1),
  deviceId: z.string().min(1)
});

// Monitor login
export const monitorLoginSchema = z.object({
  username: z.literal("monitor"),
  password: z.string().min(1)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type WorkerLoginInput = z.infer<typeof workerLoginSchema>;
export type MonitorLoginInput = z.infer<typeof monitorLoginSchema>;


