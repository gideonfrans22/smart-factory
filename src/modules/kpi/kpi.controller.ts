import { Response } from "express";
import { APIResponse, AuthenticatedRequest } from "@shared/types";
import { kpiService } from "./kpi.service";

export class KpiController {
  async getRealtime(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const data = await kpiService.getRealtimeData();
      const response: APIResponse = {
        success: true,
        message: "Real-time KPI data retrieved successfully",
        data
      };
      res.json(response);
    } catch (error) {
      console.error("Get realtime KPI error:", error);
      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const kpiData = await kpiService.create(req.body);
      const response: APIResponse = {
        success: true,
        message: "KPI data created successfully",
        data: kpiData
      };
      res.status(201).json(response);
    } catch (error) {
      console.error("Create KPI data error:", error);
      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      };
      res.status(500).json(response);
    }
  }
}

export const kpiController = new KpiController();
