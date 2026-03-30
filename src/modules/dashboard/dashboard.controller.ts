import { Request, Response } from "express";
import { APIResponse } from "@shared/types";
import { dashboardService } from "./dashboard.service";
import { monitorTasksQuerySchema } from "./dashboard.validators";

export class DashboardController {
  async getMonitorOverview(_req: Request, res: Response): Promise<void> {
    try {
      const data = await dashboardService.getMonitorOverview();
      const response: APIResponse = {
        success: true,
        message: "Monitor overview data retrieved successfully",
        data
      };
      res.json(response);
    } catch (error) {
      console.error("Get monitor overview error:", error);
      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve monitor overview data"
      };
      res.status(500).json(response);
    }
  }

  async getTaskStatusDistribution(_req: Request, res: Response): Promise<void> {
    try {
      const data = await dashboardService.getTaskStatusDistribution();
      const response: APIResponse = {
        success: true,
        message: "Task status distribution retrieved successfully",
        data
      };
      res.json(response);
    } catch (error) {
      console.error("Get task status distribution error:", error);
      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve task status distribution"
      };
      res.status(500).json(response);
    }
  }

  async getMonitorTasks(req: Request, res: Response): Promise<void> {
    try {
      const parsed = monitorTasksQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: parsed.error.flatten().fieldErrors
        });
        return;
      }
      const data = await dashboardService.getMonitorTasks(parsed.data.limit);
      const response: APIResponse = {
        success: true,
        message: "Monitor tasks retrieved successfully",
        data
      };
      res.json(response);
    } catch (error) {
      console.error("Get monitor tasks error:", error);
      const response: APIResponse = {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve monitor tasks"
      };
      res.status(500).json(response);
    }
  }
}

export const dashboardController = new DashboardController();
