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
