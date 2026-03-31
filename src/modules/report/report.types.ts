import type { z } from "zod";
import type { IReport } from "./report.model";
import type {
  reportGenerateBodySchema,
  reportListQuerySchema,
  reportIdParamSchema
} from "./report.validators";

export type { IReport };

export type ReportType = IReport["type"];
export type ReportFormat = IReport["format"];
export type ReportStatus = IReport["status"];

export type ReportGenerateBody = z.infer<typeof reportGenerateBodySchema>;
export type ReportListQuery = z.infer<typeof reportListQuerySchema>;
export type ReportIdParams = z.infer<typeof reportIdParamSchema>;

export interface ReportGenerationOptions {
  startDate: Date;
  endDate: Date;
  userId: string;
  reportType: "TASK_COMPLETION" | "WORKER_PERFORMANCE" | "PRODUCTION_RATE";
  filters?: {
    projectId?: string;
    workerId?: string;
    deviceTypeId?: string;
  };
}

export interface ReportGenerationResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
  reportId?: string;
  metadata?: {
    sheetsGenerated: string[];
    recordCount: number;
    generationTime: number; // in milliseconds
    period?: "daily" | "weekly" | "monthly" | "all-time";
  };
}
