import { z } from "zod";

/** Mirrors legacy: Math.min(parseInt(limit) || 100, 200) */
export const monitorTasksQuerySchema = z
  .object({
    limit: z.string().optional()
  })
  .transform((q) => ({
    limit: Math.min(parseInt(q.limit ?? "", 10) || 100, 200)
  }));
