import { z } from "zod";
import mongoose from "mongoose";

const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  { message: "Invalid ObjectId format" }
);

const reportTypeSchema = z.enum([
  "TASK_COMPLETION",
  "WORKER_PERFORMANCE",
  "PRODUCTION_RATE",
  "WORKER_PERFORMANCE_KPI",
  "EQUIPMENT_PERFORMANCE",
  "SUMMARY_REPORT"
]);

const reportFormatSchema = z.enum(["PDF", "EXCEL", "CSV", "JSON"]);

const reportStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED"
]);

export const reportGenerateBodySchema = z.object({
  title: z.string().min(1).max(255).trim(),
  type: reportTypeSchema,
  format: reportFormatSchema,
  parameters: z
    .object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
      period: z.enum(["daily", "weekly", "monthly"]).optional()
    })
    .passthrough(),
  lang: z.enum(["en", "ko"]).optional()
});

export const reportListQuerySchema = z.object({
  type: reportTypeSchema.optional(),
  status: reportStatusSchema.optional(),
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
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

export const reportIdParamSchema = z.object({
  id: objectIdSchema
});

export const reportDownloadParamSchema = z.object({
  id: objectIdSchema
});
