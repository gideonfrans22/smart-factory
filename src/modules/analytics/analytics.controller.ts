import { Response } from "express";
import { analyticsService } from "./analytics.service";
import { APIResponse, AuthenticatedRequest } from "@shared/types";

export class AnalyticsController {
  async getWorkerPerformance(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { timeRange, department, limit } = req.query;

      const data = await analyticsService.getWorkerPerformance({
        timeRange: timeRange as "daily" | "weekly" | "monthly" | undefined,
        department: department as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined
      });

      const response: APIResponse = {
        success: true,
        message: "Worker statistics retrieved successfully",
        data
      };

      res.json(response);
    } catch (error) {
      console.error("Get worker statistics error:", error);
      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }
}

export const analyticsController = new AnalyticsController();
